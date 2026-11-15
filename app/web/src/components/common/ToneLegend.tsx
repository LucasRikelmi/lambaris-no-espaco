import { TONE_ICON, TONE_TEXT, type Tone } from "./state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ITEMS: { tone: Tone; label: string; hint: string }[] = [
  { tone: "ok", label: "Normal", hint: "Dentro do esperado." },
  { tone: "warn", label: "Atenção", hint: "Fora do limite, mas sem alarme crítico ainda." },
  { tone: "crit", label: "Crítico", hint: "Alarme disparado ou limite de risco." },
  { tone: "info", label: "Informativo", hint: "Aviso técnico ou verificação, sem risco imediato." },
  { tone: "na", label: "Sem dado", hint: "Leitura ausente. Ausente não é normal." }
];

export function ToneLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)} aria-label="Legenda de estados">
      {ITEMS.map(({ tone, label, hint }) => {
        const Icon = TONE_ICON[tone];
        return (
          <li key={tone}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  <Icon className={cn("size-3", TONE_TEXT[tone])} aria-hidden /> {label}
                </span>
              </TooltipTrigger>
              <TooltipContent>{hint}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
