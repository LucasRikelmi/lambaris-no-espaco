import datetime as dt
import importlib.util
import json
import pathlib
import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from core.detectores import DETECTORES

PASTA_DADOS = pathlib.Path("dados")
BANCO_SQLITE = PASTA_DADOS / "lambaris.db"
ARQUIVO_MARINA = PASTA_DADOS / "serie_marina.csv"
ARQUIVO_EXAMES = PASTA_DADOS / "exames_ref.csv"
ARQUIVO_VENCEDOR = PASTA_DADOS / "metodo_vencedor.json"

# Carrega funcao de busca do script 05_ingerir_conhecimento.py
_spec = importlib.util.spec_from_file_location("ingerir_conhecimento", "05_ingerir_conhecimento.py")
_mod_conhecimento = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod_conhecimento)
buscar_conhecimento = _mod_conhecimento.buscar_conhecimento

app = FastAPI(title="Lambaris no Espaço — API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variavel de estado do link de comunicacao com a Terra ("online" | "offline")
link_state: str = "online"

TRIPULANTES = {
    "C01": {"id": "C01", "nome": "Lucas", "papel": "Comandante"},
    "C02": {"id": "C02", "nome": "Marina", "papel": "Especialista de Missão"},
    "C03": {"id": "C03", "nome": "Rafael", "papel": "Piloto"},
    "C04": {"id": "C04", "nome": "Helena", "papel": "Oficial Médica"},
}


class CheckinEntrada(BaseModel):
    tripulante: str = "C02"
    dia_missao: int = 30
    fadiga: int = 4  # escala 1 a 5
    humor: str = "cansada, dificuldade de concentracao"
    relato: str = "Acordei várias vezes durante a noite e sinto fadiga acumulada nas últimas 3 noites."
    origem: str = "demo"
    fonte: str = "Auto-relato diário da tripulação (Check-in)"


class EstadoLinkEntrada(BaseModel):
    link_state: str  # "online" | "offline"


def conectar_bd() -> sqlite3.Connection:
    PASTA_DADOS.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(BANCO_SQLITE)
    conn.row_factory = sqlite3.Row
    return conn


def inicializar_bd() -> None:
    with conectar_bd() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS checkins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tripulante TEXT NOT NULL,
                dia_missao INTEGER NOT NULL,
                fadiga INTEGER NOT NULL,
                humor TEXT NOT NULL,
                relato TEXT NOT NULL,
                origem TEXT NOT NULL,
                fonte TEXT NOT NULL,
                criado_em TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_evento TEXT NOT NULL,
                tripulante TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pendente',
                origem TEXT NOT NULL,
                fonte TEXT NOT NULL,
                criado_em TEXT NOT NULL,
                enviado_em TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS telemetria_terra (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                outbox_id INTEGER NOT NULL,
                tipo_evento TEXT NOT NULL,
                tripulante TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                recebido_em TEXT NOT NULL
            )
            """
        )
        conn.commit()


inicializar_bd()


def registrar_evento_outbox(tipo_evento: str, tripulante: str, payload: dict, origem: str = "demo", fonte: str = "Sistema Local de Bordo") -> dict:
    agora = dt.datetime.now(dt.timezone.utc).isoformat()
    status_inicial = "enviado" if link_state == "online" else "pendente"
    enviado_em = agora if link_state == "online" else None

    with conectar_bd() as conn:
        cur = conn.execute(
            """
            INSERT INTO outbox (tipo_evento, tripulante, payload_json, status, origem, fonte, criado_em, enviado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tipo_evento,
                tripulante,
                json.dumps(payload, ensure_ascii=False),
                status_inicial,
                origem,
                fonte,
                agora,
                enviado_em,
            ),
        )
        conn.commit()
        evento_id = cur.lastrowid

    return {
        "id": evento_id,
        "tipo_evento": tipo_evento,
        "status": status_inicial,
        "link_state": link_state,
    }


def contar_outbox() -> dict:
    with conectar_bd() as conn:
        pendentes = conn.execute("SELECT COUNT(*) AS n FROM outbox WHERE status = 'pendente'").fetchone()["n"]
        enviados = conn.execute("SELECT COUNT(*) AS n FROM outbox WHERE status = 'enviado'").fetchone()["n"]
    return {
        "pendentes": int(pendentes),
        "enviados": int(enviados),
        "total": int(pendentes + enviados),
    }


def obter_metodo_vencedor() -> str:
    if ARQUIVO_VENCEDOR.exists():
        dados = json.loads(ARQUIVO_VENCEDOR.read_text(encoding="utf-8"))
        return dados.get("metodo_vencedor", "cusum")
    return "cusum"


def carregar_serie_marina() -> list[dict]:
    import pandas as pd

    df = pd.read_csv(ARQUIVO_MARINA)
    return df.to_dict(orient="records")


def carregar_exames(tripulante: str) -> list[dict]:
    import pandas as pd

    if not ARQUIVO_EXAMES.exists():
        return []
    df = pd.read_csv(ARQUIVO_EXAMES)
    sub = df[df["tripulante"] == tripulante]
    return sub.to_dict(orient="records")


def obter_ultimo_checkin(tripulante: str) -> dict | None:
    with conectar_bd() as conn:
        linha = conn.execute(
            "SELECT * FROM checkins WHERE tripulante = ? ORDER BY id DESC LIMIT 1",
            (tripulante,),
        ).fetchone()
    return dict(linha) if linha else None


def avaliar_alerta_marina() -> dict:
    registros = carregar_serie_marina()
    metodo = obter_metodo_vencedor()
    fn_detector = DETECTORES.get(metodo, DETECTORES["cusum"])

    duracoes = [float(r["duracao_total_min"]) for r in registros]
    resultado = fn_detector(duracoes, dias_base=10)

    # Identifica os registros que sustentam o alerta estritamente a partir dos dias apontados pelo detector
    dias_flagrados = set(resultado["dias_alerta"])
    registros_sustentacao = [
        r for r in registros if r["dia_missao"] in dias_flagrados
    ]

    media_base = resultado["media_baseline"]
    dp_base = resultado["desvio_baseline"]
    base_recente = registros_sustentacao if registros_sustentacao else registros[-3:]
    media_recente = round(sum(r["duracao_total_min"] for r in base_recente) / len(base_recente), 1)
    diferenca_min = round(media_recente - media_base, 1)

    return {
        "id": 1,
        "tripulante": "C02",
        "nome": "Marina",
        "metodo_detector": metodo,
        "deterministico": True,
        "alerta_ativo": resultado["alerta"],
        "severidade": "atencao" if resultado["alerta"] else "normal",
        "metrica": "duracao_total_min",
        "media_baseline_min": media_base,
        "desvio_baseline_min": dp_base,
        "faixa_individual_min": [round(media_base - 2 * dp_base, 1), round(media_base + 2 * dp_base, 1)],
        "media_ultimas_3_noites_min": media_recente,
        "variacao_min": diferenca_min,
        "dias_alerta": resultado["dias_alerta"],
        "primeiro_dia_alerta": resultado["primeiro_dia_alerta"],
        "registros_sustentacao": registros_sustentacao,
        "origem": "demo",
        "fonte": f"Detector estatístico determinístico ({metodo.upper()}) sobre dados/serie_marina.csv",
    }


def montar_resumo_template(alerta: dict, checkin: dict | None, trechos: list[dict]) -> dict:
    regs = alerta["registros_sustentacao"]
    citacoes_registros = ", ".join(
        f"Dia {r['dia_missao']}: {r['duracao_total_min']} min (eficiência {r['eficiencia_pct']}%, WASO {r['tempo_acordado_apos_dormir_min']} min, origem={r['origem']})"
        for r in regs
    )

    if checkin:
        bloco_checkin = (
            f"Check-in registrado no dia {checkin['dia_missao']} "
            f"(fadiga={checkin['fadiga']}/5, humor='{checkin['humor']}', origem={checkin['origem']}, fonte='{checkin['fonte']}'): "
            f"\"{checkin['relato']}\""
        )
    else:
        bloco_checkin = "Nenhum check-in recente registrado até o momento."

    fontes_formatadas = [
        f"[{i}] {t['fonte']} (origem={t['origem']}, score={t['score']})"
        for i, t in enumerate(trechos, start=1)
    ]

    # Extrai dinamica de evidencia diretamente do trecho mais relevante recuperado no Qdrant
    evidencia_topo = ""
    if trechos:
        evidencia_topo = trechos[0]["texto"][:220].strip() + "..."

    texto_resumo = (
        f"ALERTA DETERMINÍSTICO ({alerta['metodo_detector'].upper()}): A astronauta {alerta['nome']} ({alerta['tripulante']}) "
        f"apresentou queda média de {abs(alerta['variacao_min']):.1f} min na duração de sono nos dias sinalizados pelo detector "
        f"(média nos dias em alerta: {alerta['media_ultimas_3_noites_min']} min vs. padrão individual de {alerta['media_baseline_min']} ± {alerta['desvio_baseline_min']} min nos dias 1–10). "
        f"Registros que sustentam o alerta: {citacoes_registros}. "
        f"{bloco_checkin} "
        f"Evidência recuperada para suporte de decisão ({trechos[0]['fonte'] if trechos else 'Qdrant'}): \"{evidencia_topo}\" "
        f"Fontes consultadas: {'; '.join(fontes_formatadas)}."
    )

    return {
        "texto": texto_resumo,
        "gerado_por": "template_deterministico",
        "o_que_mudou": {
            "baseline_min": alerta["media_baseline_min"],
            "media_recente_min": alerta["media_ultimas_3_noites_min"],
            "variacao_min": alerta["variacao_min"],
            "dias_alerta": alerta["dias_alerta"],
            "registros_citados": regs,
        },
        "checkin_associado": checkin,
        "fontes_conhecimento": trechos,
        "origem": "demo",
        "fonte": "Template Determinístico + Qdrant Local (knowledge)",
    }


@app.get("/", include_in_schema=False)
def raiz():
    return RedirectResponse(url="/docs")


@app.get("/overview")
def listar_overview():
    alerta_c02 = avaliar_alerta_marina()
    visao_tripulacao = []

    for codigo, info in TRIPULANTES.items():
        exames = carregar_exames(codigo)
        fora_faixa = [e for e in exames if e["status"] != "normal"]
        em_alerta = codigo == "C02" and alerta_c02["alerta_ativo"]
        visao_tripulacao.append({
            "tripulante": codigo,
            "nome": info["nome"],
            "papel": info["papel"],
            "status_geral": "alerta" if em_alerta else "estavel",
            "alertas_ativos": 1 if em_alerta else 0,
            "exames_fora_faixa_ref": len(fora_faixa),
            "origem": "demo" if codigo == "C02" else "terrestre",
            "fonte": "serie_marina.csv + OSD-569" if codigo == "C02" else "NASA OSDR OSD-569 (pre/pos-voo)",
        })

    return {
        "missao": "Lambaris no Espaço",
        "link_state": link_state,
        "outbox": contar_outbox(),
        "metodo_detector_vencedor": obter_metodo_vencedor(),
        "tripulacao": visao_tripulacao,
        "alertas_ativos": [alerta_c02] if alerta_c02["alerta_ativo"] else [],
    }


@app.get("/astronaut/{astronaut_id}")
def obter_astronauta(astronaut_id: str):
    codigo = astronaut_id.upper()
    if codigo not in TRIPULANTES:
        raise HTTPException(status_code=404, detail=f"Tripulante {codigo} não encontrado.")

    info = TRIPULANTES[codigo]
    exames = carregar_exames(codigo)
    ultimo_checkin = obter_ultimo_checkin(codigo)

    with conectar_bd() as conn:
        historico_checkins = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM checkins WHERE tripulante = ? ORDER BY id DESC LIMIT 10",
                (codigo,),
            ).fetchall()
        ]

    resposta = {
        "tripulante": codigo,
        "nome": info["nome"],
        "papel": info["papel"],
        "link_state": link_state,
        "exames_ref": exames,
        "ultimo_checkin": ultimo_checkin,
        "historico_checkins": historico_checkins,
    }

    if codigo == "C02":
        alerta = avaliar_alerta_marina()
        resposta["serie_sono"] = carregar_serie_marina()
        resposta["alerta_atual"] = alerta
    else:
        resposta["serie_sono"] = []
        resposta["alerta_atual"] = None

    return resposta


@app.get("/alerts/{alert_id}")
def obter_alerta(alert_id: int):
    if alert_id != 1:
        raise HTTPException(status_code=404, detail=f"Alerta {alert_id} não encontrado.")

    alerta = avaliar_alerta_marina()
    checkin = obter_ultimo_checkin("C02")
    consulta = "sono insuficiente fadiga circadiano contramedidas em astronautas"
    trechos = buscar_conhecimento(consulta, top_k=3)
    resumo = montar_resumo_template(alerta, checkin, trechos)

    # Se estiver offline, tambem registra a geracao do resumo de alerta na outbox para sincronizar depois
    evento_outbox = None
    if link_state == "offline":
        evento_outbox = registrar_evento_outbox(
            tipo_evento="alerta_resumo",
            tripulante="C02",
            payload={
                "alert_id": alert_id,
                "dias_alerta": alerta["dias_alerta"],
                "variacao_min": alerta["variacao_min"],
                "checkin_id": checkin["id"] if checkin else None,
                "fontes": [t["fonte"] for t in trechos],
            },
            origem="demo",
            fonte="Assistente Local Lambaris",
        )

    return {
        "alerta": alerta,
        "resumo": resumo,
        "link_state": link_state,
        "outbox": contar_outbox(),
        "evento_outbox": evento_outbox,
    }


@app.post("/checkin")
def criar_checkin(dados: CheckinEntrada):
    agora = dt.datetime.now(dt.timezone.utc).isoformat()
    codigo = dados.tripulante.upper()

    with conectar_bd() as conn:
        cur = conn.execute(
            """
            INSERT INTO checkins (tripulante, dia_missao, fadiga, humor, relato, origem, fonte, criado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                codigo,
                dados.dia_missao,
                dados.fadiga,
                dados.humor,
                dados.relato,
                dados.origem,
                dados.fonte,
                agora,
            ),
        )
        conn.commit()
        checkin_id = cur.lastrowid

    checkin_salvo = {
        "id": checkin_id,
        "tripulante": codigo,
        "dia_missao": dados.dia_missao,
        "fadiga": dados.fadiga,
        "humor": dados.humor,
        "relato": dados.relato,
        "origem": dados.origem,
        "fonte": dados.fonte,
        "criado_em": agora,
    }

    evento = registrar_evento_outbox(
        tipo_evento="checkin",
        tripulante=codigo,
        payload=checkin_salvo,
        origem=dados.origem,
        fonte=dados.fonte,
    )

    # Gera resumo atualizado se for a Marina (C02)
    resumo_atualizado = None
    if codigo == "C02":
        alerta = avaliar_alerta_marina()
        trechos = buscar_conhecimento("sono insuficiente fadiga circadiano em astronautas", top_k=3)
        resumo_atualizado = montar_resumo_template(alerta, checkin_salvo, trechos)

    return {
        "checkin": checkin_salvo,
        "evento_outbox": evento,
        "link_state": link_state,
        "outbox": contar_outbox(),
        "resumo_atualizado": resumo_atualizado,
    }


@app.get("/link")
@app.get("/outbox")
def ler_estado_e_outbox():
    with conectar_bd() as conn:
        itens = [
            dict(r)
            for r in conn.execute("SELECT * FROM outbox ORDER BY id DESC LIMIT 50").fetchall()
        ]
    return {
        "link_state": link_state,
        "contador": contar_outbox(),
        "eventos": itens,
    }


@app.post("/link")
def alterar_estado_link(entrada: EstadoLinkEntrada):
    global link_state
    novo = entrada.link_state.strip().lower()
    if novo not in {"online", "offline"}:
        raise HTTPException(status_code=400, detail="link_state deve ser 'online' ou 'offline'.")
    link_state = novo
    return {
        "link_state": link_state,
        "outbox": contar_outbox(),
    }


@app.post("/sync")
def sincronizar_outbox():
    global link_state
    link_state = "online"
    agora = dt.datetime.now(dt.timezone.utc).isoformat()

    with conectar_bd() as conn:
        pendentes = conn.execute("SELECT * FROM outbox WHERE status = 'pendente' ORDER BY id ASC").fetchall()
        pacotes_transmitidos = []
        for item in pendentes:
            conn.execute(
                """
                INSERT INTO telemetria_terra (outbox_id, tipo_evento, tripulante, payload_json, recebido_em)
                VALUES (?, ?, ?, ?, ?)
                """,
                (item["id"], item["tipo_evento"], item["tripulante"], item["payload_json"], agora),
            )
            pacotes_transmitidos.append({
                "outbox_id": item["id"],
                "tipo_evento": item["tipo_evento"],
                "tripulante": item["tripulante"],
            })

        cur = conn.execute(
            """
            UPDATE outbox
            SET status = 'enviado', enviado_em = ?
            WHERE status = 'pendente'
            """,
            (agora,),
        )
        conn.commit()
        sincronizados = cur.rowcount

    return {
        "sincronizados": int(sincronizados),
        "pacotes_transmitidos_terra": pacotes_transmitidos,
        "sincronizado_em": agora,
        "link_state": link_state,
        "outbox": contar_outbox(),
    }
