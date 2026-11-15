import { BellOff, Check, Siren, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtT } from "@/lib/format";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";
import { useNav } from "./nav-context";

export function AlarmBanner() {
  useSimVersion();
  const engine = useSimEngine();
  const nav = useNav();
  const alarm = engine.activeAlarm;
  if (!alarm) return null;

  const rule = alarm.ruleId ? engine.rules[alarm.ruleId] : null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`border-b border-crit/50 bg-crit/10 ${alarm.ack || alarm.muted ? "" : "animate-alarm-pulse"}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-crit/50 bg-crit/15 text-crit">
          <Siren className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-crit">ALARME CRÍTICO (SIMULADO) · {alarm.title}</p>
          <p className="text-xs text-crit/80">
            Disparado em {fmtT(alarm.t)} {rule ? `pela regra "${rule.name}"` : ""}. Avisados: {alarm.scope}.
            {alarm.ack ? " Reconhecido: som silenciado, evento continua aberto." : ""}
            {alarm.muted ? " Aviso silenciado temporariamente." : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="crit" size="sm" onClick={() => nav.openEvent(alarm.id)}>
            <Siren className="size-4" /> Abrir evento
          </Button>
          <Button variant="secondary" size="sm" onClick={() => engine.acknowledge(alarm.id)} disabled={alarm.ack}>
            <Check className="size-4" /> Reconhecer
          </Button>
          <Button variant="outline" size="sm" onClick={() => engine.mute(alarm.id)} disabled={alarm.muted}>
            {alarm.muted ? <VolumeX className="size-4" /> : <BellOff className="size-4" />} Silenciar
          </Button>
        </div>
      </div>
    </div>
  );
}
