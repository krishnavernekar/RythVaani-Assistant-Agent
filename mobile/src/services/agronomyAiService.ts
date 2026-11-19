/**
 * RythuVaani Agronomy AI Service Layer
 * ------------------------------------
 * Pipeline (Rule 1 — Agronomic Safety & Zero-Hallucination):
 *   1. Sarvam Saaras STT  → Telugu transcript from farmer voice (if key set)
 *   2. AI provider       → structured ANGRAU-grounded advisory JSON
 *                           (OpenRouter `openrouter/auto` by default)
 *   3. CIB&RC banned-pesticide filter (deterministic post-processing)
 *   4. Weather-spray interlock prepended from live Open-Meteo data
 *   5. Offline ANGRAU knowledge base fallback — never empty-handed
 */

import { File } from 'expo-file-system';
import { WeatherData } from './weatherService';
import { transcribeAudio, SarvamLang } from './sarvamVoiceService';

export interface AiAdvisory {
  diagnosis: string;
  diagnosisTe: string;
  recommendation: string;
  recommendationTe: string;
  isPesticide: boolean;
  scientificName?: string;
}

export interface AiResponse {
  transcript_en: string;
  transcript_te: string;
  diagnosis_title_en: string;
  diagnosis_title_te: string;
  advisory_en: string;
  advisory_te: string;
  chemical_dosage_en: string;
  chemical_dosage_te: string;
  weather_warning_en: string;
  weather_warning_te: string;
  /** Which engine produced this answer — surfaced on the UI card */
  source?: string;
}

/* ────────────────────────────── Multi-Provider AI ─────────────────────── */

/**
 * AI provider selection (set EXPO_PUBLIC_AI_PROVIDER in .env):
 *   - 'openrouter' : OpenRouter — one key, `openrouter/auto` picks a live model
 *   - 'gemini'     : Google Gemini (AI Studio key starts with AIza)
 *   - 'openai'     : OpenAI GPT-4o-mini
 *   - 'claude'     : Anthropic Claude
 *   - 'deepseek'   : DeepSeek Chat (very cheap)
 *   - 'freellm'    : FreeLLMAPI — self-hosted OpenAI-compatible router (model `auto`)
 *   - 'custom'     : Any other OpenAI-compatible endpoint
 *   - 'offline'    : Skip cloud AI, use only the ANGRAU knowledge base
 */
export type AiProviderId =
  | 'openrouter'
  | 'gemini'
  | 'openai'
  | 'claude'
  | 'deepseek'
  | 'freellm'
  | 'custom'
  | 'offline';

const AI_PROVIDER = ((process.env.EXPO_PUBLIC_AI_PROVIDER || 'freellm').trim().toLowerCase()) as AiProviderId;

// OpenRouter — `openrouter/auto` lets OpenRouter choose an available model itself.
const OPENROUTER_API_KEY = (process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '').trim();
const OPENROUTER_MODEL = (process.env.EXPO_PUBLIC_OPENROUTER_MODEL || 'openrouter/auto').trim();
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
/** Tried in order when the selected model has been retired (HTTP 404). */
const OPENROUTER_FALLBACK_MODELS = ['openai/gpt-4o-mini', 'openai/gpt-4o'];

// Gemini
const GEMINI_MODEL = (process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.8-flash').trim();

// OpenAI
const OPENAI_API_KEY = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || '').trim();
const OPENAI_MODEL = (process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini').trim();
const OPENAI_BASE_URL = (process.env.EXPO_PUBLIC_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

// Anthropic
const CLAUDE_API_KEY = (process.env.EXPO_PUBLIC_CLAUDE_API_KEY || '').trim();
const CLAUDE_MODEL = (process.env.EXPO_PUBLIC_CLAUDE_MODEL || 'claude-3-5-haiku-latest').trim();

// DeepSeek
const DEEPSEEK_API_KEY = (process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '').trim();
const DEEPSEEK_MODEL = (process.env.EXPO_PUBLIC_DEEPSEEK_MODEL || 'deepseek-chat').trim();

// FreeLLMAPI — run it locally/Docker and point this at the LAN IP, e.g.
//   http://192.168.1.5:3001/v1
const FREELLM_API_KEY = (process.env.EXPO_PUBLIC_FREELLM_API_KEY || '').trim();
const FREELLM_BASE_URL = (process.env.EXPO_PUBLIC_FREELLM_BASE_URL || '').replace(/\/+$/, '');
const FREELLM_MODEL = (process.env.EXPO_PUBLIC_FREELLM_MODEL || 'auto').trim();

// Any other OpenAI-compatible endpoint
const CUSTOM_API_KEY = (process.env.EXPO_PUBLIC_AI_API_KEY || '').trim();
const CUSTOM_BASE_URL = (process.env.EXPO_PUBLIC_AI_BASE_URL || '').replace(/\/+$/, '');
const CUSTOM_MODEL = (process.env.EXPO_PUBLIC_AI_MODEL || '').trim();

/* ────────────────────────────── Banned Pesticides ─────────────────────── */

const BANNED_PESTICIDES = [
  'Monocrotophos',
  'Endosulfan',
  'Phorate',
  'Methyl Parathion',
  'Triazophos',
];

const SYSTEM_PROMPT = `
You are an official ANGRAU (Acharya N.G. Ranga Agricultural University) Agronomist serving
Guntur district, Andhra Pradesh, India. You advise smallholder farmers growing Paddy and Chilli.

RULES:
- Ground every chemical recommendation in ANGRAU / ICAR-KVK package of practices.
- NEVER invent chemical pesticide names, dosages, or mixing ratios.
- STRICTLY BLOCK these banned/restricted CIB&RC chemicals: ${BANNED_PESTICIDES.join(', ')}.
  If the farmer asks about them, refuse and give an approved alternative.
- Transcribe the farmer's audio into Telugu (transcript_te) and translate to English (transcript_en).
- If live weather context is provided and a foliar spray is recommended while rain probability
  exceeds 50% or wind exceeds 18 km/h, put an urgent postponement instruction in
  weather_warning_en / weather_warning_te. Otherwise leave those fields as empty strings "".
- Reply in the same language mix as the farmer.

Return ONLY raw JSON (no markdown fences) with exactly these keys:
{
  "transcript_en": "...",
  "transcript_te": "...",
  "diagnosis_title_en": "...",
  "diagnosis_title_te": "...",
  "advisory_en": "...",
  "advisory_te": "...",
  "chemical_dosage_en": "...",
  "chemical_dosage_te": "..."
}
`;

function weatherContext(w: WeatherData): string {
  return (
    'LIVE AGROMET DATA (Guntur Mandal, Open-Meteo):\n' +
    `Temperature ${w.temp}°C (feels like ${w.feelsLike}°C), ` +
    `Humidity ${Math.round(w.humidity)}%, ` +
    `Rain probability ${Math.round(w.rainProb)}%, ` +
    `Wind speed ${Math.round(w.windSpeed)} km/h, ` +
    `Soil moisture 3-9cm ${w.soilMoisture}%.`
  );
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/**
 * One Gemini call → parsed AiResponse, or null (caller falls back).
 * Logs real HTTP status / API error bodies so failures are debuggable on device.
 */
async function callGemini(parts: GeminiPart[]): Promise<AiResponse | null> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const maxAttempts = 3;
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text().catch(() => '');

        // 503 = temporary overload, retry with longer backoff
        if (res.status === 503 && attempt < maxAttempts) {
          const delayMs = 2000 * 2 ** (attempt - 1); // 2s, 4s, 8s
          console.warn(`[Gemini] 503 Temporarily Unavailable (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs/1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        console.error(
          `[Gemini] HTTP ${res.status} (attempt ${attempt}/${maxAttempts}):`,
          body.slice(0, 400),
        );

        if (retryableStatuses.has(res.status) && attempt < maxAttempts) {
          const delayMs = 800 * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        return null;
      }

      const result = await res.json();
      const candidateParts = result?.candidates?.[0]?.content?.parts as
        | { text?: string }[]
        | undefined;
      const text = candidateParts?.map((p) => p?.text ?? '').join('').trim();

      if (!text) {
        console.error('[Gemini] Empty candidates:', JSON.stringify(result).slice(0, 400));
        return null;
      }

      return safeParseJSON(text);
    } catch (e) {
      console.error(`[Gemini] Request failed (attempt ${attempt}/${maxAttempts}):`, e);

      // 503-like network errors get longer retries
      if (attempt < maxAttempts) {
        const delayMs = 2000 * 2 ** (attempt - 1); // 2s, 4s, 8s
        console.warn(`[Gemini] Retrying in ${delayMs/1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      return null;
    }
  }

  return null;
}

/* ─────────────────── Offline ANGRAU Knowledge Base ────────────────── */

const OFFLINE_KB: Record<string, AiResponse> = {
  'stem-borer': {
    transcript_en: 'How to control yellow stem borer in my paddy crop?',
    transcript_te: 'నా వరి పంటలో పసుపు కాండం తొలుచు పురుగును ఎలా నియంత్రించాలి?',
    diagnosis_title_en: 'Yellow Stem Borer (Scirpophaga incertulas)',
    diagnosis_title_te: 'పసుపు కాండం తొలుచు పురుగు',
    advisory_en:
      'Look for dead hearts in tillers. Install 5 pheromone traps per acre @ 5 traps/ha threshold and monitor weekly. Apply granules on moist field water when egg-mass count crosses 2 per hill.',
    advisory_te:
      'మొక్కలలో "డెడ్ హార్ట్" లక్షణాలు కోసం తనిఖీ చేయండి. ఎకరాకు 5 ఫెరోమోన్ ఉచ్చులు వేయండి మరియు వారానికి ఒకసారి పరిశీలించండి.',
    chemical_dosage_en:
      'Cartap Hydrochloride 4G granules @ 8 kg/acre, or Chlorantraniliprole 18.5% SC spray @ 0.4 ml/L water (ANGRAU package of practice).',
    chemical_dosage_te:
      'కార్టాప్ హైడ్రోక్లోరైడ్ 4G 8 కిలోలు ఎకరాకు, లేదా క్లోరాంట్రానిలీప్రోల్ 18.5% SC 0.4 మి.లీ / లీటరు పిచికారీ.',
    weather_warning_en: '',
    weather_warning_te: '',
  },
  'bph': {
    transcript_en: 'Brown planthopper is attacking my paddy, what should I do?',
    transcript_te: 'నా వరి పంటపై గుడ్డి తెల్లటి దెబ్బ (బ్రౌన్ ప్లాంట్ హాపర్) దాడి చేస్తోంది, ఏమి చేయాలి?',
    diagnosis_title_en: 'Brown Planthopper (Nilaparvata lugens)',
    diagnosis_title_te: 'గుడ్డి తెల్లటి దెబ్బ',
    advisory_en:
      'Spray prescriptive dose only after confirming hopper-bug density at the base of hills wearing a face mask. Avoid excessive nitrogen which worsens BPH outbreaks.',
    advisory_te:
      'దెబ్బ సంఖ్యను మొక్క అడుగుభాగంలో తనిఖీ చేసి, అధికంగా ఉంటేనే స్ప్రే చేయండి. అధిక యూరియా వాడకుండా ఉండండి.',
    chemical_dosage_en:
      'Pymetrozine 50% WG @ 40 g/acre or Flonicamid 50% WG @ 80 g/acre, spray directed at plant base (ANGRAU recommendation).',
    chemical_dosage_te:
      'పైమెట్రోజీన్ 50% WG 40 గ్రాములు ఎకరాకు లేదా ఫ్లోనికామిడ్ 50% WG 80 గ్రాములు, మొక్క అడుగుభాగానికి పిచికారీ.',
    weather_warning_en: '',
    weather_warning_te: '',
  },
  'leaf-curl': {
    transcript_en: 'Leaves of my chilli crop are curling, what is the problem?',
    transcript_te: 'నా మిరప పంట ఆకులు కుంకుతున్నాయి, సమస్య ఏమిటి?',
    diagnosis_title_en: 'Chilli Leaf Curl Virus (vector: thrips)',
    diagnosis_title_te: 'మిరప ఆకుముడత తెగులు',
    advisory_en:
      'Leaf curl is transmitted by thrips. Remove and destroy severely affected plants, keep the field weed-free, and manage the vector early at 2-4 leaf stage.',
    advisory_te:
      'తీవ్రంగా పాడైన మొక్కలను తీసి కాల్చండి (ధ్వంసం చేయండి) మరియు రసం పీల్చే పురుగులను (త్రిప్స్) ముందుగానే నియంత్రించండి.',
    chemical_dosage_en:
      'Fipronil 5% SC @ 2 ml/L or Spinetoram 11.7% SC @ 1.2 ml/L for thrips management (ANGRAU package).',
    chemical_dosage_te:
      'ఫిప్రోనిల్ 5% SC 2 మి.లీ / లీటరు లేదా స్పినెటోరామ్ 1.2 మి.లీ / లీటరు పిచికారీ చేయండి.',
    weather_warning_en: '',
    weather_warning_te: '',
  },
  'thrips': {
    transcript_en: 'There are thrips on my chilli crop.',
    transcript_te: 'నా మిరప పంటపై త్రిప్స్ పురుగులు ఉన్నాయి.',
    diagnosis_title_en: 'Thrips Infestation (Scirtothrips dorsalis)',
    diagnosis_title_te: 'త్రిప్స్ తీపు పురుగు',
    advisory_en:
      'Install blue sticky traps @ 10/acre, avoid overhead irrigation which helps thrips spread, and rotate spray molecules to prevent resistance.',
    advisory_te:
      'ఎకరాకు 10 నీలం స్టిక్కీ ఉచ్చులు వేయండి మరియు ఔషధాన్ని మార్చి మార్చి పిచికారీ చేయండి.',
    chemical_dosage_en:
      'Spinosad 45% SC @ 0.3 ml/L or Fipronil 5% SC @ 2 ml/L water (ANGRAU package).',
    chemical_dosage_te: 'స్పినోసాడ్ 0.3 మి.లీ / లీటరు లేదా ఫిప్రోనిల్ 2 మి.లీ / లీటరు.',
    weather_warning_en: '',
    weather_warning_te: '',
  },
  'fertilizer': {
    transcript_en: 'When and how much urea should I apply?',
    transcript_te: 'యూరియా ఎప్పుడు, ఎంత వేయాలి?',
    diagnosis_title_en: 'Nitrogen Fertilizer Management',
    diagnosis_title_te: 'నత్రజని ఎరువు యాజమాన్యం',
    advisory_en:
      'For paddy (Kharif), split nitrogen into 3 equal doses at transplanting, tillering and panicle initiation. Do not apply urea on a dry or heavily waterlogged field.',
    advisory_te:
      'వరి కోసం యూరియాను 3 సమాన వంతులుగా - నాటడం, పద్దు పెరుగుదల మరియు గింజ దశలలో వేయండి.',
    chemical_dosage_en:
      'Recommended N for local soils: 64-80 kg N/acre (≈ Urea 140-175 kg/acre) split into 3 doses; supplement with 32 kg P2O5 and 32 kg K2O per acre.',
    chemical_dosage_te:
      'ఎకరాకు 140-175 కిలోల యూరియా 3 వంతులుగా, 32 కిలోల డిఎపి (ఫాస్ఫరస్) సప్లిమెంట్.',
    weather_warning_en: '',
    weather_warning_te: '',
  },
};

function matchOfflineAdvisory(query: string): AiResponse {
  const q = query.toLowerCase();
  if (q.includes('leaf curl') || q.includes('ఆకుమడ') || q.includes('మిరప') || q.includes('chilli')) {
    return OFFLINE_KB['leaf-curl'];
  }
  if (q.includes('thrips') || q.includes('త్రిప్స్')) return OFFLINE_KB['thrips'];
  if (q.includes('bph') || q.includes('hopper') || q.includes('గుడ్డి')) return OFFLINE_KB['bph'];
  if (q.includes('fertilizer') || q.includes('urea') || q.includes('ఎరువు') || q.includes('యూరియా')) {
    return OFFLINE_KB['fertilizer'];
  }
  // Default: paddy stem borer (primary Guntur Kharif issue)
  return OFFLINE_KB['stem-borer'];
}

/* ──────────────────────── Response parsing ─────────────────────────── */

const safeParseJSON = (text: string): AiResponse => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    return {
      transcript_en: String(parsed.transcript_en ?? ''),
      transcript_te: String(parsed.transcript_te ?? ''),
      diagnosis_title_en: String(parsed.diagnosis_title_en ?? ''),
      diagnosis_title_te: String(parsed.diagnosis_title_te ?? ''),
      advisory_en: String(parsed.advisory_en ?? ''),
      advisory_te: String(parsed.advisory_te ?? ''),
      chemical_dosage_en: String(parsed.chemical_dosage_en ?? ''),
      chemical_dosage_te: String(parsed.chemical_dosage_te ?? ''),
      weather_warning_en: String(parsed.weather_warning_en ?? ''),
      weather_warning_te: String(parsed.weather_warning_te ?? ''),
    };
  } catch (e) {
    console.error('[AI] JSON parse failed:', e, text.slice(0, 200));
    return matchOfflineAdvisory('');
  }
};

/** Rule 1.2 — deterministic filter: reject output mentioning banned chemicals. */
function containsBannedPesticide(r: AiResponse): boolean {
  const haystack = [
    r.advisory_en,
    r.advisory_te,
    r.chemical_dosage_en,
    r.chemical_dosage_te,
  ]
    .join(' ')
    .toLowerCase();
  return BANNED_PESTICIDES.some((p) => haystack.includes(p.toLowerCase()));
}

/* ──────────────── Rule 1.4: weather-spray interlock ────────────────── */

function computeSprayWarning(w: WeatherData): { en: string; te: string } | null {
  if (w.rainProb > 50) {
    return {
      en: `⚠️ Spray interlock: rain probability is ${Math.round(w.rainProb)}% today (Sri Venkateswara frame). Postpone any foliar spray — apply only during dry hours of a rain-free window and finish before 4:00 PM.`,
      te: `⚠️ పిచికారీ హెచ్చరిక: ఈరోజు వర్షావకాశం ${Math.round(w.rainProb)}% ఉంది. పిచికారీని వాయిదా వేయండి — వర్షం లేని పొడి సమయంలో మాత్రమే, సాయంత్రం 4 గంటలలోపు పూర్తి చేయండి.`,
    };
  }
  if (w.windSpeed > 18) {
    return {
      en: `⚠️ Spray interlock: wind is ${Math.round(w.windSpeed)} km/h — above the safe spraying limit of 18 km/h. Drift risk is high; postpone spraying to early morning of a calm day.`,
      te: `⚠️ పిచికారీ హెచ్చరిక: గాలి వేగం ${Math.round(w.windSpeed)} కి.మీ/గం. ఉంది (సురక్షిత పరిమితి 18 కి.మీ/గం పైన). ఉదయం వేళలో, కలిమి గాలి లేని రోజుకు వాయిదా వేయండి.`,
    };
  }
  return null;
}

function isSprayAdvisory(r: AiResponse): boolean {
  return r.chemical_dosage_en.trim().length > 0;
}

function interlockWeatherWarning(r: AiResponse, w: WeatherData): AiResponse {
  const local = computeSprayWarning(w);
  if (!local || !isSprayAdvisory(r)) return r;
  return {
    ...r,
    weather_warning_en: r.weather_warning_en.trim() || local.en,
    weather_warning_te: r.weather_warning_te.trim() || local.te,
  };
}

/* ──────────────────────── OpenAI-compatible helpers ──────────────────── */

type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface ChatMessage {
  role: 'system' | 'user';
  content: string | ChatContentPart[];
}

interface OpenAICompatibleConfig {
  /** Human-readable name used in log lines and UI source labels */
  label: string;
  baseUrl: string;
  apiKey: string;
  /** Tried in order; a retired model (404) moves on to the next one */
  models: string[];
  extraHeaders?: Record<string, string>;
}

/** Convert Gemini-style parts to OpenAI chat content (images become data URLs). */
function toChatMessages(parts: GeminiPart[]): ChatMessage[] {
  const content: ChatContentPart[] = [];

  for (const part of parts) {
    if ('text' in part) {
      if (part.text.trim()) content.push({ type: 'text', text: part.text });
      continue;
    }
    if (part.inlineData.mimeType.startsWith('image/')) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` },
      });
    }
    // Inline audio can't go to chat-completions endpoints — Sarvam Saaras handles STT.
  }

  if (content.length === 0) {
    content.push({ type: 'text', text: 'Return the advisory JSON now.' });
  }

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content },
  ];
}

function extractChatText(data: any): string {
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw.map((p: any) => (typeof p === 'string' ? p : p?.text ?? '')).join('').trim();
  }
  return '';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call any OpenAI-compatible `/chat/completions` endpoint.
 * - retries 429/5xx with backoff
 * - walks through `models` when one has been retired (404)
 * - returns null on auth/credit failure so the caller falls back to the ANGRAU KB
 */
async function callOpenAICompatible(
  config: OpenAICompatibleConfig,
  parts: GeminiPart[],
): Promise<AiResponse | null> {
  if (!config.apiKey || !config.baseUrl) return null;

  const models = config.models.filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
  const maxAttempts = 3;
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);
  const messages = toChatMessages(parts);

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
            ...config.extraHeaders,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = extractChatText(data);
          if (!text) {
            console.error(`[${config.label}] Empty response for ${model}`);
            return null;
          }
          console.log(`[${config.label}] answered with ${data?.model || model}`);
          return safeParseJSON(text);
        }

        const errorBody = await res.text().catch(() => '');
        const isModelGone =
          res.status === 404 ||
          /model .*(not found|no longer available|unavailable|does not exist)/i.test(errorBody);

        console.error(
          `[${config.label}] HTTP ${res.status} · ${model} (attempt ${attempt}/${maxAttempts}):`,
          errorBody.slice(0, 300),
        );

        if (isModelGone) break; // try the next model in the list
        if (res.status === 401 || res.status === 403) return null; // bad key — stop
        if (res.status === 402) {
          console.error(`[${config.label}] Out of credits for ${model}`);
          return null;
        }
        if (retryableStatuses.has(res.status) && attempt < maxAttempts) {
          await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        break; // non-retryable → next model
      } catch (e) {
        const isConnectionError =
          e instanceof Error &&
          (e.message.includes('ConnectException') ||
            e.message.includes('Failed to connect') ||
            e.message.includes('Network request failed') ||
            e.message.includes('fetch failed'));
        if (isConnectionError) {
          console.warn(
            `[${config.label}] Server unreachable at ${config.baseUrl} — check if FreeLLMAPI is running`,
          );
          break; // Don't retry connection errors — server is down
        }
        console.error(
          `[${config.label}] Request failed for ${model} (attempt ${attempt}/${maxAttempts}):`,
          e,
        );
        if (attempt < maxAttempts) {
          await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        break;
      }
    }
  }

  return null;
}

/* ──────────────────────── OpenRouter ─────────────────────────────────── */

async function callOpenRouter(parts: GeminiPart[]): Promise<AiResponse | null> {
  return callOpenAICompatible(
    {
      label: 'OpenRouter',
      baseUrl: OPENROUTER_BASE_URL,
      apiKey: OPENROUTER_API_KEY,
      models: [OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS],
      extraHeaders: {
        'HTTP-Referer': 'https://rythuvaani.app',
        'X-Title': 'RythuVaani',
      },
    },
    parts,
  );
}

/* ──────────────────────── OpenAI / DeepSeek / FreeLLM / custom ───────── */

async function callOpenAI(parts: GeminiPart[]): Promise<AiResponse | null> {
  return callOpenAICompatible(
    { label: 'OpenAI', baseUrl: OPENAI_BASE_URL, apiKey: OPENAI_API_KEY, models: [OPENAI_MODEL] },
    parts,
  );
}

async function callDeepSeek(parts: GeminiPart[]): Promise<AiResponse | null> {
  return callOpenAICompatible(
    {
      label: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      apiKey: DEEPSEEK_API_KEY,
      models: [DEEPSEEK_MODEL],
    },
    parts,
  );
}

async function callFreeLlm(parts: GeminiPart[]): Promise<AiResponse | null> {
  if (!FREELLM_BASE_URL) {
    console.error('[FreeLLM] EXPO_PUBLIC_FREELLM_BASE_URL is not set (e.g. http://192.168.1.5:3001/v1)');
    return null;
  }
  return callOpenAICompatible(
    {
      label: 'FreeLLM',
      baseUrl: FREELLM_BASE_URL,
      apiKey: FREELLM_API_KEY,
      models: [FREELLM_MODEL],
    },
    parts,
  );
}

async function callCustom(parts: GeminiPart[]): Promise<AiResponse | null> {
  if (!CUSTOM_BASE_URL) {
    console.error('[Custom AI] EXPO_PUBLIC_AI_BASE_URL is not set');
    return null;
  }
  return callOpenAICompatible(
    {
      label: 'Custom AI',
      baseUrl: CUSTOM_BASE_URL,
      apiKey: CUSTOM_API_KEY,
      models: [CUSTOM_MODEL || 'auto'],
    },
    parts,
  );
}

/* ──────────────────────── Anthropic ──────────────────────────────────── */

async function callClaude(parts: GeminiPart[]): Promise<AiResponse | null> {
  if (!CLAUDE_API_KEY) return null;

  const text = parts
    .map((p) => ('text' in p ? p.text : ''))
    .filter(Boolean)
    .join('\n');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1200,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: text || 'Return the advisory JSON now.' }],
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        console.error(`[Claude] HTTP ${res.status} (attempt ${attempt}/3):`, errorBody.slice(0, 300));
        if (res.status === 401 || res.status === 403) return null;
        if (attempt < 3) {
          await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        return null;
      }

      const data = await res.json();
      const answer = (data?.content?.[0]?.text ?? '').trim();
      return answer ? safeParseJSON(answer) : null;
    } catch (e) {
      console.error(`[Claude] Request failed (attempt ${attempt}/3):`, e);
      if (attempt < 3) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

/* ──────────────────────── Provider router ────────────────────────────── */

interface ProviderCallResult {
  response: AiResponse;
  /** Accurate engine label for the advisory card */
  source: string;
}

async function callAIProvider(parts: GeminiPart[]): Promise<ProviderCallResult | null> {
  const provider = AI_PROVIDER;

  if (provider === 'offline') return null;

  if (provider === 'gemini') {
    const response = await callGemini(parts);
    return response ? { response, source: `Gemini · ${GEMINI_MODEL}` } : null;
  }
  if (provider === 'openai') {
    const response = await callOpenAI(parts);
    return response ? { response, source: `OpenAI · ${OPENAI_MODEL}` } : null;
  }
  if (provider === 'claude') {
    const response = await callClaude(parts);
    return response ? { response, source: `Claude · ${CLAUDE_MODEL}` } : null;
  }
  if (provider === 'deepseek') {
    const response = await callDeepSeek(parts);
    return response ? { response, source: `DeepSeek · ${DEEPSEEK_MODEL}` } : null;
  }
  if (provider === 'freellm') {
    const response = await callFreeLlm(parts);
    return response ? { response, source: `FreeLLMAPI · ${FREELLM_MODEL}` } : null;
  }
  if (provider === 'custom') {
    const response = await callCustom(parts);
    return response ? { response, source: `Custom AI · ${CUSTOM_MODEL || 'auto'}` } : null;
  }

  // Default: OpenRouter
  const response = await callOpenRouter(parts);
  return response ? { response, source: `OpenRouter · ${OPENROUTER_MODEL}` } : null;
}

/** Small helper for the diagnostics screen. */
export function getAiProviderInfo(): { provider: AiProviderId; model: string; configured: boolean } {
  switch (AI_PROVIDER) {
    case 'gemini':
      return { provider: AI_PROVIDER, model: GEMINI_MODEL, configured: Boolean(process.env.EXPO_PUBLIC_GEMINI_API_KEY) };
    case 'openai':
      return { provider: AI_PROVIDER, model: OPENAI_MODEL, configured: Boolean(OPENAI_API_KEY) };
    case 'claude':
      return { provider: AI_PROVIDER, model: CLAUDE_MODEL, configured: Boolean(CLAUDE_API_KEY) };
    case 'deepseek':
      return { provider: AI_PROVIDER, model: DEEPSEEK_MODEL, configured: Boolean(DEEPSEEK_API_KEY) };
    case 'freellm':
      return { provider: AI_PROVIDER, model: FREELLM_MODEL, configured: Boolean(FREELLM_BASE_URL) };
    case 'custom':
      return { provider: AI_PROVIDER, model: CUSTOM_MODEL || 'auto', configured: Boolean(CUSTOM_BASE_URL) };
    case 'offline':
      return { provider: AI_PROVIDER, model: 'ANGRAU offline KB', configured: true };
    default:
      return { provider: 'openrouter', model: OPENROUTER_MODEL, configured: Boolean(OPENROUTER_API_KEY) };
  }
}

/* ──────────────────────── Public API ──────────────────────────────── */

export interface VoiceQueryInput {
  /** Recorded clip from expo-audio (file:// URI), if the farmer used the mic */
  audioUri?: string | null;
  /** Editable transcript fields shown on screen */
  transcriptEn?: string;
  transcriptTe?: string;
  language: SarvamLang;
  weather: WeatherData;
}

/**
 * Full voice-query pipeline:
 *  Sarvam Saaras STT (Telugu) → Gemini advisory JSON → guardrails → offline KB.
 */
export async function analyzeVoiceQuery(input: VoiceQueryInput): Promise<AiResponse> {
  const { audioUri, transcriptEn = '', transcriptTe = '', language, weather } = input;

  let source = 'Off-line ANGRAU KB (No API key)';
  let sentTe = transcriptTe.trim();
  let sentEn = transcriptEn.trim();

  // 1) Native Telugu STT through Sarvam when we have a recording
  if (audioUri) {
    const telugu = await transcribeAudio(audioUri, language);
    if (telugu) {
      sentTe = telugu;
      source = 'Sarvam Saaras STT';
    }
  }

  // 2) Diagnose + advise via the configured provider
  const parts: GeminiPart[] = [{ text: `${SYSTEM_PROMPT}\n${weatherContext(weather)}` }];

  if (audioUri && source !== 'Sarvam Saaras STT' && AI_PROVIDER === 'gemini') {
    // No Sarvam path: only Gemini can transcribe audio inline
    try {
      const file = new File(audioUri);
      const base64Audio = await file.base64();
      if (base64Audio.length > 100) {
        parts.push({ inlineData: { mimeType: 'audio/mp4', data: base64Audio } });
        source = 'Gemini (inline audio)';
      }
    } catch (e) {
      console.error('[AI] Could not read recording for Gemini:', e);
    }
  }

  if (sentEn || sentTe) {
    parts.push({
      text:
        `FARMER QUESTION:\n Telugu: ${sentTe || '(not provided)'}\n` +
        ` English: ${sentEn || '(not provided)'}\nReturn the complete JSON now.`,
    });
  }

  const aiResult = await callAIProvider(parts);
  let response = aiResult?.response ?? null;

  if (aiResult && response) {
    source =
      source === 'Sarvam Saaras STT'
        ? `${aiResult.source} + Sarvam Saaras STT`
        : aiResult.source;
    // Keep farmer-edited transcripts when the model returns blanks
    response.transcript_en = response.transcript_en.trim() || sentEn;
    response.transcript_te = response.transcript_te.trim() || sentTe;
  }

  // 3) Guardrails: banned-chemical filter → offline KB; also offline when no key
  if (!response || containsBannedPesticide(response)) {
    if (response) console.warn('[AI] Banned pesticide blocked — falling back to ANGRAU KB');
    response = matchOfflineAdvisory(`${sentEn} ${sentTe}`);
    response.transcript_en = response.transcript_en.trim() || sentEn;
    response.transcript_te = response.transcript_te.trim() || sentTe;
    if (aiResult) {
      source = `${aiResult.source} → ANGRAU offline KB (banned-chemical filter)`;
    }
  }

  // 4) Weather-spray interlock (Rule 1.4)
  response = interlockWeatherWarning(response, weather);
  response.source = source;
  return response;
}

/** Crop health scanner: send the leaf photo to Gemini for diagnosis. */
export async function analyzeCropImage(
  base64Image: string,
  weather: WeatherData,
): Promise<AiResponse> {
  let source = 'Off-line ANGRAU KB (No API key)';

  const parts: GeminiPart[] = [
    {
      text:
        `${SYSTEM_PROMPT}\n${weatherContext(weather)}\n` +
        'A farmer photographed a leaf from his Paddy or Chilli crop. Identify the pest or ' +
        'disease from the image and return the complete advisory JSON now.',
    },
    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
  ];

  const aiResult = await callAIProvider(parts);
  let response: AiResponse = aiResult?.response ?? OFFLINE_KB['leaf-curl'];
  if (aiResult) source = aiResult.source;

  if (!response || containsBannedPesticide(response)) {
    response = OFFLINE_KB['leaf-curl'];
    source = 'Off-line ANGRAU KB';
  }

  response = interlockWeatherWarning(response, weather);
  response.source = source;
  return response;
}
