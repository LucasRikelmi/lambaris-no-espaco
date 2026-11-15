import { cn } from "@/lib/utils";
import { NAV, type View } from "./nav";

export function MobileNav({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
    >
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
              "flex flex-col items-center gap-1 py-2 text-[10px] font-semibold transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
