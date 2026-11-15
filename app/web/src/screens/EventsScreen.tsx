import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  FileCheck2,
  HandHeart,
  MessageCircle,
  Siren,
  VolumeX
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { SEVERITY, STATE_LABEL, TONE_ICON, TONE_TEXT } from "@/components/common/state";
import { cn } from "@/lib/utils";
import { fmtT } from "@/lib/format";
import { SCEN } from "@/lib/sim/scenarios";
import { SIGNALS } from "@/lib/sim/signals";
import { MAN, type ActionEntry, type EventState, type SimEvent } from "@/lib/sim/engine";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";
import { useNav } from "@/components/shell/nav-context";

const SEVERITIES = ["critico", "aviso", "tecnico", "verificacao"] as const;
const STATES: EventState[] = ["aberto", "reconhecido", "silenciado", "encerrado"];

const ACTION_META: Record<ActionEntry["type"], { label: string; icon: typeof Check }> = {
  reconhecer: { label: "Reconhecimento do aviso", icon: Check },
  silenciar: { label: "Silenciamento do aviso", icon: VolumeX },
  revisar: { label: "Revisão registrada", icon: FileCheck2 },
  abrir: { label: "Evento aberto", icon: Eye },
  ajuda: { label: "Pedido de ajuda", icon: HandHeart },
  confirmou: { label: "Resposta do tripulante", icon: MessageCircle }
};

function severityBadge(event: SimEvent) {
  const meta = SEVERITY[event.severity] ?? SEVERITY.tecnico;
  const Icon = TONE_ICON[meta.tone];
  const variant = meta.tone === "crit" ? "crit" : meta.tone === "warn" ? "warn" : "info";
  return (
    <Badge variant={variant}>
      <Icon aria-hidden /> {meta.label}
    </Badge>
  );
}

function EventListItem({ event, active, onSelect }: { event: SimEvent; active: boolean; onSelect: () => void }) {
  const engine = useSimEngine();
  const rule = event.ruleId ? engine.rules[event.ruleId] : null;
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border p-2.5 text-left transition-colors",
        active ? "border-primary/50 bg-primary/10" : "border-border bg-secondary/20 hover:border-primary/50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{fmtT(event.t)}</span>
        <Badge variant="outline">{STATE_LABEL[event.state]}</Badge>
      </div>
      <p className="mt-1 line-clamp-2 text-xs font-semibold">{event.title}</p>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
        {rule ? `Regra: ${rule.name}` : "Sem regra associada"} · {event.id}
      </p>
    </button>
  );
}

function EventDetail({ event, onBack }: { event: SimEvent; onBack: () => void }) {
  const engine = useSimEngine();
  const nav = useNav();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState("");
  const rule = event.ruleId ? engine.rules[event.ruleId] : null;
  const sceneTitle = SCEN[engine.scen].name;

  const timeline = [...event.timeline].sort((a, b) => a.t - b.t);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" /> Voltar à lista
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {severityBadge(event)}
          <Badge variant="outline">{STATE_LABEL[event.state]}</Badge>
          <span className="font-mono text-[11px] text-muted-foreground">
            {fmtT(event.t)} · {event.id}
          </span>
        </div>
        <CardTitle className="text-lg">{event.title}</CardTitle>
        <CardDescription>
          Cenário “{sceneTitle}”. Avisados: {event.scope}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={() => engine.acknowledge(event.id)} disabled={event.ack}>
            <Check className="size-4" /> Reconhecer
          </Button>
          <Button variant="outline" size="sm" onClick={() => engine.mute(event.id)} disabled={event.muted}>
            <VolumeX className="size-4" /> Silenciar
          </Button>
          <Button
            variant="info"
            size="sm"
            onClick={() => {
              engine.selectEvent(event.id);
              nav.setView("assistente");
            }}
          >
            <MessageCircle className="size-4" /> Perguntar ao assistente
          </Button>
          <Button variant="ok" size="sm" onClick={() => setReviewOpen(true)} disabled={event.reviewed}>
            <FileCheck2 className="size-4" /> Registrar revisão
          </Button>
        </div>

        <Separator />

        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">1. O que aconteceu</h3>
          <p className="mt-1.5 text-sm">{event.detail}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Registrado em {fmtT(event.t)} de tempo simulado, no escopo “{event.scope}”.
          </p>
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">2. Qual regra disparou</h3>
          {rule ? (
            <div className="mt-1.5 rounded-md border border-border bg-secondary/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{rule.name}</p>
                <Badge variant="outline" className="font-mono">
                  {MAN[rule.id]}
                </Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{rule.cond}</p>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Evento sem regra determinística associada (watchdog ou diagnóstico de serviço).
            </p>
          )}
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            3. Quais sinais sustentam o evento
          </h3>
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {event.evidence.map((signal) => {
              const tone = signal.state === "ok" ? "ok" : signal.state === "warn" ? "warn" : signal.state === "crit" ? "crit" : "na";
              const Icon = TONE_ICON[tone];
              return (
                <li
                  key={signal.key}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border bg-secondary/20 px-2.5 py-1.5",
                    signal.state === "ok" ? "border-border" : "border-warn/40"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className={cn("size-3.5 shrink-0", TONE_TEXT[tone])} aria-hidden />
                    <span className="truncate text-xs text-muted-foreground">{SIGNALS[signal.key].short}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">{signal.text}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            4. Quais ações já foram registradas
          </h3>
          {event.actions.length ? (
            <ul className="mt-1.5 space-y-1.5">
              {event.actions.map((action, i) => {
                const meta = ACTION_META[action.type];
                const Icon = meta.icon;
                return (
                  <li key={`${action.type}-${i}`} className="flex gap-2 text-xs">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden />
                    <span className="w-28 shrink-0 text-muted-foreground">{meta.label}</span>
                    <span className="flex-1">
                      {action.label}
                      {action.note ? <em className="text-muted-foreground"> — “{action.note}”</em> : null}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{fmtT(action.t)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">Nenhuma ação registrada ainda.</p>
          )}

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Linha do tempo</p>
          <ol className="mt-1.5 space-y-1.5">
            {timeline.map((entry, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="w-16 shrink-0 font-mono text-muted-foreground">{fmtT(entry.t)}</span>
                <span className={cn(entry.crit ? "font-semibold text-crit" : entry.action ? "text-info" : "text-foreground")}>
                  {entry.text}
                </span>
              </li>
            ))}
            {timeline.length === 0 ? <li className="text-xs text-muted-foreground">Sem marcos registrados.</li> : null}
          </ol>
        </section>
      </CardContent>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar revisão</DialogTitle>
            <DialogDescription>
              A revisão encerra o evento e entra no relatório de simulação. Fica separada do reconhecimento e do
              silenciamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="note">Nota da revisão</Label>
            <Textarea
              id="note"
              value={note}
              maxLength={600}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: conferido com a tripulação; sinais revisados e coerentes com o cenário."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="ok"
              onClick={() => {
                engine.review(event.id, note.trim());
                setNote("");
                setReviewOpen(false);
              }}
            >
              <FileCheck2 className="size-4" /> Salvar revisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function EventsScreen({
  mobileDetail,
  onOpenDetail,
  onBackToList
}: {
  mobileDetail: boolean;
  onOpenDetail: () => void;
  onBackToList: () => void;
}) {
  useSimVersion();
  const engine = useSimEngine();
  const nav = useNav();
  const [severity, setSeverity] = useState<string>("all");
  const [state, setState] = useState<string>("all");

  const events = engine.events
    .filter((e) => (severity === "all" ? true : e.severity === severity))
    .filter((e) => (state === "all" ? true : e.state === state))
    .slice()
    .sort((a, b) => b.t - a.t);

  const selected =
    engine.selectedEvent && events.some((e) => e.id === engine.selectedEventId)
      ? engine.selectedEvent
      : events[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className={cn(mobileDetail && "hidden lg:block")}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Eventos</CardTitle>
              <CardDescription>Ordenados por tempo simulado, do mais recente ao mais antigo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="filter-sev">Tipo</Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger id="filter-sev">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SEVERITY[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="filter-state">Estado</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger id="filter-state">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {events.length ? (
                <ScrollArea className="h-[60vh] pr-2 lg:h-[calc(100vh-22rem)]">
                  <div className="space-y-2">
                    {events.map((event) => (
                      <EventListItem
                        key={event.id}
                        event={event}
                        active={selected?.id === event.id}
                        onSelect={() => {
                          engine.selectEvent(event.id);
                          onOpenDetail();
                        }}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nenhum evento com esses filtros. Rode um cenário na tela de Simulação.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn(!mobileDetail && "hidden lg:block")}>
          {selected ? (
            <EventDetail event={selected} onBack={onBackToList} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Siren className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-semibold">Nenhum evento selecionado</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Escolha um cenário na tela de Simulação. Quando uma regra disparar, o evento aparece aqui com as
                  evidências e as ações registradas.
                </p>
                <Button variant="outline" size="sm" onClick={() => nav.setView("simulacao")}>
                  Ir para Simulação <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
