import { ArrowRight, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TONE_ICON, TONE_TEXT, toneFromSignal } from "@/components/common/state";
import { fmtT } from "@/lib/format";
import { SCEN } from "@/lib/sim/scenarios";
import { SIGNALS } from "@/lib/sim/signals";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";
import { useNav } from "@/components/shell/nav-context";

export function PromptCard() {
  useSimVersion();
  const engine = useSimEngine();
  const prompt = engine.prompt;
  if (!prompt) return null;
  const remaining = Math.max(0, prompt.dur - (engine.t - prompt.t0));

  return (
    <Card className="border-warn/50 bg-warn/10">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-warn">Marina, você está bem?</p>
          <p className="text-xs text-warn/80">
            {prompt.why} Sem resposta, o alarme crítico dispara sozinho.
          </p>
        </div>
        <span className="font-mono text-2xl font-bold tabular-nums text-warn">{remaining.toFixed(0)} s</span>
        <div className="flex gap-2">
          <Button variant="ok" onClick={() => engine.answer(true)}>
            Estou bem
          </Button>
          <Button variant="crit" onClick={() => engine.answer(false)}>
            Preciso de ajuda
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ActiveEventCard() {
  useSimVersion();
  const engine = useSimEngine();
  const nav = useNav();
  const alarm = engine.activeAlarm;
  if (!alarm) return null;

  const rule = alarm.ruleId ? engine.rules[alarm.ruleId] : null;
  const involved = alarm.evidence.filter((e) => e.state !== "ok");
  const evidence = involved.length ? involved : alarm.evidence.filter((e) => SCEN[engine.scen].focus.includes(e.key));

  return (
    <Card className="border-crit/50 bg-crit/10">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-crit/50 bg-crit/15 text-crit">
            <Siren className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-crit">Regra disparada</p>
            <p className="text-base font-bold text-crit">
              {rule ? rule.name : "Evento"} · {alarm.title}
            </p>
            <p className="text-xs text-crit/80">
              {alarm.detail} Disparado em {fmtT(alarm.t)}. Avisados: {alarm.scope}.
            </p>
          </div>
          <Button variant="crit" onClick={() => nav.openEvent(alarm.id)}>
            Abrir evento <ArrowRight className="size-4" />
          </Button>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sinais envolvidos</p>
          <ul className="flex flex-wrap gap-2">
            {evidence.map((e) => {
              const tone = toneFromSignal(e.state);
              const Icon = TONE_ICON[tone];
              const meta = SIGNALS[e.key];
              return (
                <li
                  key={e.key}
                  className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs"
                >
                  <Icon className={`size-3.5 ${TONE_TEXT[tone]}`} aria-hidden />
                  <span className="text-muted-foreground">{meta.short}</span>
                  <span className="font-mono font-semibold tabular-nums">{e.text}</span>
                </li>
              );
            })}
            {evidence.length === 0 ? <li className="text-xs text-muted-foreground">Nenhum sinal fora do esperado no instante do disparo.</li> : null}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
