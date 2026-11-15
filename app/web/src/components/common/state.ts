import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  HelpCircle,
  Info,
  ShieldOff,
  type LucideIcon
} from "lucide-react";
import type { RuleStatus } from "@/lib/sim/engine";
import type { SignalState } from "@/lib/sim/signals";

export type Tone = "ok" | "warn" | "crit" | "info" | "na";

export const TONE_ICON: Record<Tone, LucideIcon> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  crit: AlertOctagon,
  info: Info,
  na: HelpCircle
};

export const TONE_BADGE: Record<Tone, "ok" | "warn" | "crit" | "info" | "outline"> = {
  ok: "ok",
  warn: "warn",
  crit: "crit",
  info: "info",
  na: "outline"
};

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  info: "text-info",
  na: "text-muted-foreground"
};

export const TONE_BORDER: Record<Tone, string> = {
  ok: "border-ok/40",
  warn: "border-warn/40",
  crit: "border-crit/50",
  info: "border-info/40",
  na: "border-border"
};

export function toneFromSignal(state: SignalState | RuleStatus): Tone {
  switch (state) {
    case "ok":
      return "ok";
    case "warn":
      return "warn";
    case "crit":
      return "crit";
    case "sup":
      return "info";
    default:
      return "na";
  }
}

export const SEVERITY: Record<string, { tone: Tone; label: string }> = {
  critico: { tone: "crit", label: "Crítico" },
  aviso: { tone: "warn", label: "Aviso" },
  tecnico: { tone: "info", label: "Técnico" },
  verificacao: { tone: "info", label: "Verificação" }
};

export const STATE_LABEL: Record<string, string> = {
  aberto: "Aberto",
  reconhecido: "Reconhecido",
  silenciado: "Silenciado",
  encerrado: "Encerrado"
};

export const ACTIVITY_ICON: LucideIcon = Activity;
export const SILENCED_ICON: LucideIcon = ShieldOff;
export const SLASH_ICON: LucideIcon = CircleSlash;
