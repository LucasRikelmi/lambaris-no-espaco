export type ScenarioId = "normal" | "parada" | "dispneia" | "cabine" | "impacto" | "sensor" | "falhaIA";
export type LocationId = "leo" | "lua" | "marte";
export type SignalKey = "hrE" | "hrP" | "spo2" | "rr" | "peak" | "co2" | "press" | "lead";
export type SignalGroup = "tripulante" | "cabine" | "coleta";

export interface ScenarioSignals {
  rhythm: "sinus" | "vf" | "asys";
  hr: number;
  ppg: number;
  spo2: number | null;
  rr: number;
  act: number;
  peak: number;
  leadOff: boolean;
  co2: number;
  press: number;
}

export interface ScenarioExplanation {
  title: string;
  what: string;
  rule: string;
  why: string;
  blind: string;
}

export interface Scenario {
  id: ScenarioId;
  tag: string;
  tone: "ok" | "warn" | "crit" | "info";
  name: string;
  short: string;
  at: (t: number) => ScenarioSignals;
  events: { t: number; type: "aiCrash" }[];
  focus: SignalKey[];
  exp: ScenarioExplanation;
}

export const BASE: ScenarioSignals = {
  rhythm: "sinus",
  hr: 68,
  ppg: 1,
  spo2: 98,
  rr: 14,
  act: 0.12,
  peak: 0,
  leadOff: false,
  co2: 2.6,
  press: 101.3
};

const S0 = (o: Partial<ScenarioSignals>): ScenarioSignals => ({ ...BASE, ...o });

function arrest(t: number, t0: number): ScenarioSignals {
  if (t < t0) return S0({});
  return S0({
    rhythm: t < t0 + 40 ? "vf" : "asys",
    hr: 0,
    ppg: 0,
    spo2: null,
    rr: t < t0 + 6 ? 5 : 0,
    act: 0.02,
    peak: t < t0 + 0.5 ? 1.4 : 0
  });
}

export const SCEN: Record<ScenarioId, Scenario> = {
  normal: {
    id: "normal",
    tag: "Base",
    tone: "ok",
    name: "Linha de base",
    short: "Sinais normais. Nada deve disparar.",
    at: (t) => S0({ hr: 68 + 3 * Math.sin(t / 9) }),
    events: [],
    focus: ["hrE", "spo2", "rr"],
    exp: {
      title: "Silêncio também é resultado",
      what: "Os sinais de Marina ficam dentro do esperado. Todas as regras rodam a cada 250 ms e nenhuma arma.",
      rule: "Nenhuma condição verdadeira. O watchdog confirma que motor de regras, sensores e IA estão respondendo.",
      why: "Um sistema de emergência passa quase todo o tempo calado. Alarme demais ensina a tripulação a ignorar alarme. Por isso cada regra exige persistência ou confirmação por um segundo sensor.",
      blind:
        "Os limiares de emergência são fixos. O padrão individual de cada astronauta entra nos alertas de tendência (como o sono), que não são emergência e passam por revisão."
    }
  },
  parada: {
    id: "parada",
    tag: "Crítico",
    tone: "crit",
    name: "Parada cardíaca",
    short: "FV no ECG e pulso some no PPG.",
    at: (t) => arrest(t, 10),
    events: [],
    focus: ["hrE", "hrP"],
    exp: {
      title: "Parada cardíaca: dois sensores concordam",
      what: "Em T+10 s o ECG passa a mostrar fibrilação ventricular e o PPG perde o pulso. A regra arma e conta 8 s. Em T+18 s dispara. Som, luz, aviso à tripulação e telemetria saem no mesmo instante. A IA só abre o checklist depois.",
      rule: "ECG em fibrilação ou sem QRS, e PPG sem pulso, por pelo menos 8 s, com o eletrodo em contato. O classificador de ritmo é algoritmo determinístico (detecção de QRS), não o LLM.",
      why: "Segundos importam. Um modelo quantizado rodando a bordo pode demorar, travar ou errar. Uma regra é previsível, auditável e testável com casos conhecidos.",
      blind:
        "Os 8 s são um compromisso entre rapidez e alarme falso, e precisam de validação clínica. Se os dois sensores caírem ao mesmo tempo com o tripulante se mexendo, a regra pergunta antes de disparar (veja \"Sensor solto\")."
    }
  },
  dispneia: {
    id: "dispneia",
    tag: "Crítico",
    tone: "crit",
    name: "Falta de ar (corpo)",
    short: "SpO₂ cai e respiração acelera.",
    at: (t) =>
      S0({
        hr: ramp(t, 6, 36, 70, 118),
        spo2: ramp(t, 6, 36, 98, 85),
        rr: ramp(t, 6, 36, 14, 34),
        act: 0.08
      }),
    events: [],
    focus: ["spo2", "rr"],
    exp: {
      title: "Falta de ar com origem no corpo",
      what: "A partir de T+6 s a SpO₂ cai e a frequência respiratória sobe. Primeiro sai um aviso amarelo (SpO₂ abaixo de 94% sustentada). Quando a SpO₂ passa de 90% para baixo e fica assim 15 s, o alarme crítico dispara.",
      rule: "SpO₂ < 90% ou FR > 30 rpm por 15 s. A regra de cabine continua normal, então o sistema classifica a origem como provável do corpo e avisa o tripulante e o responsável médico.",
      why: "Cruzar com a cabine responde à primeira pergunta da tripulação: o problema é de uma pessoa ou do ar que todos respiram?",
      blind:
        "Oxímetro com mão fria ou em movimento lê errado. O checklist começa por reposicionar e medir de novo, mas o alarme não espera essa checagem."
    }
  },
  cabine: {
    id: "cabine",
    tag: "Crítico",
    tone: "crit",
    name: "Falta de ar (cabine)",
    short: "CO₂ da cabine sobe para todos.",
    at: (t) =>
      S0({
        co2: ramp(t, 6, 40, 2.6, 11),
        rr: ramp(t, 14, 40, 14, 22),
        hr: ramp(t, 14, 40, 68, 88)
      }),
    events: [],
    focus: ["co2", "press", "rr"],
    exp: {
      title: "Falta de ar com origem na cabine",
      what: "A pressão parcial de CO₂ da cabine sobe. Acima de 4 mmHg sai um aviso. Ao passar de 8 mmHg o veículo emite seu próprio alarme, que o app espelha na hora para a tripulação inteira, sem janela de persistência.",
      rule: "ppCO₂ ≥ 8 mmHg ou queda de pressão acima de 1 kPa/min. O dado vem do sistema de suporte de vida do veículo. A FR de Marina subindo junto reforça a origem ambiental.",
      why: "Quando o ar é o problema, todos são afetados. O alarme vai para todos e o checklist começa pela cabine, não pelo tripulante.",
      blind: "O app não substitui os alarmes do próprio veículo. É uma camada a mais, que liga o dado de ambiente aos sinais de cada pessoa."
    }
  },
  impacto: {
    id: "impacto",
    tag: "Crítico",
    tone: "crit",
    name: "Impacto ou corte",
    short: "Pico de 6,5 g. Sem resposta, escala.",
    at: (t) =>
      S0({
        peak: t >= 8 && t < 8.3 ? 6.5 : 0,
        act: t >= 8.3 ? 0.02 : 0.12,
        hr: t < 8 ? 68 : ramp(t, 8, 12, 68, 104)
      }),
    events: [],
    focus: ["peak", "hrP"],
    exp: {
      title: "Impacto ou corte: o sensor não vê sangue",
      what: "Em T+8 s o acelerômetro registra um pico de 6,5 g. Impacto sozinho não prova lesão, então o app pergunta \"Você está bem?\" e conta 20 s. Se ninguém responde, o alarme crítico dispara, porque o tripulante pode estar inconsciente.",
      rule: "Pico ≥ 4 g abre a verificação. \"Preciso de ajuda\", botão de pânico ou palavra-chave de voz disparam na hora. Corte sem impacto depende só do relato.",
      why: "Sangramento não é detectável por sensor vestível. O sistema precisa de uma entrada humana rápida, que funcione com luvas e sem tela.",
      blind:
        "Reconhecimento de voz deve ser local e por palavra-chave, sem passar pelo LLM. Em microgravidade, bater em estrutura gera picos no uso normal, por isso a pergunta vem antes do alarme."
    }
  },
  sensor: {
    id: "sensor",
    tag: "Alarme falso",
    tone: "info",
    name: "Sensor solto",
    short: "ECG cai, mas o pulso continua.",
    at: (t) => S0({ leadOff: t >= 8 && t < 26, act: t >= 6 && t < 26 ? 0.3 : 0.12, hr: 74 }),
    events: [],
    focus: ["lead", "hrP", "hrE"],
    exp: {
      title: "Alarme falso evitado: sensor solto",
      what: "Em T+8 s o eletrodo do peito solta durante um exercício. O ECG perde o sinal, mas o PPG continua mostrando pulso e o acelerômetro mostra movimento. A regra de parada fica suprimida e sai só um aviso técnico para ajustar o eletrodo. Em T+26 s o contato volta.",
      rule: "Eletrodo sem contato e PPG com pulso suprime a regra de parada. Eletrodo sem contato por 3 s gera aviso técnico.",
      why: "Alarme falso repetido treina a tripulação a ignorar o alarme verdadeiro. Um segundo sensor independente resolve a maior parte dos casos.",
      blind:
        "A supressão nunca é permanente. Se o PPG também perder o pulso: sem movimento, dispara; com movimento, pergunta \"Você está bem?\" e escala se não houver resposta."
    }
  },
  falhaIA: {
    id: "falhaIA",
    tag: "Resiliência",
    tone: "info",
    name: "Falha da IA",
    short: "Modelo trava. Alarme continua.",
    at: (t) => arrest(t, 14),
    events: [{ t: 4, type: "aiCrash" }],
    focus: ["hrE", "hrP"],
    exp: {
      title: "O modelo falha e o alarme funciona",
      what: "Em T+4 s o processo do modelo local para de responder. O watchdog nota 3 s sem heartbeat e marca a IA como indisponível. Em T+14 s começa uma fibrilação. Em T+22 s a regra dispara e o alarme sai igual ao cenário normal. A camada 3 usa o checklist estático já indexado por regra.",
      rule: "Mesma regra de parada cardíaca. O watchdog do modelo é independente do motor de regras.",
      why: "Prova que o caminho crítico não passa pelo modelo. A IA melhora a resposta, mas a ausência dela não atrasa nada.",
      blind:
        "O fallback precisa ser mantido e testado junto com o modelo, senão fica desatualizado. Você pode desligar a IA em qualquer cenário pelo botão \"IA local\"."
    }
  }
};

export const ORDER: ScenarioId[] = ["normal", "parada", "dispneia", "cabine", "impacto", "sensor", "falhaIA"];

export interface Location {
  id: LocationId;
  name: string;
  side: string;
  delay: number;
  txt: string;
}

export const LOC: Record<LocationId, Location> = {
  leo: { id: "leo", name: "Estação", side: "Órbita baixa terrestre", delay: 0.5, txt: "menos de 1 s" },
  lua: { id: "lua", name: "Lua", side: "Base lunar", delay: 1.3, txt: "cerca de 1,3 s" },
  marte: { id: "marte", name: "Marte", side: "Trânsito a Marte", delay: 720, txt: "3 a 22 min conforme a posição; usamos 12 min" }
};

export function ramp(t: number, t0: number, t1: number, v0: number, v1: number): number {
  return t <= t0 ? v0 : t >= t1 ? v1 : v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
}
