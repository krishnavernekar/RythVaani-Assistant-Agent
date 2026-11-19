/**
 * RythuVaani Voice / Text-to-Speech Utility
 * Uses expo-speech for offline/instant Telugu (te-IN) and English (en-IN) audio playback.
 * Called by every "వినండి / Listen" button on all screens.
 */
import * as Speech from 'expo-speech';
import { stopIndicVoice } from '../services/sarvamVoiceService';

export type TtsLanguage = 'te-IN' | 'en-IN' | 'hi-IN';

interface SpeakOptions {
  language?: TtsLanguage;
  onDone?: () => void;
  onStart?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Speak text aloud using the system TTS engine.
 * Falls back gracefully on web / simulators where TTS is unavailable.
 */
export function speak(
  text: string,
  options: SpeakOptions = {},
): void {
  const {
    language = 'te-IN',
    onDone,
    onStart,
    onError,
  } = options;

  // Stop any currently playing speech first (system TTS or Sarvam audio).
  stopSpeaking();

  Speech.speak(text, {
    language,
    onStart,
    onDone,
    onError: (error) => {
      console.error('[Voice] TTS error:', error);
      onError?.(error);
    },
  });
}

/**
 * Stop any ongoing speech or Sarvam audio playback immediately.
 * Call this before navigating to a new screen, opening a modal, or switching
 * languages. Also wired to `NavigationContainer.onStateChange` globally.
 */
export function stopSpeaking(): void {
  stopIndicVoice();
  Speech.stop().catch(() => {});
}

/**
 * Check whether TTS is available on the current device.
 */
export async function isTtsSupported(): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.length > 0;
  } catch {
    return false;
  }
}