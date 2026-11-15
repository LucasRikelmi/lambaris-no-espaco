import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TONE_BORDER, TONE_ICON, TONE_TEXT, toneFromSignal } from "@/components/common/state";
import { ToneLegend } from "@/components/common/ToneLegend";
import { cn } from "@/lib/utils";
import { fmtAge, fmtN } from "@/lib/format";
import { SCEN, type SignalGroup, type SignalKey } from "@/lib/sim/scenarios";
import { GROUP_HINT, GROUP_LABEL, SIGNALS, SIGNAL_ORDER } from "@/lib/sim/signals";
import { useSimEngine, useSimVersion } from "@/lib/sim/store";
import { Sparkline, WaveCanvas } from "./charts";

const GROUPS: SignalGroup[] = ["tripulante", "cabine", "coleta"];

function readout(value: number | null, digits: number, unit: string): string {
  return value == null ? "—" : `${fmtN(value, digits)}${unit ? " " + unit : ""}`;
}

function FocusSignal({ signal }: { signal: SignalKey }) {
  useSimVersion();
  const engine = useSimEngine();
  const meta = SIGNALS[signal];
  const value = engine.signalValue(signal);
  const missing = value == null;
  const tone = toneFromSignal(meta.state(value));
  const Icon = TONE_ICON[tone];
  const age = engine.lastSeenAge(signal);

  return (
    <div className={cn("rounded-lg border bg-secondary/30 p-3", TONE_BORDER[tone])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{meta.label}</p>
        <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[tone])} aria-hidden />
      </div>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums leading-none">
        {missing ? "—" : fmtN(value, meta.digits)}
        {meta.unit && !missing ? <span className="ml-1 text-xs font-medium text-muted-foreground">{meta.unit}</span> : null}
      </p>
      <p className={cn("mt-1.5 text-[11px]", missing ? "font-semibold text-crit" : "text-muted-foreground")}>
        {missing
          ? `Leitura ausente: ${meta.missingLabel ?? "sem dado"}. Ausente não é normal.`
          : `Última atualização há ${fmtAge(age ?? 0)}.`}
      </p>
      {meta.thresholds.length || signal === "hrE" || signal === "hrP" || signal === "spo2" || signal === "rr" ? (
        <Sparkline signal={signal} />
      ) : null}
    </div>
  );
}

function SignalRow({ signal }: { signal: SignalKey }) {
  useSimVersion();
  const engine = useSimEngine();
  const meta = SIGNALS[signal];
  const value = engine.signalValue(signal);
  const missing = value == null;
  const tone = toneFromSignal(meta.state(value));
  const Icon = TONE_ICON[tone];
  const age = engine.lastSeenAge(signal);

  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{meta.short}</p>
        <p className={cn("truncate text-[10px]", missing ? "text-crit" : "text-muted-foreground")}>
          {missing
            ? `Leitura ausente · ${meta.missingLabel ?? "sem dado"}`
            : `Atualizado há ${fmtAge(age ?? 0)}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Icon className={cn("size-3.5", TONE_TEXT[tone])} aria-hidden />
        <span className="font-mono text-sm font-semibold tabular-nums">{readout(value, meta.digits, "")}</span>
        <span className="w-10 text-[10px] text-muted-foreground">{meta.unit}</span>
      </div>
    </li>
  );
}

export function SignalsPanel() {
  useSimVersion();
  const engine = useSimEngine();
  const scen = SCEN[engine.scen];
  const focus = scen.focus;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" aria-hidden /> Sinais ao vivo
              </CardTitle>
              <CardDescription>
                Destaque para os sinais que decidem o cenário “{scen.name}”. Amostragem a cada 250 ms de tempo simulado.
              </CardDescription>
            </div>
            <ToneLegend className="pt-0.5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {focus.map((key) => (
              <FocusSignal key={key} signal={key} />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {GROUPS.map((group) => {
              const keys = SIGNAL_ORDER.filter((k) => SIGNALS[k].group === group && !focus.includes(k));
              if (!keys.length) return null;
              return (
                <section key={group} aria-label={GROUP_LABEL[group]}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {GROUP_LABEL[group]}
                  </p>
                  <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">{GROUP_HINT[group]}</p>
                  <ul>
                    {keys.map((key) => (
                      <SignalRow key={key} signal={key} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Formas de onda</CardTitle>
            <CardDescription>Janela de 6 s. O traçado muda de cor conforme o ritmo e o contato do eletrodo.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/20 p-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              ECG · {SIGNALS.hrE.short}
            </p>
            <WaveCanvas kind="ecg" />
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              PPG · {SIGNALS.hrP.short}
            </p>
            <WaveCanvas kind="ppg" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
