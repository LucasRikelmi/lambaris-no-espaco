import { Loader2, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtT } from "@/lib/format";
import { SCEN } from "@/lib/sim/scenarios";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";
import { NAV, type View } from "./nav";

export function HeaderBar({ view }: { view: View }) {
  useSimVersion();
  const engine = useSimEngine();
  const scen = SCEN[engine.scen];
  const item = NAV.find((n) => n.id === view)!;
  const Icon = item.icon;
  const aiDown = engine.aiStatus === "down" || !engine.aiEnabled;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className="size-4 shrink-0 text-primary md:hidden" aria-hidden />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight">{item.label}</h1>
            <p className="truncate text-[11px] text-muted-foreground">{item.hint}</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Badge variant={scen.tone === "crit" ? "crit" : scen.tone === "warn" ? "warn" : scen.tone === "info" ? "info" : "ok"}>
            Cenário · {scen.name}
          </Badge>
          <Badge variant="outline" className="font-mono tabular-nums text-foreground">
            <span className="text-muted-foreground">tempo simulado</span> {fmtT(engine.t)}
          </Badge>
          <Badge variant={engine.running ? "ok" : "outline"}>
            {engine.running ? "Executando" : "Pausado"}
          </Badge>
          {engine.aiCrashed ? (
            <Badge variant="crit">IA em falha</Badge>
          ) : aiDown ? (
            <Badge variant="warn">{engine.aiEnabled ? "IA sem heartbeat" : "IA desligada"}</Badge>
          ) : (
            <Badge variant="info">
              <Loader2 className="size-3" aria-hidden /> IA local pronta
            </Badge>
          )}
          <Button
            size="sm"
            variant={engine.running ? "secondary" : "default"}
            onClick={() => engine.toggleRunning()}
            aria-label={engine.running ? "Pausar execução" : "Retomar execução"}
          >
            {engine.running ? <Pause className="size-4" /> : <Play className="size-4" />}
            <span className="hidden sm:inline">{engine.running ? "Pausar" : "Retomar"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
