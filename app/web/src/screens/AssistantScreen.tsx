import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Database,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Send,
  Square,
  Volume2
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AiNotice, VoiceNotice } from "@/components/common/notices";
import { SEVERITY, STATE_LABEL } from "@/components/common/state";
import { cn } from "@/lib/utils";
import { fmtT } from "@/lib/format";
import { askAssistant, type AssistantMode } from "@/lib/api";
import { narrator, useNarrator } from "@/lib/narration";
import { dictationSupported, startDictation, type DictationHandle } from "@/lib/dictation";
import type { SimEvent } from "@/lib/sim/engine";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";
import { useNav } from "@/components/shell/nav-context";

const MODES: { id: AssistantMode; label: string; hint: string }[] = [
  { id: "gemma", label: "Gemma 4B · conversa", hint: "Conversa em português sobre o evento." },
  { id: "medgemma", label: "MedGemma 4B · resumo por texto", hint: "Resumo do evento em modo texto." }
];

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function eventSummary(event: SimEvent, rules: ReturnType<typeof useSimEngine>["rules"]): string {
  const rule = event.ruleId ? rules[event.ruleId] : null;
  const signals = event.evidence.map((e) => `${e.label}: ${e.text}`).join("; ");
  return [
    `Evento ${event.id}: ${event.title}`,
    `Severidade: ${SEVERITY[event.severity]?.label ?? event.severity}`,
    `Momento: ${fmtT(event.t)}`,
    `O que aconteceu: ${event.detail}`,
    rule ? `Regra: ${rule.name} — ${rule.cond}` : "Sem regra determinística associada",
    `Sinais: ${signals}`
  ].join("\n");
}

function NarrationControls({ fullText }: { fullText: string }) {
  const narration = useNarrator();
  const active = narration.state === "loading" || narration.state === "playing" || narration.state === "paused" || narration.state === "browser";
  const canReplay = !!narration.lastText || !!fullText;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!canReplay || narration.state === "loading"}
        onClick={() => narrator.replay()}
      >
        <RotateCcw className="size-4" /> Ouvir novamente
      </Button>
      {narration.state === "paused" ? (
        <Button variant="outline" size="sm" onClick={() => narrator.resume()}>
          <Play className="size-4" /> Retomar
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={!active || narration.state === "loading"} onClick={() => narrator.pause()}>
          <Pause className="size-4" /> Pausar
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={!active} onClick={() => narrator.stop()}>
        <Square className="size-4" /> Parar
      </Button>
      {narration.state === "loading" ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
    </div>
  );
}

function AssistantBody() {
  useSimVersion();
  const engine = useSimEngine();
  const nav = useNav();
  const event = engine.selectedEvent;

  const [mode, setMode] = useState<AssistantMode>("gemma");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dictError, setDictError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches
  );

  const handleRef = useRef<DictationHandle | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const messages = event?.assistant.messages ?? [];
  const sources = event?.assistant.sources ?? [];
  const sourcesStatus = event?.assistant.sourcesStatus ?? "";
  const answeredBy = event?.assistant.model ?? "";
  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant")?.text ?? "";

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  useEffect(() => () => handleRef.current?.stop(), []);

  if (!event) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <FileText className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">Nenhum evento selecionado</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Abra um evento na tela de Eventos para conversar com o assistente sobre ele. O contexto fica guardado por
            evento.
          </p>
          <Button variant="outline" size="sm" onClick={() => nav.setView("eventos")}>
            Ir para Eventos <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const severity = SEVERITY[event.severity] ?? SEVERITY.tecnico;

  async function send(question: string) {
    const text = question.trim();
    if (!text || !event || busy) return;
    setSendError("");
    setDraft("");
    const historico = event.assistant.messages
      .filter((m) => m.role !== "sistema")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));
    engine.addAssistantMessage(event.id, { id: uid(), role: "user", text, t: engine.t });
    setBusy(true);
    try {
      const reply = await askAssistant({
        pergunta: text,
        modo: mode,
        evento: eventSummary(event, engine.rules),
        historico
      });
      engine.addAssistantMessage(event.id, {
        id: uid(),
        role: "assistant",
        text: reply.resposta,
        model: reply.modelo,
        t: engine.t
      });
      engine.setAssistantResult(event.id, reply.fontes, reply.status, reply.modelo);
      if (engine.autoRead) void narrator.play(reply.resposta);
    } catch (error) {
      setSendError((error as Error).message);
      engine.addAssistantMessage(event.id, {
        id: uid(),
        role: "sistema",
        text: `${(error as Error).message} Você pode continuar por texto assim que o serviço voltar.`,
        t: engine.t
      });
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (recording) {
      handleRef.current?.stop();
      return;
    }
    setDictError("");
    const handle = startDictation({
      onPartial: (text) => setDraft(text),
      onFinal: (text) => {
        setDraft(text);
        setRecording(false);
      },
      onError: (message) => {
        setDictError(message);
        setRecording(false);
      },
      onEnd: () => setRecording(false)
    });
    if (handle) {
      handleRef.current = handle;
      setRecording(true);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={severity.tone === "crit" ? "crit" : severity.tone === "warn" ? "warn" : "info"}>
                {severity.label}
              </Badge>
              <Badge variant="outline">{STATE_LABEL[event.state]}</Badge>
              <span className="font-mono text-[11px] text-muted-foreground">
                {fmtT(event.t)} · {event.id}
              </span>
            </div>
            <p className="mt-1 truncate text-sm font-semibold">{event.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{event.detail}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => nav.openEvent(event.id)}>
            Ver detalhe do evento <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <AiNotice />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Conversa</CardTitle>
                {answeredBy ? <Badge variant="outline">Respondeu: {answeredBy}</Badge> : null}
              </div>
              <CardDescription>Contexto guardado por evento. O assistente não substitui o julgamento da tripulação.</CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={logRef} className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Faça a primeira pergunta sobre este evento. As fontes consultadas aparecem ao lado.
                  </p>
                ) : null}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      message.role === "user"
                        ? "border-primary/40 bg-primary/10"
                        : message.role === "sistema"
                          ? "border-warn/40 bg-warn/10"
                          : "border-border bg-secondary/30"
                    )}
                  >
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {message.role === "user" ? "Você" : message.role === "sistema" ? "Sistema" : "Assistente"}
                      {message.model ? ` · ${message.model}` : ""}
                    </p>
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                ))}
                {busy ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden /> Consultando o modelo local e o Qdrant…
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Perguntar</CardTitle>
              <CardDescription>
                Ditado e leitura em voz dependem do navegador e dos serviços locais. Se falharem, continue por texto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px] space-y-1">
                  <Label htmlFor="mode">Modelo</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as AssistantMode)}>
                    <SelectTrigger id="mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="max-w-xs text-[11px] text-muted-foreground">{MODES.find((m) => m.id === mode)?.hint}</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="question">Mensagem</Label>
                <Textarea
                  id="question"
                  value={draft}
                  maxLength={1600}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ex.: quais sinais sustentam este evento e o que a regra verificou?"
                  rows={3}
                />
              </div>

              {dictError ? (
                <Alert variant="warn">
                  <Mic />
                  <AlertTitle>Ditado indisponível</AlertTitle>
                  <AlertDescription>{dictError} Escreva a pergunta no campo acima e envie.</AlertDescription>
                </Alert>
              ) : null}
              {sendError ? (
                <Alert variant="crit">
                  <Info />
                  <AlertTitle>Falha ao consultar o assistente</AlertTitle>
                  <AlertDescription>{sendError} O evento e as evidências continuam disponíveis na tela de Eventos.</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={recording ? "crit" : "info"}
                  size="sm"
                  onClick={toggleMic}
                  disabled={!dictationSupported() && !recording}
                  aria-pressed={recording}
                >
                  {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
                  {recording ? "Parar gravação" : "Falar pergunta"}
                </Button>
                <Button size="sm" onClick={() => void send(draft)} disabled={busy || !draft.trim()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar
                </Button>
                <div className="ml-auto flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                  <Volume2 className="size-4 text-info" />
                  <Label htmlFor="autoread" className="cursor-pointer text-[10px]">
                    Ler respostas completas
                  </Label>
                  <Switch id="autoread" checked={engine.autoRead} onCheckedChange={(v) => engine.setAutoRead(v)} />
                </div>
              </div>

              {recording ? (
                <p className="text-[11px] text-info">
                  Gravando… Fale a pergunta. A transcrição aparece no campo e fica editável antes do envio.
                </p>
              ) : null}

              <VoiceNotice />

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <NarrationControls fullText={lastAnswer} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
              <CardHeader className="pb-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="size-4 text-primary" aria-hidden /> Fontes consultadas
                    </CardTitle>
                    <CardDescription>Trechos recuperados no Qdrant pelo assistente.</CardDescription>
                  </div>
                  <ChevronDown className={cn("size-4 shrink-0 transition-transform", sourcesOpen && "rotate-180")} aria-hidden />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-2">
                  {sourcesStatus ? (
                    <Alert variant="warn">
                      <Info />
                      <AlertTitle>Busca vetorial</AlertTitle>
                      <AlertDescription>{sourcesStatus}</AlertDescription>
                    </Alert>
                  ) : null}
                  {sources.map((source) => (
                    <div key={source.id} className="rounded-md border border-border bg-secondary/20 p-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          ID {source.id}
                        </Badge>
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold">{source.titulo}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{source.texto}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ExternalLink className="size-3" aria-hidden /> origem: procedimentos.json (material fictício do
                        protótipo)
                      </p>
                    </div>
                  ))}
                  {!sources.length && !sourcesStatus ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma consulta feita ainda. Envie uma pergunta para recuperar trechos.
                    </p>
                  ) : null}
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Os procedimentos são fictícios (MED-RCP-01, MED-RESP-02, AMB-CO2-01, MED-TRAUMA-03, TEC-ELEIT-01) e
                    servem só para o exercício.
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function AssistantScreen() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <AssistantBody />
    </div>
  );
}
