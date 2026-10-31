import { useSyncExternalStore } from "react";
import { toSpeech, type Line } from "./munshi";

/**
 * Munshi's voice: the browser's built-in text-to-speech (free, no key, works offline in Chrome).
 * Mute and the voice choice are per-device preferences, so they live in localStorage.
 */
const MUTE_KEY = "munshi-ai:muted";
const VOICE_KEY = "munshi-ai:voice";

/** "en": Indian English reading the Hinglish (the default). "hi": a Hindi voice reading Devanagari. */
export type VoiceChoice = "en" | "hi";

let muted = false;
let voiceChoice: VoiceChoice = "en";
let speaking = false;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
    voiceChoice = localStorage.getItem(VOICE_KEY) === "hi" ? "hi" : "en";
  } catch {
    // Storage blocked: start unmuted.
  }
}

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

const norm = (lang: string) => lang.replace("_", "-").toLowerCase();

/** Prefer Google's voices (most natural in Chrome), then whatever the OS ships. */
function findVoice(lang: (l: string) => boolean) {
  const voices = window.speechSynthesis.getVoices().filter((v) => lang(norm(v.lang)));
  return voices.find((v) => /google/i.test(v.name)) ?? voices[0];
}

const hindiVoice = () => findVoice((l) => l.startsWith("hi"));

/**
 * Indian English with the Hinglish text by default. With "hi" chosen and a Hindi voice on the
 * device (Chrome's "Google हिन्दी", macOS "Lekha"), the Devanagari version instead.
 */
function utterance(line: Line) {
  const hindi = voiceChoice === "hi" ? hindiVoice() : undefined;
  if (hindi) {
    const u = new SpeechSynthesisUtterance(toSpeech(line.hindi, "रुपये"));
    u.voice = hindi;
    u.lang = hindi.lang;
    return u;
  }
  const english = findVoice((l) => l === "en-in");
  const u = new SpeechSynthesisUtterance(toSpeech(line.text));
  if (english) u.voice = english;
  u.lang = english?.lang ?? "en-IN";
  return u;
}

/** `force` is for when the user explicitly asks Munshi to talk, even while muted. */
export function speak(line: Line | string, { force = false } = {}) {
  load();
  if ((muted && !force) || !speechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = utterance(typeof line === "string" ? { text: line, hindi: line } : line);
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

export function setVoiceChoice(value: VoiceChoice) {
  load();
  voiceChoice = value;
  try {
    localStorage.setItem(VOICE_KEY, value);
  } catch {
    // Storage blocked: the choice lasts for this session.
  }
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  // Chrome loads voices late; re-render when they arrive so the Hindi option can appear.
  if (speechSupported()) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", emit);
  }
  return () => {
    listeners.delete(l);
    if (speechSupported()) window.speechSynthesis.removeEventListener?.("voiceschanged", emit);
  };
};

export function useSpeech() {
  load();
  // One number so the snapshot is stable; the server renders 0 (unmuted, silent, unsupported).
  const state = useSyncExternalStore(
    subscribe,
    () =>
      (muted ? 1 : 0) +
      (speaking ? 2 : 0) +
      (speechSupported() ? 4 : 0) +
      (speechSupported() && hindiVoice() ? 8 : 0) +
      (voiceChoice === "hi" ? 16 : 0),
    () => 0,
  );
  return {
    muted: (state & 1) === 1,
    speaking: (state & 2) === 2,
    supported: (state & 4) === 4,
    /** The device has a Hindi voice, so offering the choice makes sense. */
    hindiAvailable: (state & 8) === 8,
    voice: (state & 16) === 16 ? ("hi" as const) : ("en" as const),
  };
}
