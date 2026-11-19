/**
 * Centralized audio playback guard
 * --------------------------------
 * All spoken output in the app (expo-speech TTS and Sarvam Bulbul files) is
 * controlled from here. The important part is the `generation` token:
 *
 * TTS such as Sarvam Bulbul is asynchronous — we first download/synthesize a
 * file and only then start a player. If a user taps another button or
 * navigates while that network request is in flight, the old code created a
 * player *after* the navigation guard had already run, so audio kept playing.
 *
 * Every new playback request bumps the generation and stops everything that
 * is currently playing. Any request that comes back after a newer request is
 * discarded. This makes "click / navigate stops audio" reliable.
 */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

let generation = 0;
const activePlayers = new Set<AudioPlayer>();

function disposePlayer(player: AudioPlayer): void {
  try {
    player.pause();
  } catch {
    /* player may already be released by the OS */
  }
  try {
    // SDK 58 exposes remove() on both native and web AudioPlayer.
    player.remove();
  } catch {
    /* already removed */
  }
}

/** Stop every audio engine and invalidate all in-flight playback requests. */
export function stopAllAudio(): void {
  generation += 1;

  for (const player of Array.from(activePlayers)) {
    activePlayers.delete(player);
    disposePlayer(player);
  }

  // Voice.stop() also clears the queued utterances, not just the current one.
  try {
    void Speech.stop().catch(() => {});
  } catch {
    /* TTS unavailable on this device */
  }
}

/**
 * Call this synchronously at the start of a playback action.
 * Returns the token that must be checked again after any `await`.
 */
export function beginAudioRequest(): number {
  stopAllAudio();
  return generation;
}

/** True while the request is still the most recent one. */
export function isAudioRequestCurrent(token: number): boolean {
  return token === generation;
}

/**
 * Create a player only if the request has not been superseded.
 * Returns null when a newer click/navigation already cancelled this playback.
 */
export function createGuardedPlayer(uri: string, token: number): AudioPlayer | null {
  if (!isAudioRequestCurrent(token)) return null;

  let player: AudioPlayer;
  try {
    player = createAudioPlayer({ uri });
  } catch (error) {
    console.error('[Audio] Could not create player:', error);
    return null;
  }

  if (!isAudioRequestCurrent(token)) {
    disposePlayer(player);
    return null;
  }

  activePlayers.add(player);
  return player;
}
