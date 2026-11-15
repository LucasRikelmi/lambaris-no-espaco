import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtT } from "@/lib/format";
import { KIND, REF, RULE_DEF, SOURCES, type LayerKey, type RuleId } from "@/lib/sim/engine";
import { SCEN } from "@/lib/sim/scenarios";
import { THRESHOLDS } from "@/lib/sim/signals";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";

const TONE_DOT: Record<string, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  info: "text-info",
  na: "text-muted-foreground"
};

function LayerStrip() {
  useSimVersion();
  const engine = useSimEngine();
  const rows: { key: string; label: string; tone: string; detail: string }[] = [
    { key: "c1", label: KIND.c1, tone: "ok", detail: "Avalia as 5 regras a cada 250 ms." },
    {
      key: "c2",
      label: KIND.c2,
      tone: engine.chips.luz ? "crit" : "na",
      detail: engine.chips.luz
        ? `Alarme local disparado. ${Object.values(engine.chips).filter(Boolean).length} de 5 canais confirmados.`
        : "Aguardando disparo do alarme local."
    },
    {
      key: "c3",
      label: KIND.c3,
      tone: engine.aiStatus === "down" || !engine.aiEnabled ? "info" : "ok",
      detail:
        engine.aiStatus === "down" || !engine.aiEnabled
          ? "IA indisponível: usa o checklist estático da regra, sem atrasar o alarme."
          : "IA local ativa, entra sempre depois do alarme."
    }
  ];

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key} className="flex items-start gap-3 rounded-md border border-border bg-secondary/20 p-2.5">
          <span className={cn("mt-1 size-2 shrink-0 rounded-full bg-current", TONE_DOT[row.tone])} aria-hidden />
          <div>
            <p className="text-xs font-semibold">{row.label}</p>
            <p className="text-[11px] text-muted-foreground">{row.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function WatchdogTable() {
  useSimVersion();
  const engine = useSimEngine();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Processo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Detalhe</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {engine.watchdogRows().map((row) => (
          <TableRow key={row.name}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>
              <span className={cn("font-semibold uppercase", TONE_DOT[row.state] ?? "text-muted-foreground")}>{row.state}</span>
            </TableCell>
            <TableCell className="text-muted-foreground">{row.detail}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TimelineList() {
  useSimVersion();
  const engine = useSimEngine();
  const rows = [...engine.tl].slice(-60).reverse();
  return (
    <ol className="space-y-1.5">
      {rows.map((entry, i) => (
        <li key={`${entry.t}-${i}`} className="flex gap-2 text-xs">
          <span className="w-16 shrink-0 font-mono text-muted-foreground">{fmtT(entry.t)}</span>
          <span className="w-20 shrink-0 text-muted-foreground">{KIND[entry.layer as LayerKey]}</span>
          <span className={cn(entry.crit ? "font-semibold text-crit" : entry.action ? "text-info" : "text-foreground")}>
            {entry.text}
          </span>
        </li>
      ))}
      {rows.length === 0 ? <li className="text-xs text-muted-foreground">Sem registros ainda.</li> : null}
    </ol>
  );
}

function L3Output() {
  useSimVersion();
  const engine = useSimEngine();
  const event = engine.selectedEvent;
  const l3 = event?.l3;
  if (!event || !l3) {
    return <p className="text-xs text-muted-foreground">Nenhum evento com camada 3 ainda. Dispare um cenário crítico.</p>;
  }
  const steps = [
    { key: "check", label: "Checklist recuperado" },
    { key: "summary", label: "Resumo do histórico" },
    { key: "report", label: "Rascunho de relatório" }
  ] as const;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Modo: {l3.mode === "ia" ? "modelo local (IA)" : "fallback estático"} · evento {event.id}.
      </p>
      {steps.map(({ key, label }) => {
        const step = l3.steps[key];
        return (
          <div key={key} className="rounded-md border border-border bg-secondary/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            {step?.items ? (
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs">
                {step.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {step?.text ? <pre className="mt-1.5 whitespace-pre-wrap font-sans text-xs">{step.text}</pre> : null}
            {step?.src ? <p className="mt-1.5 text-[10px] text-muted-foreground">{step.src}</p> : null}
            {!step ? <p className="mt-1.5 text-xs text-muted-foreground">Aguardando…</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function SqlLog() {
  useSimVersion();
  const engine = useSimEngine();
  const rows = [...engine.sql].slice(-20).reverse();
  return (
    <pre className="max-h-64 overflow-auto rounded-md border border-border bg-secondary/30 p-3 font-mono text-[11px] leading-relaxed">
      {rows.length ? rows.join("\n") : "Sem comandos registrados."}
    </pre>
  );
}

export function DetailsSection() {
  useSimVersion();
  const engine = useSimEngine();
  const exp = SCEN[engine.scen].exp;

  return (
    <Card>
      <CardContent className="p-2">
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="params">
            <AccordionTrigger className="px-2">Parâmetros das regras</AccordionTrigger>
            <AccordionContent className="px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Regra</TableHead>
                    <TableHead>Condição</TableHead>
                    <TableHead>Persistência</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {THRESHOLDS.map((row) => (
                    <TableRow key={row.rule + row.cond}>
                      <TableCell className="font-medium">{row.rule}</TableCell>
                      <TableCell className="text-muted-foreground">{row.cond}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{row.persist}</TableCell>
                      <TableCell className={cn("font-semibold", TONE_DOT[row.tone])}>{row.result}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {(Object.keys(RULE_DEF) as RuleId[]).map((id) => (
                  <li key={id} className="rounded-md border border-border bg-secondary/20 p-2 text-[11px]">
                    <b>{RULE_DEF[id].name}</b>
                    <span className="block font-mono text-muted-foreground">{RULE_DEF[id].cond}</span>
                    <span className="mt-0.5 block text-[10px] italic text-muted-foreground/80">Fonte: {REF[id]}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">Fontes dos dados</p>
                <ul className="space-y-1.5">
                  {SOURCES.map((src) => (
                    <li key={src.key} className="rounded-md border border-border bg-secondary/20 p-2 text-[11px]">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {src.key} — {src.title}
                      </a>
                      <span className="mt-0.5 block text-muted-foreground">{src.note}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] italic text-muted-foreground/80">
                  Os códigos MED-*, AMB-* e TEC-* são identificadores fictícios da missão e não correspondem a bases
                  reais.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="banca">
            <AccordionTrigger className="px-2">Explicação para a banca</AccordionTrigger>
            <AccordionContent className="px-2">
              <div className="space-y-2 text-xs">
                <p className="text-sm font-semibold">{exp.title}</p>
                <p>
                  <b className="text-muted-foreground">O que acontece: </b>
                  {exp.what}
                </p>
                <p>
                  <b className="text-muted-foreground">Qual regra decide: </b>
                  {exp.rule}
                </p>
                <p>
                  <b className="text-muted-foreground">Por que assim: </b>
                  {exp.why}
                </p>
                <p>
                  <b className="text-muted-foreground">Ponto cego assumido: </b>
                  {exp.blind}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tech" className="border-b-0">
            <AccordionTrigger className="px-2">Detalhes técnicos</AccordionTrigger>
            <AccordionContent className="space-y-4 px-2">
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Camadas</p>
                <LayerStrip />
              </section>
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Watchdog</p>
                <WatchdogTable />
              </section>
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Linha do tempo (tempo simulado)
                </p>
                <TimelineList />
              </section>
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Saída da camada 3 (evento selecionado)
                </p>
                <L3Output />
              </section>
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Log de eventos (SQL)</p>
                <SqlLog />
              </section>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
