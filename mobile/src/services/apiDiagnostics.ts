/**
 * API Connectivity Diagnostics
 * Tests the AI provider that is actually configured (.env) plus Sarvam voice.
 * Used by the in-app diagnostics screen (Home → 🔧 AI Diagnostics).
 */

const PROVIDER = (process.env.EXPO_PUBLIC_AI_PROVIDER || 'freellm').trim().toLowerCase();

const OPENROUTER_KEY = (process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '').trim();
const OPENROUTER_MODEL = (process.env.EXPO_PUBLIC_OPENROUTER_MODEL || 'openrouter/auto').trim();

const GEMINI_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = (process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.8-flash').trim();

const SARVAM_KEY = (process.env.EXPO_PUBLIC_SARVAM_API_KEY || '').trim();

export interface ServiceStatus {
  configured: boolean;
  keyFormatOk: boolean;
  connected: boolean;
  error?: string;
}

export interface ApiStatus {
  ai: ServiceStatus & { provider: string; model: string };
  sarvam: ServiceStatus;
}

/** Test if a key is set and well-formed */
export function checkKeyConfig(key: string): { configured: boolean; keyFormatOk: boolean } {
  const trimmed = key.trim();
  if (!trimmed || trimmed.length < 10) {
    return { configured: false, keyFormatOk: false };
  }
  return { configured: true, keyFormatOk: true };
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  return body.slice(0, 160);
}

function describeHttpError(status: number, body: string): string {
  if (status === 401 || status === 403) return `Auth failed (HTTP ${status}): key is invalid or revoked`;
  if (status === 402) return 'Credits unavailable (HTTP 402): in-flight requests or empty balance — retry shortly';
  if (status === 404) return `Model unavailable (HTTP 404): choose another model in .env — ${body}`;
  if (status === 429) return 'Rate limited (HTTP 429): try again shortly';
  return `HTTP ${status}: ${body}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


/** Ping the configured AI provider with a 1-token request. */
export async function testAiConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    if (PROVIDER === 'gemini') {
      if (!GEMINI_KEY) return { connected: false, error: 'No Gemini API key configured' };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say: OK' }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 8 },
          }),
        },
      );
      if (res.ok) return { connected: true };
      return { connected: false, error: describeHttpError(res.status, await readError(res)) };
    }

    if (PROVIDER === 'freellm' || PROVIDER === 'custom') {
      const baseUrl = (
        PROVIDER === 'freellm'
          ? process.env.EXPO_PUBLIC_FREELLM_BASE_URL
          : process.env.EXPO_PUBLIC_AI_BASE_URL
      )?.replace(/\/+$/, '');
      const key =
        PROVIDER === 'freellm'
          ? process.env.EXPO_PUBLIC_FREELLM_API_KEY
          : process.env.EXPO_PUBLIC_AI_API_KEY;
      const model =
        (PROVIDER === 'freellm'
          ? process.env.EXPO_PUBLIC_FREELLM_MODEL
          : process.env.EXPO_PUBLIC_AI_MODEL) || 'auto';

      if (!baseUrl) return { connected: false, error: 'Base URL not configured' };
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key || ''}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
          max_tokens: 8,
        }),
      });
      if (res.ok) return { connected: true };
      return { connected: false, error: describeHttpError(res.status, await readError(res)) };
    }

    // OpenRouter — replay the production JSON-mode request so CONNECTED means
    // real advisories will work, not just that a tiny "OK" ping succeeded.
    const key = (process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '').trim();
    if (!key) return { connected: false, error: 'No OpenRouter API key configured' };

    const messages = [
      {
        role: 'system',
        content:
          'You are an ANGRAU agronomist. Reply ONLY with raw JSON (no markdown) with exactly ' +
          'these keys: transcript_en, transcript_te, diagnosis_title_en, diagnosis_title_te, ' +
          'advisory_en, advisory_te, chemical_dosage_en, chemical_dosage_te.',
      },
      {
        role: 'user',
        content:
          'FARMER QUESTION: How to control yellow stem borer in my paddy crop? ' +
          'Return the complete advisory JSON now.',
      },
    ];

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': 'https://rythuvaani.app',
            'X-Title': 'RythuVaani',
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages,
            temperature: 0.2,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
            provider: { require_parameters: true },
          }),
        });

        if (res.status === 402 && attempt < 3) {
          await sleep(1500 * 2 ** (attempt - 1));
          continue;
        }
        if (!res.ok) {
          return { connected: false, error: describeHttpError(res.status, await readError(res)) };
        }

        const data = await res.json().catch(() => null);
        const raw = data?.choices?.[0]?.message?.content;
        const text = typeof raw === 'string' ? raw : '';
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        let usable = false;
        try {
          const parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
          usable = ['advisory_en', 'diagnosis_title_en'].some(
            (field) => typeof parsed?.[field] === 'string' && parsed[field].trim().length > 0,
          );
        } catch {
          // empty / prose / truncated JSON — retry below
        }
        if (usable) return { connected: true };
        if (attempt < 3) {
          await sleep(750 * 2 ** (attempt - 1));
          continue;
        }
        const finish = data?.choices?.[0]?.finish_reason || 'unknown';
        return {
          connected: false,
          error: `Model returned unusable JSON (finish_reason=${finish}) — check the model in .env`,
        };
      } catch (e: any) {
        return { connected: false, error: `Network error: ${e?.message || String(e)}` };
      }
    }
    return { connected: false, error: 'AI provider did not respond' };
  } catch (e: any) {
    return { connected: false, error: `Network error: ${e?.message || String(e)}` };
  }
}

/** Ping Sarvam with a minimal TTS request to test connectivity */
export async function testSarvamConnection(): Promise<{ connected: boolean; error?: string }> {
  if (!SARVAM_KEY) {
    return { connected: false, error: 'No API key configured' };
  }
  try {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'test',
        language_code: 'en-IN',
        model: 'bulbul:v3',
      }),
    });
    if (res.ok) return { connected: true };
    return { connected: false, error: describeHttpError(res.status, await readError(res)) };
  } catch (e: any) {
    return { connected: false, error: `Network error: ${e?.message || String(e)}` };
  }
}

function aiModelLabel(): string {
  if (PROVIDER === 'gemini') return GEMINI_MODEL;
  if (PROVIDER === 'openrouter') return OPENROUTER_MODEL;
  return (
    (PROVIDER === 'freellm'
      ? process.env.EXPO_PUBLIC_FREELLM_MODEL
      : process.env.EXPO_PUBLIC_AI_MODEL) || 'auto'
  );
}

/** Run all connectivity tests */
export async function diagnoseApiConnections(): Promise<ApiStatus> {
  const aiConfig = checkKeyConfig(
    PROVIDER === 'openrouter' ? OPENROUTER_KEY : PROVIDER === 'gemini' ? GEMINI_KEY : 'configured',
  );
  const sarvamConfig = checkKeyConfig(SARVAM_KEY);

  const [aiTest, sarvamTest] = await Promise.all([
    aiConfig.configured
      ? testAiConnection()
      : Promise.resolve({ connected: false, error: 'Key not configured' }),
    sarvamConfig.configured
      ? testSarvamConnection()
      : Promise.resolve({ connected: false, error: 'Key not configured' }),
  ]);

  const keyLooksValid =
    PROVIDER === 'gemini'
      ? /^[A-Za-z0-9_.-]{20,}$/.test(GEMINI_KEY)
      : PROVIDER === 'openrouter'
        ? /^sk-or-[A-Za-z0-9_-]{10,}$/.test(OPENROUTER_KEY)
        : aiConfig.configured;

  return {
    ai: {
      provider: PROVIDER,
      model: aiModelLabel(),
      configured: aiConfig.configured,
      keyFormatOk: keyLooksValid,
      connected: aiTest.connected,
      error: aiTest.error,
    },
    sarvam: {
      configured: sarvamConfig.configured,
      keyFormatOk: /^sk_[A-Za-z0-9_-]{20,}$/.test(SARVAM_KEY),
      connected: sarvamTest.connected,
      error: sarvamTest.error,
    },
  };
}
