import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOC } from "@/lib/sim/scenarios";
import { useSimVersion, useSimEngine } from "@/lib/sim/store";
import { NAV, type View } from "./nav";

export function Sidebar({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  useSimVersion();
  const engine = useSimEngine();

  return (
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col gap-6 border-r border-border bg-card p-4 md:flex">
      <div className="flex items-center gap-2.5 px-1.5">
        <span className="grid size-9 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary">
          <Compass className="size-5" />
        </span>
        <span>
          <b className="block text-sm tracking-wide">LAMBARIS</b>
          <small className="block text-[10px] tracking-[0.14em] text-muted-foreground">NO ESPAÇO</small>
        </span>
      </div>

      <div>
        <p className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">CENTRO DE MISSÃO</p>
        <nav aria-label="Telas do simulador" className="flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.id === view;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] transition-colors",
                  active ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto rounded-lg border border-border bg-secondary/40 p-3">
        <small className="text-[10px] tracking-[0.14em] text-muted-foreground">MISSÃO AURORA</small>
        <b className="mt-0.5 block text-xl">Dia 042 / 180</b>
        <div className="my-2 h-1 overflow-hidden rounded-full bg-border">
          <i className="block h-full w-[23%] bg-primary" />
        </div>
        <span className="text-[11px] text-muted-foreground">{LOC[engine.loc].side}</span>
      </div>
    </aside>
  );
}
