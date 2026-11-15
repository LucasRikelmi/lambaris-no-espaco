"""Gera a série de sono SIMULADA da demo e aplica a regra de alerta determinística.

DADOS SIMULADOS. Nenhum valor vem de astronauta real nem do Sleep-EDF.
Os parâmetros abaixo são escolhas de design para a demo, não estimativas publicadas.

Uso: python3 -I simular_sono.py  -> sono_simulado_demo.csv
"""
import csv
import random
import statistics
from datetime import date, timedelta
from pathlib import Path

SEED = 42
INICIO = date(2026, 3, 1)       # data fictícia
NOITES_PRE_VOO = 7              # em solo, antes do lançamento
NOITES_VOO = 30
# Parâmetros (horas de sono total por noite)
MEDIA_SOLO, DP_SOLO = 7.2, 0.40
MEDIA_VOO, DP_VOO = 6.5, 0.45
DIA_TROCA_TURNO = 20            # dia de voo em que o turno muda
NOITES_CURTAS = [5.1, 4.8, 5.0, 5.6]  # roteiro do cenário: queda persistente após a troca
# Regra de alerta (mesma do pitch)
JANELA_BASE = 7
LIMIAR_Z = -1.5
PERSISTENCIA = 3
DP_MINIMO = 0.25                # evita z explosivo quando a linha de base é muito estável
# Sem isto, a queda esperada de sono na adaptação ao voo (solo -> voo) dispara alerta nos
# primeiros dias de missão. A linha de base reinicia na mudança de fase.
BASE_REINICIA_NA_FASE = True

RELATOS = {
    DIA_TROCA_TURNO: "Troca de turno para o período noturno da estação.",
    DIA_TROCA_TURNO + 2: "Cansada, leve dor de cabeça, dificuldade para pegar no sono.",
    DIA_TROCA_TURNO + 5: "Me sentindo melhor depois do ajuste de horário.",
}


def gerar():
    rng = random.Random(SEED)
    noites = []
    for i in range(NOITES_PRE_VOO + NOITES_VOO):
        em_voo = i >= NOITES_PRE_VOO
        dia_voo = i - NOITES_PRE_VOO + 1 if em_voo else None
        idx_curta = (dia_voo - DIA_TROCA_TURNO) if em_voo else -1
        if 0 <= idx_curta < len(NOITES_CURTAS):
            tst = NOITES_CURTAS[idx_curta] + rng.gauss(0, 0.1)
        elif em_voo:
            tst = rng.gauss(MEDIA_VOO, DP_VOO)
        else:
            tst = rng.gauss(MEDIA_SOLO, DP_SOLO)
        tst = round(min(max(tst, 3.5), 9.0), 2)
        eficiencia = round(min(97, max(70, rng.gauss(88 if tst >= 6 else 80, 3))), 1)
        tempo_cama = round(tst / (eficiencia / 100), 2)
        latencia = max(3, round(rng.gauss(14 if tst >= 6 else 32, 5)))
        despertares = max(0, round(rng.gauss(2 if tst >= 6 else 5, 1)))
        noites.append({
            "simulado": "SIM",
            "data": (INICIO + timedelta(days=i)).isoformat(),
            "fase": "voo" if em_voo else "pre_voo_solo",
            "dia_voo": dia_voo if em_voo else f"L-{NOITES_PRE_VOO - i}",
            "sono_total_h": tst,
            "tempo_na_cama_h": tempo_cama,
            "eficiencia_pct": eficiencia,
            "latencia_min": latencia,
            "despertares": despertares,
            "relato_astronauta": RELATOS.get(dia_voo, "") if em_voo else "",
        })
    return noites


def aplicar_regra(noites):
    """Alerta quando PERSISTENCIA noites seguidas têm z <= LIMIAR_Z contra as JANELA_BASE
    noites anteriores à janela avaliada (a janela não contamina a própria linha de base)."""
    tst = [n["sono_total_h"] for n in noites]
    for t, n in enumerate(noites):
        ini_janela = t - PERSISTENCIA + 1
        idx_base = range(max(0, ini_janela - JANELA_BASE), max(0, ini_janela))
        if BASE_REINICIA_NA_FASE:
            idx_base = [k for k in idx_base if noites[k]["fase"] == n["fase"]]
        base = [tst[k] for k in idx_base]
        if len(base) < JANELA_BASE:
            n.update(base_media_h="", base_dp_h="", z="", alerta="sem_base")
            continue
        mu = statistics.mean(base)
        dp = max(statistics.stdev(base), DP_MINIMO)
        zs = [(tst[k] - mu) / dp for k in range(ini_janela, t + 1)]
        n.update(base_media_h=round(mu, 2), base_dp_h=round(dp, 2), z=round(zs[-1], 2),
                 alerta="ALERTA" if all(z <= LIMIAR_Z for z in zs) else "")
    return noites


if __name__ == "__main__":
    noites = aplicar_regra(gerar())
    out = Path(__file__).resolve().parent / "sono_simulado_demo.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(noites[0].keys()))
        w.writeheader()
        w.writerows(noites)
    for n in noites:
        print(n["dia_voo"], n["sono_total_h"], n["base_media_h"], n["z"], n["alerta"])
