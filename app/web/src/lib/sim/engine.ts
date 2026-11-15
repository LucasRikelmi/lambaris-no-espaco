import { BASE, LOC, SCEN, type LocationId, type ScenarioId, type ScenarioSignals, type SignalKey } from "./scenarios";
import { SIGNAL_ORDER, SIGNALS, type SignalState } from "./signals";
import { fmtN, fmtT } from "../format";
import { narrator } from "../narration";

export type RuleId = "r1" | "r2" | "r3" | "r4" | "r5";
export type LayerKey = "c1" | "c2" | "c3" | "cw" | "ct" | "cs" | "ce";
export type EventSeverity = "critico" | "aviso" | "tecnico" | "verificacao";
export type EventState = "aberto" | "reconhecido" | "silenciado" | "encerrado";
export type RuleStatus = "ok" | "warn" | "crit" | "sup" | "na";
export type AiMode = "gemma" | "medgemma";

export interface RuleState {
  id: RuleId;
  name: string;
  cond: string;
  status: RuleStatus;
  label: string;
  detail: string;
  since: number | null;
  offAt: number | null;
  since2: number | null;
  need: number;
  prog: number;
  fired: boolean;
  warned: boolean;
}

export interface SignalEvidence {
  key: SignalKey;
  label: string;
  unit: string;
  value: number | null;
  text: string;
  state: SignalState;
}

export interface TimelineEntry {
  t: number;
  layer: LayerKey;
  text: string;
  crit?: boolean;
  action?: boolean;
}

export interface ActionEntry {
  t: number;
  type: "reconhecer" | "silenciar" | "revisar" | "abrir" | "ajuda" | "confirmou";
  label: string;
  note?: string;
}

export interface L3Step {
  items?: string[];
  text?: string;
  src: string;
}

export interface L3State {
  id: number;
  rule: RuleId;
  mode: "ia" | "fb";
  steps: { check?: L3Step; summary?: L3Step; report?: L3Step };
  startedAt: number;
}

export interface AssistantSource {
  id: number | string;
  titulo: string;
  texto: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "sistema";
  text: string;
  model?: string;
  t: number;
  eventId: string;
}

export interface AssistantState {
  messages: AssistantMessage[];
  sources: AssistantSource[];
  sourcesStatus: string;
  model: string;
}

export interface SimEvent {
  id: string;
  ruleId: RuleId | null;
  title: string;
  detail: string;
  severity: EventSeverity;
  scope: string;
  t: number;
  state: EventState;
  ack: boolean;
  muted: boolean;
  reviewed: boolean;
  evidence: SignalEvidence[];
  timeline: TimelineEntry[];
  actions: ActionEntry[];
  l3?: L3State;
  assistant: AssistantState;
}

export interface Reading {
  st: ScenarioSignals;
  ppgOk: boolean;
  leadOff: boolean;
  rhythm: ScenarioSignals["rhythm"];
  hrE: number | null;
  hrP: number | null;
  spo2: number | null;
  rr: number;
  act: number;
  peak: number;
  co2: number;
  press: number;
}

const TICK = 0.25;
const FS = 250;
export const WIN = 6;
const GRACE = 2;
const EPS = 1e-6;

export const KIND: Record<LayerKey, string> = {
  c1: "Camada 1",
  c2: "Camada 2",
  c3: "Camada 3",
  cw: "Watchdog",
  ct: "Tripulação",
  cs: "Sistema",
  ce: "Terra"
};

const CHECK: Record<RuleId, string[]> = {
  r1: [
    "Confirmar que o tripulante não responde.",
    "Chamar o responsável médico e toda a tripulação.",
    "Trazer o desfibrilador (DEA) e o kit médico.",
    "Iniciar RCP conforme o procedimento médico da missão.",
    "Manter contato com os médicos em solo quando o enlace permitir."
  ],
  r2: [
    "Conferir se o oxímetro está bem posicionado e medir de novo.",
    "Checar leituras da cabine (CO₂ e pressão) para descartar causa ambiental.",
    "Oferecer oxigênio conforme o procedimento da missão.",
    "Registrar sintomas: dor no peito, tosse, início súbito ou gradual.",
    "Repetir SpO₂ e FR a cada poucos minutos e reportar à equipe médica."
  ],
  r3: [
    "Avisar toda a tripulação e seguir o procedimento do veículo para CO₂ elevado.",
    "Verificar sintomas em todos: dor de cabeça, falta de ar, confusão.",
    "Registrar as leituras de cabine e de cada tripulante.",
    "Acompanhar a FR de cada pessoa até a cabine normalizar."
  ],
  r4: [
    "Ir até o tripulante e checar se responde.",
    "Se houver sangramento, comprimir o local com o material do kit de trauma.",
    "Registrar local da lesão e hora do impacto.",
    "Avaliar cabeça e pescoço antes de mover o tripulante.",
    "Contatar os médicos em solo com o relato e os sinais."
  ],
  r5: ["Reajustar o eletrodo do peito.", "Conferir a impedância e remover o alerta técnico."]
};

export const MAN: Record<RuleId, string> = { r1: "MED-RCP-01", r2: "MED-RESP-02", r3: "AMB-CO2-01", r4: "MED-TRAUMA-03", r5: "TEC-ELEIT-01" };

export const RULE_DEF: Record<RuleId, { name: string; cond: string }> = {
  r1: { name: "Parada cardíaca", cond: "ECG FV/sem QRS ∧ PPG sem pulso ≥ 8 s" },
  r2: { name: "Falta de ar (corpo)", cond: "SpO₂ < 90% ∨ FR > 30 ≥ 15 s · aviso SpO₂ < 94%" },
  r3: { name: "Falta de ar (cabine)", cond: "ppCO₂ ≥ 8 mmHg imediato · aviso ≥ 4 mmHg 5 s" },
  r4: { name: "Impacto ou corte", cond: "pico ≥ 4 g → pergunta 20 s · pânico/voz imediato" },
  r5: { name: "Integridade do sensor", cond: "eletrodo sem contato ≥ 3 s" }
};

/* De onde vem cada limiar clínico. Os IDs MED-*, AMB-*, TEC-* em MAN são códigos
   fictícios internos da missão (não existem em nenhuma base real). A origem dos
   números está nas fontes listadas em SOURCES. */
export const REF: Record<RuleId, string> = {
  r1: "AHA/ILCOR 2020 — checar pulso por no máximo 10 s. O protótipo usa 8 s.",
  r2: "Faixas normais do adulto: SpO₂ 94–98% e FR 12–20 rpm (sinais vitais).",
  r3: "NASA OCHMO-TB-004 / NASA-STD-3001 Vol. 2 — ppCO₂ da cabine.",
  r4: "Limiar de projeto do protótipo; tolerância humana em NASA-STD-3001 Vol. 2.",
  r5: "Limiar técnico do protótipo. Não é limiar clínico."
};

export interface RefSource {
  key: string;
  title: string;
  note: string;
  url: string;
}

export const SOURCES: RefSource[] = [
  {
    key: "AHA-2020",
    title: "AHA/ILCOR 2020 — Guidelines for CPR and ECC",
    note: "Reconhecimento de parada cardíaca: verificar pulso por no máximo 10 s. Base do limiar de 8 s do r1.",
    url: "https://www.heart.org/-/media/cpr-files/cpr-guidelines-files/highlights/hghlghts_2020_ecc_guidelines_english.pdf"
  },
  {
    key: "NASA-OCHMO-CO2",
    title: "NASA OCHMO-TB-004 — Carbon Dioxide",
    note: "Limite de ppCO₂ (média de 1 h) ≤ 3 mmHg e início de sintomas por volta de 2,8–4,5 mmHg. Base dos avisos de CO₂ do r3.",
    url: "https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/"
  },
  {
    key: "NASA-STD-3001",
    title: "NASA-STD-3001 Vol. 2 — Human Factors, Habitability and Environmental Health",
    note: "Referência de saúde ambiental da cabine e tolerância humana (usada no r3 e no r4).",
    url: "https://standards.nasa.gov/standard/nasa/nasa-std-3001"
  },
  {
    key: "VITALS",
    title: "Sinais vitais normais do adulto (StatPearls / Medtronic Resparray)",
    note: "SpO₂ 94–98%, FR 12–20 rpm, FC 60–100 bpm. Base das faixas de exibição e do r2.",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK593192/"
  }
];

const g = (x: number, m: number, w: number) => Math.exp(-((x - m) * (x - m)) / (2 * w * w));

function ecgSample(st: ScenarioSignals, t: number, ph: number): number {
  if (st.leadOff) return (Math.random() - 0.5) * 0.03 + (Math.sin(t * 3.1) > 0.995 ? 0.8 : 0);
  if (st.rhythm === "vf")
    return (
      0.45 * Math.sin(2 * Math.PI * 5.2 * t + 1.5 * Math.sin(1.3 * t)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.35 * t)) +
      (Math.random() - 0.5) * 0.05
    );
  if (st.rhythm === "asys") return (Math.random() - 0.5) * 0.03;
  return (
    0.12 * g(ph, 0.18, 0.025) -
    0.12 * g(ph, 0.355, 0.009) +
    1.0 * g(ph, 0.38, 0.011) -
    0.22 * g(ph, 0.405, 0.01) +
    0.28 * g(ph, 0.62, 0.04) +
    (Math.random() - 0.5) * 0.03 +
    0.04 * Math.sin(t * 0.9)
  );
}

function ppgSample(st: ScenarioSignals, _t: number, ph: number): number {
  const p = (ph + 0.85) % 1;
  if (st.ppg < 0.2) return (Math.random() - 0.5) * 0.04;
  return st.ppg * (g(p, 0.18, 0.07) + 0.4 * g(p, 0.45, 0.09)) + (Math.random() - 0.5) * 0.02;
}

export interface WatchdogRow {
  name: string;
  state: SignalState;
  detail: string;
}

export class SimEngine {
  scen: ScenarioId = "parada";
  running = true;
  speed = 1;
  loc: LocationId = "leo";
  aiEnabled = true;
  soundAlarm = false;
  speakAlarm = true;
  autoRead = true;

  t = 0;
  nextTick = 0;
  tt = 0;
  phase = 0;
  ecg = new Float32Array(FS * WIN);
  ppg = new Float32Array(FS * WIN);
  wi = 0;
  hist: {
    t: number;
    hrE: number | null;
    hrP: number | null;
    spo2: number | null;
    rr: number;
    peak: number;
    co2: number;
    press: number;
    leadOff: boolean;
  }[] = [];
  v: Reading | null = null;
  aiCrashed = false;
  aiStatus: "ok" | "down" = "ok";
  lastAiBeat = 0;
  evIdx = 0;

  rules: Record<RuleId, RuleState> = this.freshRules();
  prompt: { rule: RuleId; t0: number; dur: number; why: string } | null = null;
  sched: { t: number; fn: () => void }[] = [];
  tl: TimelineEntry[] = [];
  sql: string[] = [];
  chips: Record<string, number> = {};
  events: SimEvent[] = [];
  selectedEventId: string | null = null;
  lastSeen: Partial<Record<SignalKey, number>> = {};
  alarmSeq = 0;

  private listeners = new Set<() => void>();
  private version = 0;
  private lastNotify = 0;
  private eventSeq = 0;
  private actx: AudioContext | null = null;
  private nextBeep = 0;
  private lastCriticalId: string | null = null;

  /* ---------- store ---------- */
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private notify() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  /* ---------- lifecycle ---------- */
  private freshRule(id: RuleId): RuleState {
    return {
      id,
      name: RULE_DEF[id].name,
      cond: RULE_DEF[id].cond,
      status: "ok",
      label: "Monitorando",
      detail: "",
      since: null,
      offAt: null,
      since2: null,
      need: 0,
      prog: 0,
      fired: false,
      warned: false
    };
  }
  private freshRules(): Record<RuleId, RuleState> {
    return { r1: this.freshRule("r1"), r2: this.freshRule("r2"), r3: this.freshRule("r3"), r4: this.freshRule("r4"), r5: this.freshRule("r5") };
  }

  reset(keep?: { scen?: ScenarioId }) {
    const scen = keep?.scen ?? this.scen;
    const speed = this.speed;
    const loc = this.loc;
    const aiEnabled = this.aiEnabled;
    const soundAlarm = this.soundAlarm;
    const speakAlarm = this.speakAlarm;
    const autoRead = this.autoRead;

    this.scen = scen;
    this.speed = speed;
    this.loc = loc;
    this.aiEnabled = aiEnabled;
    this.soundAlarm = soundAlarm;
    this.speakAlarm = speakAlarm;
    this.autoRead = autoRead;

    this.running = true;
    this.t = 0;
    this.nextTick = 0;
    this.tt = 0;
    this.phase = 0;
    this.ecg = new Float32Array(FS * WIN);
    this.ppg = new Float32Array(FS * WIN);
    this.wi = 0;
    this.hist = [];
    this.v = null;
    this.aiCrashed = false;
    this.aiStatus = "ok";
    this.lastAiBeat = 0;
    this.evIdx = 0;
    this.rules = this.freshRules();
    this.prompt = null;
    this.sched = [];
    this.tl = [];
    this.sql = [];
    this.chips = {};
    this.events = [];
    this.selectedEventId = null;
    this.lastSeen = {};
    this.alarmSeq = 0;
    this.lastCriticalId = null;

    this.addTl("cs", "Cenário", `Início: ${SCEN[this.scen].name}. Local: ${LOC[this.loc].name}.`);
    this.notify();
  }

  /* ---------- timeline / log ---------- */
  private addTl(layer: LayerKey, kind: string, text: string, crit?: boolean) {
    this.tl.push({ t: this.t, layer, text, crit });
    void kind;
  }
  private sqlEv(regra: string, sev: string, estado: string, det: Record<string, unknown>) {
    const ts = Math.round(this.t * 1000);
    this.sql.push(`INSERT INTO evento VALUES (${ts}, 'marina', '${regra}', '${sev}', '${estado}', '${JSON.stringify(det).replace(/'/g, "''")}');`);
  }
  private sched_(dt: number, fn: () => void) {
    this.sched.push({ t: this.t + dt, fn });
  }

  /* ---------- events ---------- */
  private evidence(): SignalEvidence[] {
    const v = this.v;
    if (!v) return [];
    const values: Record<SignalKey, number | null> = {
      hrE: v.hrE,
      hrP: v.hrP,
      spo2: v.spo2,
      rr: v.rr,
      peak: v.peak,
      co2: v.co2,
      press: v.press,
      lead: v.leadOff ? 0 : 1
    };
    return SIGNAL_ORDER.map((key) => {
      const meta = SIGNALS[key];
      const value = values[key];
      let text: string;
      if (key === "lead") text = value ? "em contato" : "sem contato";
      else if (value == null) text = meta.missingLabel ? `sem dado (${meta.missingLabel})` : "sem dado";
      else text = `${fmtN(value, meta.digits)} ${meta.unit}`.trim();
      return { key, label: meta.label, unit: meta.unit, value, text, state: meta.state(value) };
    });
  }

  private createEvent(input: {
    ruleId: RuleId | null;
    title: string;
    detail: string;
    severity: EventSeverity;
    scope: string;
    timeline?: TimelineEntry[];
  }): SimEvent {
    const id = `evt-${++this.eventSeq}`;
    const evt: SimEvent = {
      id,
      ruleId: input.ruleId,
      title: input.title,
      detail: input.detail,
      severity: input.severity,
      scope: input.scope,
      t: this.t,
      state: "aberto",
      ack: false,
      muted: false,
      reviewed: false,
      evidence: this.evidence(),
      timeline: input.timeline ? [...input.timeline] : [],
      actions: [],
      assistant: { messages: [], sources: [], sourcesStatus: "", model: "" }
    };
    this.events.push(evt);
    if (!this.selectedEventId) this.selectedEventId = id;
    if (input.severity === "critico") {
      this.lastCriticalId = id;
      this.alarmSeq++;
    }
    return evt;
  }

  private eventById(id: string | null): SimEvent | undefined {
    return this.events.find((e) => e.id === id);
  }
  get selectedEvent(): SimEvent | null {
    return this.selectedEventId ? this.eventById(this.selectedEventId) ?? null : null;
  }
  get activeAlarm(): SimEvent | null {
    const open = this.events.filter((e) => e.severity === "critico" && e.state !== "encerrado");
    return open.length ? open[open.length - 1] : null;
  }
  selectEvent(id: string | null) {
    this.selectedEventId = id;
    const e = this.eventById(id);
    if (e && !e.actions.some((a) => a.type === "abrir")) {
      e.actions.push({ t: this.t, type: "abrir", label: "Evento aberto para investigação." });
    }
    this.notify();
  }
  private ensureAssistant(evt: SimEvent): AssistantState {
    return evt.assistant;
  }

  eventAction(id: string, type: ActionEntry["type"], label: string, note?: string) {
    const evt = this.eventById(id);
    if (!evt) return;
    evt.actions.push({ t: this.t, type, label, note });
    evt.timeline.push({ t: this.t, layer: "ct", text: label, action: true });
    if (type === "reconhecer") {
      evt.ack = true;
      if (evt.state === "aberto" || evt.state === "silenciado") evt.state = "reconhecido";
      this.sqlEv(evt.ruleId ?? "manual", "critico", "reconhecido", {});
    }
    if (type === "silenciar") {
      if (narrator.isBusy) narrator.stop();
      evt.muted = true;
      if (evt.state === "aberto") evt.state = "silenciado";
      this.sqlEv(evt.ruleId ?? "manual", "critico", "silenciado", {});
    }
    if (type === "revisar") {
      evt.reviewed = true;
      evt.state = "encerrado";
      this.sqlEv(evt.ruleId ?? "manual", "critico", "revisado", note ? { nota: note } : {});
    }
    this.notify();
  }
  acknowledge(id: string) {
    this.eventAction(id, "reconhecer", "Alarme reconhecido. Som silenciado, luz mantida até o encerramento.");
  }
  mute(id: string) {
    this.eventAction(id, "silenciar", "Aviso silenciado temporariamente. O evento continua aberto.");
  }
  review(id: string, note: string) {
    this.eventAction(id, "revisar", note ? `Revisão registrada: ${note}` : "Revisão registrada no relatório de simulação.", note);
  }
  addAssistantMessage(eventId: string, msg: Omit<AssistantMessage, "eventId">) {
    const evt = this.eventById(eventId);
    if (!evt) return;
    evt.assistant.messages.push({ ...msg, eventId });
    this.notify();
  }
  setAssistantResult(eventId: string, sources: AssistantSource[], status: string, model: string) {
    const evt = this.eventById(eventId);
    if (!evt) return;
    const st = this.ensureAssistant(evt);
    st.sources = sources;
    st.sourcesStatus = status;
    st.model = model;
    this.notify();
  }

  /* ---------- alarm (camada 2) ---------- */
  private fireCritical(ruleId: RuleId, title: string, detail: string, scope?: string) {
    if (narrator.isBusy) narrator.stop();
    const r = this.rules[ruleId];
    r.fired = true;
    r.status = "crit";
    r.label = "Disparado";
    const resolvedScope = scope ?? "Marina Costa e responsável médico";
    if (this.speakAlarm) {
      void narrator.play(`Alarme crítico. ${title}. ${detail}. Avisados: ${resolvedScope}.`);
    }
    const tl: TimelineEntry[] = [
      { t: this.t, layer: "c1", text: `Regra "${r.name}" disparou: ${detail}`, crit: true },
      { t: this.t, layer: "c2", text: "Som e luz de alarme acionados no módulo.", crit: true },
      { t: this.t, layer: "c2", text: `Aviso enviado a: ${resolvedScope}.`, crit: true },
      { t: this.t, layer: "c2", text: "Pacote de telemetria enfileirado para a Terra (evento + últimos 60 s de sinais).", crit: true }
    ];
    this.chips = { som: 1, luz: 1, trip: 1, tel: 1, terra: 0 };
    this.sqlEv(ruleId, "critico", "aberto", { titulo: title, detalhe: detail });
    const L = LOC[this.loc];
    if (L.delay <= 5) {
      this.sched_(L.delay, () => {
        this.chips.terra = 1;
        this.addTl("ce", "Terra", `Médicos em solo receberam o alerta (atraso de ${L.txt}).`);
        const evt = this.eventById(this.lastCriticalId);
        evt?.timeline.push({ t: this.t, layer: "ce", text: `Médicos em solo receberam o alerta (atraso de ${L.txt}).` });
        this.notify();
      });
    } else {
      const text = `Chegada prevista em ${fmtT(this.t + L.delay)}. Atraso de ${L.txt}. A resposta a bordo não pode esperar.`;
      this.addTl("ce", "Terra", text);
      tl.push({ t: this.t, layer: "ce", text });
    }
    this.tl.push(...tl.slice(0, 4));
    const evt = this.createEvent({ ruleId, title, detail, severity: "critico", scope: resolvedScope, timeline: tl });
    this.startL3(evt, ruleId);
    this.nextBeep = 0;
    this.notify();
  }

  private warn(ruleId: RuleId, severity: EventSeverity, text: string, title: string) {
    this.addTl("c1", "Camada 1", text);
    this.sqlEv(ruleId, severity === "tecnico" ? "tecnico" : "aviso", "aberto", { detalhe: text });
    this.createEvent({
      ruleId,
      title,
      detail: text,
      severity,
      scope: "Tripulação de plantão",
      timeline: [{ t: this.t, layer: "c1", text, crit: false }]
    });
    this.notify();
  }

  /* ---------- verificação com o tripulante ---------- */
  private openPrompt(ruleId: RuleId, dur: number, why: string) {
    if (this.prompt) return;
    this.prompt = { rule: ruleId, t0: this.tt, dur, why };
    this.addTl("ct", "Tripulação", `Pergunta enviada: "Marina, você está bem?" (${dur} s para responder).`);
    this.sqlEv(ruleId, "verificacao", "aguardando", { prazo_s: dur });
    this.notify();
  }
  answer(ok: boolean) {
    if (!this.prompt) return;
    const p = this.prompt;
    this.prompt = null;
    if (ok) {
      const text = "Marina respondeu \"Estou bem\". Verificação encerrada, evento registrado para revisão.";
      this.addTl("ct", "Tripulação", text);
      this.sqlEv(p.rule, "verificacao", "encerrado_ok", {});
      const r = this.rules[p.rule];
      r.status = "ok";
      r.label = "Monitorando";
      r.detail = "Tripulante confirmou que está bem.";
      const evt = this.createEvent({
        ruleId: p.rule,
        title: "Verificação encerrada: tripulante respondeu bem",
        detail: text,
        severity: "verificacao",
        scope: "Registro para revisão",
        timeline: [{ t: this.t, layer: "ct", text }]
      });
      evt.actions.push({ t: this.t, type: "confirmou", label: "Marina respondeu \"Estou bem\"." });
      evt.state = "encerrado";
    } else {
      const text = "Marina respondeu \"Preciso de ajuda\".";
      this.addTl("ct", "Tripulação", text, true);
      const evt = this.fireCritical2(p.rule, p.rule === "r4" ? "Trauma relatado após impacto" : "Pedido de ajuda", "tripulante pediu ajuda na verificação", "toda a tripulação e responsável médico");
      evt?.actions.push({ t: this.t, type: "ajuda", label: "Marina respondeu \"Preciso de ajuda\"." });
    }
    this.notify();
  }
  private fireCritical2(ruleId: RuleId, title: string, detail: string, scope: string): SimEvent | undefined {
    this.fireCritical(ruleId, title, detail, scope);
    return this.eventById(this.lastCriticalId);
  }
  manual(kind: "panic" | "voice") {
    const txt = kind === "panic" ? "Botão de pânico acionado" : "Palavra-chave \"emergência médica\" reconhecida localmente";
    this.addTl("ct", "Tripulação", txt + ".", true);
    if (this.prompt) this.prompt = null;
    this.rules.r4.fired = false;
    this.fireCritical("r4", kind === "panic" ? "Pedido de ajuda: botão de pânico" : "Pedido de ajuda: comando de voz", txt.toLowerCase(), "toda a tripulação e responsável médico");
    this.notify();
  }

  /* ---------- camada 3 ---------- */
  private aiAlive() {
    return this.aiEnabled && !this.aiCrashed;
  }
  private snapshotAgg() {
    const h = this.hist.slice(-240);
    const pick = (k: "hrP" | "spo2" | "rr" | "co2" | "peak") => h.map((x) => x[k]).filter((x): x is number => x != null);
    const avg = (a: number[]) => (a.length ? a.reduce((p, c) => p + c, 0) / a.length : null);
    const mn = (a: number[]) => (a.length ? Math.min(...a) : null);
    const mx = (a: number[]) => (a.length ? Math.max(...a) : null);
    return { hr: avg(pick("hrP")), spo2min: mn(pick("spo2")), rrmax: mx(pick("rr")), co2max: mx(pick("co2")), peak: mx(pick("peak")) };
  }
  private buildSummary(rule: RuleId, ai: boolean): string {
    void rule;
    const s = this.snapshotAgg();
    const base = `Últimos 60 s: FC média pelo PPG ${fmtN(s.hr)} bpm, menor SpO₂ ${fmtN(s.spo2min)}%, maior FR ${fmtN(s.rrmax)} rpm, pico de aceleração ${fmtN(s.peak, 1)} g, maior ppCO₂ ${fmtN(s.co2max, 1)} mmHg.`;
    return ai
      ? `${base}\nLinha de base de Marina nos 7 dias anteriores (simulada): FC de repouso 66 bpm, SpO₂ 97–99%. Sono abaixo do padrão nas duas últimas noites. Nenhum evento cardíaco prévio registrado.`
      : `${base}\nHistórico completo disponível na tela "Saúde individual". Resumo automático indisponível.`;
  }
  private buildReport(rule: RuleId, ai: boolean): string {
    const a = this.events[this.events.length - 1];
    const evs = this.tl
      .filter((e) => e.t >= a.t - 15 && (e.layer === "c1" || e.layer === "ct"))
      .slice(0, 6)
      .map((e) => `${fmtT(e.t)} ${e.text}`)
      .join("\n");
    const head = ai ? "RASCUNHO PARA REVISÃO DA TRIPULAÇÃO\n" : "RELATÓRIO POR MODELO FIXO (SEM IA)\n";
    return `${head}Tripulante: Marina Costa · Missão Aurora, dia 042\nEvento: ${a.title} às ${fmtT(a.t)}\nRegra: ${this.rules[rule].cond}\n${evs}\n${
      ai ? "Observação: interpretação sugerida pelo modelo, não é diagnóstico." : "Campos preenchidos direto do banco de eventos."
    }`;
  }
  private startL3(evt: SimEvent, rule: RuleId) {
    const id = Math.random();
    evt.l3 = { id, rule, mode: this.aiAlive() ? "ia" : "fb", steps: {}, startedAt: this.t };
    if (evt.l3.mode === "fb") {
      this.fallbackL3(evt, rule, "IA indisponível no momento do alarme.");
      return;
    }
    this.addTl("c3", "Camada 3", "Modelo local acionado em segundo plano. O alarme já saiu.");
    const live = () => evt.l3 && evt.l3.id === id && evt.l3.mode === "ia";
    const step = (dt: number, fn: () => void) =>
      this.sched_(dt, () => {
        if (!live()) return;
        const l3 = evt.l3!;
        if (!this.aiAlive()) {
          this.addTl("c3", "Camada 3", "Modelo não respondeu dentro do prazo. Mudando para o fallback.");
          this.fallbackL3(evt, rule, "IA parou durante a resposta.");
          return;
        }
        fn();
        void l3;
        this.notify();
      });
    step(2, () => {
      evt.l3!.steps.check = { items: CHECK[rule], src: `Trecho recuperado por busca semântica no manual: ${MAN[rule]} (identificador fictício).` };
      this.addTl("c3", "Camada 3", `Checklist aberto a partir do manual (${MAN[rule]}).`);
    });
    step(5, () => {
      evt.l3!.steps.summary = { text: this.buildSummary(rule, true), src: "Gerado pelo modelo a partir das tabelas medicao e evento." };
      this.addTl("c3", "Camada 3", "Resumo do histórico pronto.");
    });
    step(9, () => {
      evt.l3!.steps.report = { text: this.buildReport(rule, true), src: "Rascunho. Só vai para a Terra depois que a tripulação revisar." };
      this.addTl("c3", "Camada 3", "Rascunho do relatório para os médicos em solo pronto para revisão.");
    });
  }
  private fallbackL3(evt: SimEvent, rule: RuleId, reason: string) {
    if (!evt.l3) evt.l3 = { id: Math.random(), rule, mode: "fb", steps: {}, startedAt: this.t };
    evt.l3.mode = "fb";
    evt.l3.steps.check = { items: CHECK[rule], src: `Checklist estático pré-indexado pela regra ${rule} (${MAN[rule]}). Não depende do modelo.` };
    evt.l3.steps.summary = { text: this.buildSummary(rule, false), src: "Números calculados por consulta SQL simples." };
    evt.l3.steps.report = { text: this.buildReport(rule, false), src: "Modelo de texto fixo preenchido com os dados do evento." };
    this.addTl("c3", "Camada 3", `Fallback: ${reason} Checklist estático e relatório por modelo fixo carregados.`);
    this.notify();
  }

  /* ---------- leitura ---------- */
  private reading(t: number): Reading {
    const st = SCEN[this.scen].at(t);
    const n = (k: number) => (Math.random() - 0.5) * k;
    const ppgOk = st.ppg >= 0.2;
    const peakBase = st.act * (1.2 + Math.random() * 0.8);
    return {
      st,
      ppgOk,
      leadOff: st.leadOff,
      rhythm: st.rhythm,
      hrE: !st.leadOff && st.rhythm === "sinus" ? st.hr + n(2) : null,
      hrP: ppgOk ? st.hr + n(2) : null,
      spo2: ppgOk && st.spo2 != null ? Math.min(100, st.spo2 + n(0.8)) : null,
      rr: st.rr + n(0.8) < 0 ? 0 : st.rr + n(0.8),
      act: st.act,
      peak: Math.max(st.peak, peakBase),
      co2: st.co2 + n(0.1),
      press: st.press + n(0.05)
    };
  }

  /* ---------- motor de regras (camada 1) ---------- */
  private persist(r: RuleState, cond: boolean, need: number, t: number): number {
    if (cond) {
      r.offAt = null;
      if (r.since == null) r.since = t;
      r.need = need;
      const e = t - r.since;
      return e + EPS >= need ? need : e;
    }
    if (r.since != null) {
      if (r.offAt == null) r.offAt = t;
      if (t - r.offAt < GRACE) return -2;
    }
    r.since = null;
    r.offAt = null;
    r.need = 0;
    return -1;
  }
  private evalRules(v: Reading, t: number) {
    const R = this.rules;
    /* R1 parada */
    {
      const r = R.r1;
      const ecgAbn = v.leadOff || v.rhythm !== "sinus";
      if (r.fired) {
        r.status = "crit";
        r.label = "Disparado";
        r.detail = "Alarme ativo. Resolução só por ação da tripulação.";
      } else if (this.prompt && this.prompt.rule === "r1") {
        r.status = "warn";
        r.label = "Verificando";
      } else if (ecgAbn && !v.ppgOk && !v.leadOff) {
        if (v.act > 0.1) {
          this.openPrompt("r1", 15, "ECG e PPG sem sinal, mas há movimento. Pode ser sensor deslocado.");
        } else {
          const e = this.persist(r, true, 8, t);
          if (e === 0) this.addTl("c1", "Camada 1", 'Regra "Parada cardíaca" armou: ECG sem ritmo organizado e PPG sem pulso. Contando 8 s.');
          r.status = "warn";
          r.label = "Armando";
          r.detail = `Condição verdadeira há ${fmtN(e, 1)} s de 8 s.`;
          if (e >= 8) this.fireCritical("r1", "Suspeita de parada cardíaca", "ECG em fibrilação e PPG sem pulso por 8 s");
        }
      } else if (ecgAbn && v.ppgOk) {
        this.persist(r, false, 0, t);
        r.status = "sup";
        r.label = "Suprimida";
        r.detail = v.leadOff
          ? "Eletrodo sem contato, mas o PPG mostra pulso e há movimento. Não é parada."
          : "ECG anormal com pulso no PPG: discordância, pedir checagem.";
      } else if (v.leadOff && !v.ppgOk) {
        if (v.act > 0.1) this.openPrompt("r1", 15, "Os dois sensores sem sinal com movimento.");
        else {
          const e = this.persist(r, true, 8, t);
          r.status = "warn";
          r.label = "Armando";
          r.detail = "Sem ECG e sem PPG, tripulante parado.";
          if (e >= 8) this.fireCritical("r1", "Suspeita de parada cardíaca", "sem sinal no ECG e no PPG, sem movimento, por 8 s");
        }
      } else {
        const was = r.since != null;
        if (was && this.persist(r, false, 0, t) === -1)
          this.addTl("c1", "Camada 1", 'Regra "Parada cardíaca" desarmou: condição deixou de ser verdadeira.');
        if (!was) this.persist(r, false, 0, t);
        r.status = "ok";
        r.label = "Monitorando";
        r.detail = "";
      }
    }
    /* R2 falta de ar corpo */
    {
      const r = R.r2;
      if (r.fired) {
        r.status = "crit";
        r.label = "Disparado";
        r.detail = "Alarme ativo.";
      } else if (v.spo2 == null) {
        this.persist(r, false, 0, t);
        r.status = "na";
        r.label = "Sem dado";
        r.detail = 'SpO₂ inválida sem pulso no PPG. "Sem dado" não é "normal".';
      } else {
        const crit = v.spo2 < 90 || v.rr > 30;
        const w = v.spo2 < 94;
        if (crit) {
          const e = this.persist(r, true, 15, t);
          if (e === 0)
            this.addTl("c1", "Camada 1", `Regra "Falta de ar (corpo)" armou: ${v.spo2 < 90 ? "SpO₂ " + fmtN(v.spo2) + "%" : "FR " + fmtN(v.rr) + " rpm"}. Contando 15 s.`);
          r.status = "warn";
          r.label = "Armando";
          r.detail = `Condição crítica há ${fmtN(e, 1)} s de 15 s. Cabine: ${v.co2 >= 4 ? "alterada" : "normal"}.`;
          if (e >= 15) {
            const amb = v.co2 >= 4;
            this.fireCritical(
              "r2",
              "Falta de ar: " + (amb ? "possível causa ambiental" : "origem provável no corpo"),
              `SpO₂ ${fmtN(v.spo2)}%, FR ${fmtN(v.rr)} rpm por 15 s; cabine ${amb ? "alterada" : "normal"}`
            );
          }
        } else if (w) {
          r.since2 = r.since2 ?? t;
          this.persist(r, false, 0, t);
          const e = t - r.since2;
          r.status = "warn";
          r.label = r.warned ? "Aviso" : "Observando";
          r.detail = `SpO₂ ${fmtN(v.spo2)}% abaixo de 94% há ${fmtN(e, 1)} s.`;
          r.need = 15;
          r.prog = e;
          if (e >= 15 && !r.warned) {
            r.warned = true;
            this.warn("r2", "aviso", `Aviso: SpO₂ abaixo de 94% por 15 s (${fmtN(v.spo2)}%). Tripulante orientada a medir de novo.`, "Oxigenação abaixo de 94%");
            this.chips.wn = 1;
          }
        } else {
          r.since2 = null;
          this.persist(r, false, 0, t);
          r.status = "ok";
          r.label = "Monitorando";
          r.detail = "";
        }
        if (!w) r.since2 = null;
      }
    }
    /* R3 cabine */
    {
      const r = R.r3;
      if (r.fired) {
        r.status = "crit";
        r.label = "Disparado";
        r.detail = "Alarme do veículo ativo, toda a tripulação avisada.";
      } else if (v.co2 >= 8) {
        this.addTl("c1", "Camada 1", "Alarme de CO₂ recebido do sistema de suporte de vida do veículo.");
        this.fireCritical("r3", "Falta de ar: CO₂ da cabine elevado", `ppCO₂ ${fmtN(v.co2, 1)} mmHg`, "toda a tripulação");
      } else if (v.co2 >= 4) {
        const e = this.persist(r, true, 5, t);
        r.status = "warn";
        r.label = r.warned ? "Aviso" : "Armando";
        r.detail = `ppCO₂ ${fmtN(v.co2, 1)} mmHg. FR de Marina: ${fmtN(v.rr)} rpm.`;
        r.prog = e;
        r.need = 5;
        if (e >= 5 && !r.warned) {
          r.warned = true;
          this.warn("r3", "aviso", `Aviso de cabine: ppCO₂ ${fmtN(v.co2, 1)} mmHg acima de 4 por 5 s. Tripulação avisada.`, "CO₂ da cabine acima de 4 mmHg");
        }
      } else {
        this.persist(r, false, 0, t);
        r.status = "ok";
        r.label = "Monitorando";
        r.detail = "";
      }
    }
    /* R4 impacto */
    {
      const r = R.r4;
      if (r.fired) {
        r.status = "crit";
        r.label = "Disparado";
        r.detail = "Pedido de ajuda ou falta de resposta após impacto.";
      } else if (this.prompt && this.prompt.rule === "r4") {
        r.status = "warn";
        r.label = "Verificando";
        r.detail = "Aguardando resposta do tripulante.";
      } else if (v.peak >= 4) {
        this.addTl("c1", "Camada 1", `Pico de aceleração de ${fmtN(v.peak, 1)} g detectado. Impacto não prova lesão: abrindo verificação.`);
        this.openPrompt("r4", 20, `Impacto de ${fmtN(v.peak, 1)} g detectado.`);
      } else if (!(r.status !== "ok" && !this.prompt && r.detail.startsWith("Tripulante"))) {
        r.status = "ok";
        r.label = "Monitorando";
        r.detail = "";
      }
    }
    /* R5 integridade */
    {
      const r = R.r5;
      if (v.leadOff) {
        const e = this.persist(r, true, 3, t);
        r.status = "warn";
        r.label = e >= 3 ? "Aviso técnico" : "Armando";
        r.detail = "Eletrodo do peito sem contato. Ajuste o eletrodo.";
        r.prog = e;
        r.need = 3;
        if (e >= 3 && !r.warned) {
          r.warned = true;
          this.warn("r5", "tecnico", "Aviso técnico: eletrodo do peito sem contato há 3 s. Pedido para ajustar o eletrodo. Não é emergência.", "Contato do eletrodo perdido");
        }
      } else {
        if (r.warned) {
          this.addTl("c1", "Camada 1", "Contato do eletrodo restabelecido. Aviso técnico encerrado.");
          this.sqlEv("r5", "aviso", "encerrado", {});
          r.warned = false;
        }
        this.persist(r, false, 0, t);
        r.status = "ok";
        r.label = "Monitorando";
        r.detail = "";
      }
    }
  }

  private watchdog(t: number) {
    if (this.aiAlive()) {
      this.lastAiBeat = t;
      if (this.aiStatus !== "ok") {
        this.aiStatus = "ok";
        this.addTl("cw", "Watchdog", "Heartbeat do modelo voltou. IA disponível de novo.");
      }
    } else if (this.aiStatus === "ok" && t - this.lastAiBeat >= 3) {
      this.aiStatus = "down";
      this.addTl("cw", "Watchdog", "3 s sem heartbeat do processo do modelo. IA marcada como indisponível. Alarmes não são afetados.");
      this.sqlEv("watchdog_ia", "tecnico", "aberto", { sem_heartbeat_s: 3 });
      this.createEvent({
        ruleId: null,
        title: "IA indisponível (watchdog)",
        detail: "3 s sem heartbeat do processo do modelo. O caminho crítico do alarme não é afetado.",
        severity: "tecnico",
        scope: "Diagnóstico",
        timeline: [{ t: this.t, layer: "cw", text: "Watchdog marcou a IA como indisponível." }]
      });
    }
  }

  /* ---------- laço principal ---------- */
  advance(real: number) {
    const target = this.t + real * this.speed;
    const dt = 1 / FS;
    while (this.t + dt <= target) {
      this.t += dt;
      const st = SCEN[this.scen].at(this.t);
      this.phase += ((st.hr > 0 ? st.hr : 60) / 60) * dt;
      if (this.phase >= 1) this.phase -= 1;
      this.ecg[this.wi] = ecgSample(st, this.t, this.phase);
      this.ppg[this.wi] = ppgSample(st, this.t, this.phase);
      this.wi = (this.wi + 1) % this.ecg.length;
      if (this.t >= this.nextTick) {
        const tt = this.nextTick;
        this.tt = tt;
        this.nextTick += TICK;
        const evs = SCEN[this.scen].events;
        while (this.evIdx < evs.length && evs[this.evIdx].t <= this.t) {
          const e = evs[this.evIdx++];
          if (e.type === "aiCrash") {
            this.aiCrashed = true;
            this.addTl("cs", "Sistema", "Simulação de falha: processo do modelo local travou.");
          }
        }
        const v = this.reading(this.t);
        this.v = v;
        this.hist.push({ t: this.t, hrE: v.hrE, hrP: v.hrP, spo2: v.spo2, rr: v.rr, peak: v.peak, co2: v.co2, press: v.press, leadOff: v.leadOff });
        if (this.hist.length > 260) this.hist.shift();
        const seen: Partial<Record<SignalKey, number | null>> = {
          hrE: v.hrE,
          hrP: v.hrP,
          spo2: v.spo2,
          rr: v.rr,
          peak: v.peak,
          co2: v.co2,
          press: v.press,
          lead: 1
        };
        (Object.keys(seen) as SignalKey[]).forEach((k) => {
          if (seen[k] != null) this.lastSeen[k] = this.t;
        });
        this.watchdog(tt);
        this.evalRules(v, tt);
        if (this.prompt && tt - this.prompt.t0 + EPS >= this.prompt.dur) {
          const p = this.prompt;
          this.prompt = null;
          this.addTl("ct", "Tripulação", `Sem resposta em ${p.dur} s. Escalando para alarme crítico.`, true);
          this.fireCritical(
            p.rule,
            p.rule === "r4" ? "Sem resposta após impacto" : "Sem resposta com sensores sem sinal",
            `sem resposta em ${p.dur} s após verificação`,
            "toda a tripulação e responsável médico"
          );
        }
        for (let i = this.sched.length - 1; i >= 0; i--)
          if (this.sched[i].t <= this.t) {
            const f = this.sched[i].fn;
            this.sched.splice(i, 1);
            f();
          }
      }
    }
  }

  uiTick(now: number) {
    this.beep(now);
    if (now - this.lastNotify > 120) {
      this.lastNotify = now;
      this.notify();
    }
  }

  /* ---------- som do alarme ---------- */
  enableAudio() {
    try {
      if (!this.actx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.actx = new Ctx();
      }
      void this.actx.resume();
    } catch {
      this.soundAlarm = false;
    }
  }
  private beep(now: number) {
    if (!this.soundAlarm || !this.actx || !this.running) return;
    const live = this.events.some((e) => e.severity === "critico" && e.state !== "encerrado" && !e.muted);
    if (!live) return;
    if (now < this.nextBeep) return;
    this.nextBeep = now + 1000;
    [0, 0.22].forEach((o, i) => {
      const os = this.actx!.createOscillator();
      const gn = this.actx!.createGain();
      os.type = "square";
      os.frequency.value = i ? 880 : 660;
      gn.gain.value = 0.05;
      os.connect(gn).connect(this.actx!.destination);
      const t0 = this.actx!.currentTime + o;
      os.start(t0);
      os.stop(t0 + 0.16);
    });
  }
  stopSound() {
    this.soundAlarm = false;
  }

  /* ---------- watchdog view ---------- */
  watchdogRows(): WatchdogRow[] {
    const v = this.v;
    const aiAlive = this.aiAlive();
    return [
      { name: "Motor de regras", state: "ok", detail: "tick 250 ms" },
      { name: "Sensores", state: v && v.leadOff ? "warn" : v ? "ok" : "na", detail: v && v.leadOff ? "ECG sem contato" : "dados recentes" },
      {
        name: "IA local",
        state: this.aiStatus === "ok" ? (aiAlive ? "ok" : "warn") : "crit",
        detail:
          this.aiStatus === "ok"
            ? aiAlive
              ? "heartbeat 1 s"
              : `sem heartbeat há ${fmtN(this.t - this.lastAiBeat, 1)} s`
            : "indisponível"
      },
      {
        name: "Enlace com a Terra",
        state: "ok",
        detail: "atraso " + (this.loc === "marte" ? "~12 min" : this.loc === "lua" ? "~1,3 s" : "< 1 s")
      }
    ];
  }

  signalValue(key: SignalKey): number | null {
    const v = this.v;
    if (!v) return null;
    const values: Record<SignalKey, number | null> = {
      hrE: v.hrE,
      hrP: v.hrP,
      spo2: v.spo2,
      rr: v.rr,
      peak: v.peak,
      co2: v.co2,
      press: v.press,
      lead: v.leadOff ? 0 : 1
    };
    return values[key];
  }
  lastSeenAge(key: SignalKey): number | null {
    const seen = this.lastSeen[key];
    return seen == null ? null : this.t - seen;
  }

  setScenario(id: ScenarioId) {
    this.reset({ scen: id });
  }
  setLocation(id: LocationId) {
    this.loc = id;
    this.addTl("cs", "Sistema", `Local alterado para ${LOC[id].name}. Atraso até a Terra: ${LOC[id].txt}.`);
    this.notify();
  }
  setSpeed(s: number) {
    this.speed = s;
    this.notify();
  }
  toggleRunning() {
    this.running = !this.running;
    this.notify();
  }
  toggleAi() {
    this.aiEnabled = !this.aiEnabled;
    this.addTl(
      "cs",
      "Sistema",
      this.aiEnabled
        ? this.aiCrashed
          ? "IA religada pelo usuário, mas o processo do cenário continua travado."
          : "IA local religada pelo usuário."
        : "IA local desligada pelo usuário (simula falha do modelo)."
    );
    this.notify();
  }
  setSoundAlarm(on: boolean) {
    this.soundAlarm = on;
    if (on) this.enableAudio();
    this.notify();
  }
  setAutoRead(on: boolean) {
    this.autoRead = on;
    this.notify();
  }
  setSpeakAlarm(on: boolean) {
    this.speakAlarm = on;
    this.notify();
  }
}

export const engine = new SimEngine();
export { BASE, SCEN, LOC, SIGNALS };
