export interface AssistantSource {
  id: number | string;
  titulo: string;
  texto: string;
}

export interface AssistantReply {
  resposta: string;
  fontes: AssistantSource[];
  modelo: string;
  status: string;
}

export interface ServiceState {
  ok: boolean;
  detail: string;
}

export interface ServiceStatus {
  ollama: ServiceState;
  qdrant: ServiceState;
  voz: ServiceState;
  provider: string;
}

export type AssistantMode = "gemma" | "medgemma";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw new ApiError("Não foi possível falar com o servidor local. Verifique se ele está em execução.", 0);
  }
  if (!response.ok) {
    let message = response.status === 503 ? "Integração indisponível. Confira a configuração do serviço." : "Falha na solicitação.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* resposta sem JSON */
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

export function askAssistant(input: {
  pergunta: string;
  modo: AssistantMode;
  evento: string;
  historico: { role: "user" | "assistant"; content: string }[];
}): Promise<AssistantReply> {
  return post<AssistantReply>("/api/assistente", input);
}

export async function synthesize(texto: string, signal?: AbortSignal): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch("/api/voz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
      signal
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("Serviço de voz indisponível.", 0);
  }
  if (!response.ok) {
    let message = "Serviço de voz indisponível.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* sem JSON */
    }
    throw new ApiError(message, response.status);
  }
  return await response.blob();
}

export async function fetchStatus(): Promise<ServiceStatus | null> {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) return null;
    return (await response.json()) as ServiceStatus;
  } catch {
    return null;
  }
}
