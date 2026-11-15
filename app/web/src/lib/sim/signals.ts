import type { SignalKey, SignalGroup } from "./scenarios";

export type SignalState = "ok" | "warn" | "crit" | "na";

export interface SignalMeta {
  key: SignalKey;
  label: string;
  short: string;
  unit: string;
  group: SignalGroup;
  digits: number;
  lo: number;
  hi: number;
  thresholds: number[];
  state: (v: number | null) => SignalState;
  missingLabel?: string;
}

export const SIGNALS: Record<SignalKey, SignalMeta> = {
  hrE: {
    key: "hrE",
    label: "Frequência cardíaca (ECG)",
    short: "FC pelo ECG",
    unit: "bpm",
    group: "tripulante",
    digits: 0,
    lo: 30,
    hi: 160,
    thresholds: [],
    state: (v) => (v == null ? "na" : v > 120 || v < 45 ? "warn" : "ok"),
    missingLabel: "sem QRS ou eletrodo solto"
  },
  hrP: {
    key: "hrP",
    label: "Frequência cardíaca (PPG)",
    short: "FC pelo PPG",
    unit: "bpm",
    group: "tripulante",
    digits: 0,
    lo: 30,
    hi: 160,
    thresholds: [],
    state: (v) => (v == null ? "crit" : v > 120 || v < 45 ? "warn" : "ok"),
    missingLabel: "pulso ausente no PPG"
  },
  spo2: {
    key: "spo2",
    label: "Saturação de oxigênio",
    short: "SpO₂",
    unit: "%",
    group: "tripulante",
    digits: 0,
    lo: 80,
    hi: 100,
    thresholds: [90, 94],
    state: (v) => (v == null ? "na" : v < 90 ? "crit" : v < 94 ? "warn" : "ok"),
    missingLabel: "sem pulso para medir"
  },
  rr: {
    key: "rr",
    label: "Frequência respiratória",
    short: "Freq. respiratória",
    unit: "rpm",
    group: "tripulante",
    digits: 0,
    lo: 0,
    hi: 40,
    thresholds: [30],
    state: (v) => (v == null ? "na" : v > 30 ? "crit" : v < 6 ? "warn" : "ok")
  },
  peak: {
    key: "peak",
    label: "Aceleração de pico",
    short: "Aceleração (pico)",
    unit: "g",
    group: "tripulante",
    digits: 1,
    lo: 0,
    hi: 8,
    thresholds: [4],
    state: (v) => (v == null ? "na" : v >= 4 ? "warn" : "ok")
  },
  co2: {
    key: "co2",
    label: "Pressão parcial de CO₂",
    short: "ppCO₂ da cabine",
    unit: "mmHg",
    group: "cabine",
    digits: 1,
    lo: 0,
    hi: 12,
    thresholds: [4, 8],
    state: (v) => (v == null ? "na" : v >= 8 ? "crit" : v >= 4 ? "warn" : "ok")
  },
  press: {
    key: "press",
    label: "Pressão da cabine",
    short: "Pressão da cabine",
    unit: "kPa",
    group: "cabine",
    digits: 1,
    lo: 95,
    hi: 104,
    thresholds: [],
    state: (v) => (v == null ? "na" : "ok")
  },
  lead: {
    key: "lead",
    label: "Contato do eletrodo",
    short: "Contato do eletrodo",
    unit: "",
    group: "coleta",
    digits: 0,
    lo: 0,
    hi: 1,
    thresholds: [],
    state: () => "ok"
  }
};

export const SIGNAL_ORDER: SignalKey[] = ["hrE", "hrP", "spo2", "rr", "peak", "co2", "press", "lead"];

export const GROUP_LABEL: Record<SignalGroup, string> = {
  tripulante: "Tripulante",
  cabine: "Cabine",
  coleta: "Qualidade da coleta"
};

export const GROUP_HINT: Record<SignalGroup, string> = {
  tripulante: "Sinais fisiológicos de Marina Costa (fictícia).",
  cabine: "Ambiente do módulo, vindo do sistema de suporte de vida.",
  coleta: "Confiança da medição. Uma leitura ausente não é leitura normal."
};

export type ThresholdTone = "ok" | "warn" | "crit" | "info" | "na";

export interface ThresholdRow {
  rule: string;
  cond: string;
  persist: string;
  result: string;
  tone: ThresholdTone;
}

export const THRESHOLDS: ThresholdRow[] = [
  { rule: "Parada cardíaca", cond: "ECG em fibrilação ou sem QRS e PPG sem pulso, eletrodo com contato", persist: "≥ 8 s", result: "Crítico", tone: "crit" },
  { rule: "Parada, sensores em dúvida", cond: "ECG e PPG sem sinal, mas acelerômetro mostra movimento ativo", persist: "pergunta 15 s", result: "Verificação; sem resposta vira crítico", tone: "warn" },
  { rule: "Sensor solto", cond: "Eletrodo sem contato e PPG com pulso", persist: "—", result: "Suprime parada e gera aviso técnico", tone: "info" },
  { rule: "Oxigenação", cond: "SpO₂ < 94%", persist: "≥ 15 s", result: "Aviso", tone: "warn" },
  { rule: "Falta de ar (corpo)", cond: "SpO₂ < 90% ou FR > 30 rpm", persist: "≥ 15 s", result: "Crítico", tone: "crit" },
  { rule: "CO₂ da cabine", cond: "ppCO₂ ≥ 4 mmHg", persist: "≥ 5 s", result: "Aviso", tone: "warn" },
  { rule: "Falta de ar (cabine)", cond: "ppCO₂ ≥ 8 mmHg ou queda de pressão > 1 kPa/min", persist: "imediato", result: "Crítico, toda a tripulação", tone: "crit" },
  { rule: "Impacto", cond: "Pico de aceleração ≥ 4 g", persist: "pergunta 20 s", result: "Verificação; sem resposta vira crítico", tone: "warn" },
  { rule: "Trauma ou corte relatado", cond: "Botão de pânico ou palavra-chave de voz reconhecida localmente", persist: "imediato", result: "Crítico", tone: "crit" },
  { rule: "Integridade do sensor", cond: "Eletrodo sem contato ou dado parado", persist: "≥ 3 s / ≥ 5 s", result: "Aviso técnico", tone: "warn" },
  { rule: "Watchdog da IA", cond: "Sem heartbeat do processo do modelo", persist: "≥ 3 s", result: "IA indisponível; camada 3 usa fallback", tone: "info" }
];
