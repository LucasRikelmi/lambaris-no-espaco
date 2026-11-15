import { useSyncExternalStore } from "react";
import { synthesize } from "./api";

export type NarrationState = "idle" | "loading" | "playing" | "paused" | "browser" | "error";

export interface NarrationSnapshot {
  state: NarrationState;
  message: string;
  hasAudio: boolean;
  lastText: string;
}

class Narrator {
  private state: NarrationState = "idle";
  private message = "";
  private lastText = "";
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private controller: AbortController | null = null;
  private listeners = new Set<() => void>();
  private snapshot: NarrationSnapshot = { state: "idle", message: "", hasAudio: false, lastText: "" };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): NarrationSnapshot => this.snapshot;

  private emit() {
    this.snapshot = { state: this.state, message: this.message, hasAudio: !!this.lastText, lastText: this.lastText };
    this.listeners.forEach((fn) => fn());
  }

  private release() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onpause = null;
      this.audio = null;
    }
  }

  private browserSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private speakBrowser(text: string) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.onend = () => {
      if (this.state === "browser") {
        this.state = "idle";
        this.message = "";
        this.emit();
      }
    };
    this.state = "browser";
    this.message = "Voz do navegador em uso (Voice Studio indisponível).";
    this.emit();
    window.speechSynthesis.speak(utterance);
  }

  async play(text: string) {
    this.stop();
    this.lastText = text;
    this.controller = new AbortController();
    const ctrl = this.controller;
    this.state = "loading";
    this.message = "Preparando o áudio no Voice Studio…";
    this.emit();
    try {
      const blob = await synthesize(text, ctrl.signal);
      if (ctrl.signal.aborted) return;
      this.objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.objectUrl);
      this.audio = audio;
      const done = () => {
        this.release();
        if (this.state === "playing" || this.state === "loading") {
          this.state = "idle";
          this.message = "";
          this.emit();
        }
      };
      audio.onended = done;
      audio.onerror = done;
      await audio.play();
      this.state = "playing";
      this.message = "Narrando pelo Voice Studio.";
      this.emit();
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      this.release();
      if (this.browserSupported()) {
        this.speakBrowser(text);
      } else {
        this.state = "error";
        this.message = "Serviço de voz indisponível e a voz do navegador não existe neste navegador.";
        this.emit();
      }
    }
  }

  replay() {
    if (this.lastText) void this.play(this.lastText);
  }

  pause() {
    if (this.state === "playing" && this.audio) {
      this.audio.pause();
      this.state = "paused";
      this.message = "Narração pausada.";
      this.emit();
    } else if (this.state === "browser" && this.browserSupported()) {
      window.speechSynthesis.pause();
      this.state = "paused";
      this.message = "Narração pausada (voz do navegador).";
      this.emit();
    }
  }

  resume() {
    if (this.state === "paused") {
      if (this.audio) {
        void this.audio.play();
        this.state = "playing";
        this.message = "Narrando pelo Voice Studio.";
      } else if (this.browserSupported()) {
        window.speechSynthesis.resume();
        this.state = "browser";
        this.message = "Voz do navegador em uso (Voice Studio indisponível).";
      }
      this.emit();
    }
  }

  stop() {
    this.controller?.abort();
    this.controller = null;
    if (this.audio) {
      this.audio.pause();
    }
    if (this.browserSupported()) window.speechSynthesis.cancel();
    this.release();
    this.state = "idle";
    this.message = "";
    this.emit();
  }

  get isBusy() {
    return this.state === "loading" || this.state === "playing" || this.state === "paused" || this.state === "browser";
  }
}

export const narrator = new Narrator();

export function useNarrator(): NarrationSnapshot {
  return useSyncExternalStore(narrator.subscribe, narrator.getSnapshot, narrator.getSnapshot);
}
