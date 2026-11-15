import { FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ORDER, SCEN, type Scenario } from "@/lib/sim/scenarios";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";
import { TONE_TEXT } from "@/components/common/state";

const TONE_RING: Record<Scenario["tone"], string> = {
  ok: "border-ok/50 bg-ok/10",
  warn: "border-warn/50 bg-warn/10",
  crit: "border-crit/50 bg-crit/10",
  info: "border-info/50 bg-info/10"
};

export function ScenarioSection() {
  useSimVersion();
  const engine = useSimEngine();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-muted-foreground" aria-hidden /> Cenários
          </CardTitle>
          <CardDescription>Escolher um cenário reinicia a simulação.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {ORDER.map((id) => {
            const s = SCEN[id];
            const active = id === engine.scen;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => engine.setScenario(id)}
                className={cn(
                  "flex min-h-[84px] flex-col gap-1 rounded-lg border p-2.5 text-left transition-colors",
                  active ? TONE_RING[s.tone] : "border-border bg-secondary/40 hover:border-primary/50"
                )}
              >
                <span className={cn("text-[9.5px] font-bold uppercase tracking-[0.12em]", TONE_TEXT[s.tone])}>{s.tag}</span>
                <b className="text-[13px] leading-tight">{s.name}</b>
                <small className="text-[11px] leading-snug text-muted-foreground">{s.short}</small>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
