interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictationSupported(): boolean {
  return typeof window !== "undefined" && !!getCtor();
}

export interface DictationHandle {
  stop(): void;
}

export function startDictation(handlers: {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): DictationHandle | null {
  const Ctor = getCtor();
  if (!Ctor) {
    handlers.onError("Transcrição não existe neste navegador. Digite a pergunta.");
    return null;
  }
  const session = new Ctor();
  session.lang = "pt-BR";
  session.continuous = false;
  session.interimResults = true;
  session.onresult = (event) => {
    let partial = "";
    for (let i = 0; i < event.results.length; i++) {
      partial += event.results[i][0].transcript;
    }
    handlers.onPartial(partial.slice(0, 1600));
    const last = event.results[event.results.length - 1];
    if (last && last.isFinal) handlers.onFinal(partial.slice(0, 1600));
  };
  session.onerror = (event) => {
    const map: Record<string, string> = {
      "not-allowed": "Permissão do microfone negada. Você pode digitar a pergunta.",
      "service-not-allowed": "Permissão do microfone negada. Você pode digitar a pergunta.",
      "no-speech": "Nada foi ouvido. Tente de novo ou digite a pergunta.",
      network: "Falha na transcrição. Digite a pergunta em vez de falar."
    };
    handlers.onError(map[event.error] ?? "Falha na transcrição. Digite a pergunta.");
  };
  session.onend = () => handlers.onEnd();
  try {
    session.start();
  } catch {
    handlers.onError("Não foi possível iniciar o microfone.");
    return null;
  }
  return {
    stop: () => {
      try {
        session.stop();
      } catch {
        /* já parado */
      }
    }
  };
}
