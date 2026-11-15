import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TONE_ICON, TONE_TEXT, toneFromSignal } from "@/components/common/state";
import { cn } from "@/lib/utils";
import { MAN, REF, type RuleId } from "@/lib/sim/engine";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";

const BADGE_VARIANT = { ok: "ok", warn: "warn", crit: "crit", info: "info", na: "outline" } as const;

const ORDER: RuleId[] = ["r1", "r2", "r3", "r4", "r5"];

export function RulesPanel() {
  useSimVersion();
  const engine = useSimEngine();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden /> Motor de regras — decisão automática (camada 1)
        </CardTitle>
        <CardDescription>
          Avaliação determinística a cada 250 ms. A detecção não passa pelo modelo de linguagem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {ORDER.map((id) => {
          const rule = engine.rules[id];
          const tone = toneFromSignal(rule.status);
          const Icon = TONE_ICON[tone];
          const showProgress = rule.need > 0 && rule.status !== "ok" && rule.status !== "na";
          const pct = rule.need > 0 ? Math.min(100, (Math.max(0, rule.prog) / rule.need) * 100) : 0;
          return (
            <div key={id} className="rounded-lg border border-border bg-secondary/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Icon className={cn("size-4 shrink-0", TONE_TEXT[tone])} aria-hidden />
                <p className="text-sm font-semibold">{rule.name}</p>
                <Badge variant={BADGE_VARIANT[tone]}>{rule.label}</Badge>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{MAN[id]}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{rule.cond}</p>
              <p className="mt-0.5 text-[10px] italic text-muted-foreground/80">Fonte: {REF[id]}</p>
              {rule.detail ? <p className={cn("mt-1 text-[11px]", TONE_TEXT[tone])}>{rule.detail}</p> : null}
              {showProgress ? <Progress value={pct} className="mt-2" /> : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
