import { Activity, MessagesSquare, Play, Radio, Siren, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Step {
  icon: LucideIcon;
  title: string;
  hint: string;
}

const STEPS: Step[] = [
  { icon: Activity, title: "Escolha o cenário", hint: "Define o que os sensores vão mostrar. Reinicia a simulação." },
  { icon: Play, title: "Execute", hint: "Inicie, pause e ajuste a velocidade do tempo simulado." },
  { icon: Radio, title: "Acompanhe os sinais", hint: "Veja o que a tripulação e a cabine estão medindo, ao vivo." },
  { icon: Siren, title: "Abra o evento", hint: "Quando uma regra dispara, veja as evidências na tela Eventos." },
  { icon: MessagesSquare, title: "Pergunte ao assistente", hint: "Peça o resumo e o procedimento indicado, na tela Assistente." }
];

export function FlowGuide() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Como funciona</CardTitle>
        <CardDescription>
          O simulador acompanha uma emergência a bordo passo a passo. A decisão é automática, por regras; a IA só ajuda
          depois, e o caminho crítico nunca depende dela.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/20 p-2.5"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-background font-mono text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{step.hint}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
