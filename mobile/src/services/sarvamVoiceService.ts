/**
 * Sarvam AI Voice Service (Indic Speech-to-Text + Text-to-Speech)
 * ---------------------------------------------------------------
 * REST endpoints (verified against https://docs.sarvam.ai/api-reference/speech-to-text/transcribe):
 *  - STT: POST https://api.sarvam.ai/speech-to-text  (multipart, model saaras:v4, ≤30s files)
 *  - TTS: POST https://api.sarvam.ai/text-to-speech  (JSON,   model bulbul:v3, returns base64 WAV)
 *
 * Every call fails soft (returns null) so callers can fall back to
 * Gemini inline-audio / expo-speech system TTS.
 */
import { File, Paths } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { createAudioPlayer } from 'expo-audio';

const SARVAM_BASE = 'https://api.sarvam.ai';

export type SarvamLang = 'te-IN' | 'en-IN' | 'hi-IN';

const getApiKey = (): string | null => {
  const key = process.env.EXPO_PUBLIC_SARVAM_API_KEY;
  return key && key.trim().length > 10 ? key.trim() : null;
};

export const hasSarvamKey = (): boolean => getApiKey() !== null;

/* ──────────────────────────────────────────────────────────────────── */
/*  Speech-to-Text (Saaras v4)                                         */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * Transcribe a local recording from expo-audio.
 *
 * Use Expo's fetch implementation and pass the expo-file-system File directly
 * as a multipart form part. This avoids converting file bytes into a Blob,
 * which fails in some React Native/Hermes runtimes.
 */
export async function transcribeAudio(
  audioUri: string,
  _lang: SarvamLang = 'te-IN', // Saaras auto-detects language; kept for API stability
): Promise<string | null> {
  const key = getApiKey();
  if (!key) {
    console.log('[Sarvam] No EXPO_PUBLIC_SARVAM_API_KEY — skipping native STT');
    return null;
  }

  try {
    const audioFile = new File(audioUri);

    if (!audioFile.exists) {
      console.error('[Sarvam STT] Recording file does not exist:', audioUri);
      return null;
    }

    if (audioFile.size <= 0) {
      console.error('[Sarvam STT] Recording file is empty:', audioUri);
      return null;
    }

    // Expo SDK 58 supports File objects in multipart FormData when using expo/fetch.
    const form = new FormData();
    form.append('file', audioFile);
    form.append('model', 'saaras:v4');
    form.append('mode', 'transcribe');

    const res = await expoFetch(`${SARVAM_BASE}/speech-to-text`, {
      method: 'POST',
      headers: {
        'api-subscription-key': key,
      },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Sarvam STT] HTTP ${res.status}:`, body.slice(0, 300));
      return null;
    }

    const json = (await res.json()) as { transcript?: string };
    const transcript = json?.transcript;

    if (typeof transcript === 'string' && transcript.trim().length > 0) {
      console.log('[Sarvam STT] transcript:', transcript.slice(0, 80));
      return transcript.trim();
    }

    console.warn('[Sarvam STT] Empty transcript in response');
    return null;
  } catch (e) {
    console.error('[Sarvam STT] failed:', e);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Text-to-Speech (Bulbul v3)                                         */
/* ──────────────────────────────────────────────────────────────────── */

// Minimal dependency-free base64 → bytes decoder (Hermes-safe).
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decodeBase64(input: string): Uint8Array<ArrayBuffer> {
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = clean.length;
  let outLen = Math.floor((len / 4) * 3);
  if (len > 0 && clean[len - 1] === '=') outLen -= 1;
  if (len > 1 && clean[len - 2] === '=') outLen -= 1;
  const out = new Uint8Array(Math.max(outLen, 0));
  let p = 0;
  for (let i = 0; i + 3 < len; i += 4) {
    const c1 = B64_ALPHABET.indexOf(clean[i]);
    const c2 = B64_ALPHABET.indexOf(clean[i + 1]);
    const c3 = B64_ALPHABET.indexOf(clean[i + 2]);
    const c4 = B64_ALPHABET.indexOf(clean[i + 3]);
    const n = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    if (p < out.length) out[p++] = (n >> 16) & 0xff;
    if (p < out.length) out[p++] = (n >> 8) & 0xff;
    if (p < out.length) out[p++] = n & 0xff;
  }
  return out;
}

/**
 * Synthesize natural speech via Bulbul, write a temp WAV into cache and
 * return its file URI — or null on failure (caller falls back to expo-speech).
 */
export async function synthesizeSpeech(
  text: string,
  lang: SarvamLang,
): Promise<string | null> {
  const key = getApiKey();
  if (!key || !text.trim()) return null;
  try {
    const res = await fetch(`${SARVAM_BASE}/text-to-speech`, {
      method: 'POST',
      headers: {
        'api-subscription-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.slice(0, 1500),
        language_code: lang,
        model: 'bulbul:v3',
        speech_sample_rate: 22050,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Sarvam TTS] HTTP ${res.status}:`, body.slice(0, 300));
      return null;
    }

    const json = (await res.json()) as { audios?: string[] };
    const b64 = json?.audios?.[0];
    if (typeof b64 !== 'string' || b64.length === 0) {
      console.warn('[Sarvam TTS] No audio in response');
      return null;
    }

    const file = new File(Paths.cache, `rythuvaani-tts-${Date.now()}.wav`);
    try {
      file.create();
    } catch {
      /* file may already exist — write() overwrites */
    }
    await file.write(decodeBase64(b64));
    return file.uri;
  } catch (e) {
    console.error('[Sarvam TTS] failed:', e);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  One-call playback helper: Sarvam Bulbul → expo-speech fallback     */
/* ──────────────────────────────────────────────────────────────────── */

let currentPlayer: ReturnType<typeof createAudioPlayer> | null = null;

/**
 * Stops any Sarvam Bulbul playback immediately.
 * Used by the global navigation guard so two audio bulletins never overlap.
 */
export function stopIndicVoice(): void {
  if (!currentPlayer) return;
  try {
    currentPlayer.pause();
    currentPlayer.release();
  } catch (e) {
    console.warn('[Sarvam TTS] stop failed:', e);
  }
  currentPlayer = null;
}

/**
 * Plays the advisory text with natural Bulbul voice when the Sarvam key is
 * configured; otherwise / on failure, runs the provided fallback (expo-speech).
 */
export async function playIndicVoice(
  text: string,
  lang: SarvamLang,
  fallbackSpeak: () => void,
): Promise<void> {
  const uri = await synthesizeSpeech(text, lang);
  if (uri) {
    try {
      stopIndicVoice();
      currentPlayer = createAudioPlayer({ uri });
      currentPlayer.play();
      return;
    } catch (e) {
      console.error('[Sarvam TTS] playback failed:', e);
    }
  }
  fallbackSpeak();
}
