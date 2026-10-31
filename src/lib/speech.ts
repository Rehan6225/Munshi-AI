import { useSyncExternalStore } from "react";
import { toSpeech } from "./munshi";

/**
 * Munshi's voice: the browser's built-in text-to-speech (free, no key, works offline in Chrome).
 * Mute is a per-device preference, so it lives in localStorage.
 */
const MUTE_KEY = "munshi-ai:muted";

let muted = false;
let speaking = false;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // Storage blocked: start unmuted.
  }
}

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Indian English reads Hinglish best; Hindi next; otherwise the default voice. */
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-IN") ??
    voices.find((v) => v.lang.replace("_", "-") === "en-IN") ??
    voices.find((v) => v.lang.startsWith("hi")) ??
    undefined
  );
}

/** `force` is for when the user explicitly asks Munshi to talk, even while muted. */
export function speak(text: string, { force = false } = {}) {
  load();
  if ((muted && !force) || !speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(toSpeech(text));
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? "en-IN";
  utter.rate = 1.02;
  utter.onstart = () => {
    speaking = true;
    emit();
  };
  utter.onend = utter.onerror = () => {
    speaking = false;
    emit();
  };
  synth.speak(utter);
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
  speaking = false;
  emit();
}

export function setMuted(value: boolean) {
  load();
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts for this session.
  }
  if (value) stopSpeaking();
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  // Chrome loads voices late; nothing to re-render, but warm the list up.
  if (speechSupported()) window.speechSynthesis.getVoices();
  return () => listeners.delete(l);
};

export function useSpeech() {
  load();
  // One number so the snapshot is stable; the server renders 0 (unmuted, silent, unsupported).
  const state = useSyncExternalStore(
    subscribe,
    () => (muted ? 1 : 0) + (speaking ? 2 : 0) + (speechSupported() ? 4 : 0),
    () => 0,
  );
  return { muted: (state & 1) === 1, speaking: (state & 2) === 2, supported: (state & 4) === 4 };
}
