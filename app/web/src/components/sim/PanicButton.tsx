import { AlertOctagon, Mic, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSimEngine } from "@/lib/sim/store";

export function PanicButton() {
  const engine = useSimEngine();

  return (
    <Card className="border-crit/40" role="region" aria-label="Ação imediata da tripulação">
      <CardContent className="flex flex-wrap items-center gap-3 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-crit/50 bg-crit/15 text-crit">
          <AlertOctagon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Ação imediata da tripulação</p>
          <p className="text-[11px] text-muted-foreground">
            Registra o pedido de ajuda na hora, sem depender dos sensores nem da IA. Fica separado dos controles de execução.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button variant="crit" size="lg" onClick={() => engine.manual("panic")} className="grow">
            <HandHeart className="size-4" /> Botão de pânico
          </Button>
          <Button variant="outline" size="lg" onClick={() => engine.manual("voice")} className="grow">
            <Mic className="size-4" /> Comando de voz
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
