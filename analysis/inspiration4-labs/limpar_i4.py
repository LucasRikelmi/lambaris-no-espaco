"""Limpa e unifica OSD-569 (CBC) e OSD-575 (CMP) do Inspiration4 em formato longo.

Uso: python3 -I limpar_i4.py  (roda na pasta dados-saude/)
Entradas: raw_OSD-569_CBC.csv, raw_OSD-575_CMP.csv (cópias sem alteração dos uploads)
Saídas:   i4_exames_longo.csv, i4_linha_base_pre_voo.csv
"""
import csv
import re
import statistics
from pathlib import Path

AQUI = Path(__file__).resolve().parent
DURACAO_MISSAO_DIAS = 3  # Inspiration4: lançamento 15/09/2021, amerissagem 18/09/2021
SEXO = {"C001": "M", "C002": "F", "C003": "F", "C004": "M"}  # metadados OSD-569
AUSENTE = {"", "NA", "N/A", "NaN", "nan"}
LINHAS_CORROMPIDAS = {("OSD-569", "C003", "L-92")}  # colunas rotacionadas, ver README
GLICOSE_LIMIAR_ARTEFATO = 54  # mg/dL; abaixo disso em adulto assintomático = suspeita pré-analítica

UNIDADES = {
    "cells_per_microliter": "células/µL", "percent": "%", "picogram": "pg",
    "grams_per_deciliter": "g/dL", "femtoliter": "fL", "thousand_per_microliter": "mil/µL",
    "million_per_microliter": "milhões/µL", "gram_per_deciliter": "g/dL",
    "units_per_liter": "U/L", "milligram_per_deciliter": "mg/dL", "millimol_per_liter": "mmol/L",
    "milliliter_per_minute_per_1.73_meter_squared": "mL/min/1,73m²", "": "razão",
}
# O cabeçalho do CBC rotula hemoglobina como "percent", mas os valores (11–17) e as faixas são g/dL.
CORRECAO_UNIDADE = {"hemoglobin": "g/dL"}

PAT = re.compile(r"^(?P<ind>.+?)_(?P<tipo>value|range_min|range_max|max)(?:_(?P<un>.+))?$")


def num(s):
    s = (s or "").strip()
    if s in AUSENTE:
        return None
    return float(s)


def parse_amostra(nome):
    partes = nome.split("_")
    trip, coleta = partes[0], partes[2]
    fase = "pre_voo" if coleta.startswith("L") else "pos_voo"
    n = int(coleta[1:])  # "L-92" -> -92, "R+1" -> 1
    dia_lanc = n if fase == "pre_voo" else DURACAO_MISSAO_DIAS + n
    return trip, coleta, fase, n, dia_lanc


def ler(arquivo, fonte, painel):
    with open(AQUI / arquivo, encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.reader(f))
    cab = linhas[0]
    mapa = {}
    for i, c in enumerate(cab[1:], start=1):
        m = PAT.match(c)
        if not m:
            raise ValueError(f"coluna inesperada: {c}")
        tipo = {"max": "range_max"}.get(m["tipo"], m["tipo"])  # alt_max/ast_max sem "range"
        mapa.setdefault(m["ind"], {})[tipo] = i
        if tipo == "value":
            mapa[m["ind"]]["un"] = m["un"] or ""
    saida = []
    for row in linhas[1:]:
        trip, coleta, fase, n, dia_lanc = parse_amostra(row[0])
        corrompida = (fonte, trip, coleta) in LINHAS_CORROMPIDAS
        for ind, cols in mapa.items():
            v = num(row[cols["value"]])
            lo = num(row[cols["range_min"]]) if "range_min" in cols else None
            hi = num(row[cols["range_max"]]) if "range_max" in cols else None
            flags, notas = [], []
            if corrompida:
                flags.append("corrompido")
                notas.append("linha com colunas rotacionadas no arquivo de origem")
            if v is None:
                flags.append("ausente")
            if ind == "glucose" and v is not None and v < GLICOSE_LIMIAR_ARTEFATO:
                flags.append("suspeita_pre_analitica")
                notas.append("glicose muito baixa; provável glicólise in vitro ou coleta sem jejum")
            if v is None or (lo is None and hi is None):
                status = ""
            elif lo is not None and v < lo:
                status = "abaixo"
            elif hi is not None and v > hi:
                status = "acima"
            else:
                status = "dentro"
            saida.append({
                "fonte": fonte, "painel": painel, "tripulante": trip, "sexo": SEXO[trip],
                "coleta": coleta, "fase": fase, "dia_rel_evento": n, "dia_desde_lancamento": dia_lanc,
                "indicador": ind,
                "unidade": CORRECAO_UNIDADE.get(ind, UNIDADES.get(cols["un"], cols["un"])),
                "valor": "" if v is None else v, "faixa_min": "" if lo is None else lo,
                "faixa_max": "" if hi is None else hi, "status_faixa": status,
                "flag_qualidade": ";".join(flags) or "ok", "nota": "; ".join(notas),
            })
    marcar_faixa_variavel(saida)
    return saida


def marcar_faixa_variavel(regs):
    """Marca indicadores cuja faixa de referência muda entre coletas do mesmo tripulante.

    Caso conhecido: C003 (F nos metadados) tem faixas masculinas no pré-voo e femininas no pós-voo,
    então 'status_faixa' pré-voo de C003 foi calculado contra a referência errada.
    """
    from collections import defaultdict
    faixas = defaultdict(set)
    for r in regs:
        if r["faixa_min"] != "" or r["faixa_max"] != "":
            if "corrompido" not in r["flag_qualidade"]:
                faixas[(r["tripulante"], r["indicador"])].add((r["faixa_min"], r["faixa_max"]))
    for r in regs:
        if len(faixas[(r["tripulante"], r["indicador"])]) > 1:
            fl = [] if r["flag_qualidade"] == "ok" else r["flag_qualidade"].split(";")
            r["flag_qualidade"] = ";".join(fl + ["faixa_varia_entre_coletas"])
            r["nota"] = "; ".join(x for x in [r["nota"], "faixa de referência muda entre coletas deste tripulante"] if x)


def linha_base(registros):
    """Média pré-voo por tripulante/indicador, só com valores 'ok' ou só com faixa inconsistente."""
    from collections import defaultdict
    pre, pos = defaultdict(list), defaultdict(dict)
    for r in registros:
        if r["valor"] == "":
            continue
        f = set(r["flag_qualidade"].split(";"))
        if f & {"corrompido", "suspeita_pre_analitica", "ausente"}:  # faixa variável não afeta o valor
            continue
        k = (r["painel"], r["tripulante"], r["indicador"], r["unidade"])
        if r["fase"] == "pre_voo":
            pre[k].append(r["valor"])
        else:
            pos[k][r["coleta"]] = r["valor"]
    out = []
    for k, vals in sorted(pre.items()):
        base = statistics.mean(vals)
        linha = {"painel": k[0], "tripulante": k[1], "indicador": k[2], "unidade": k[3],
                 "n_pre_voo": len(vals), "media_pre_voo": round(base, 3),
                 "min_pre_voo": min(vals), "max_pre_voo": max(vals)}
        for c in ("R+1", "R+45", "R+82", "R+194"):
            v = pos[k].get(c)
            linha[f"{c}_valor"] = "" if v is None else v
            linha[f"{c}_delta_pct"] = "" if v is None or base == 0 else round(100 * (v - base) / base, 1)
        out.append(linha)
    return out


def escrever(nome, linhas):
    with open(AQUI / nome, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0].keys()))
        w.writeheader()
        w.writerows(linhas)


if __name__ == "__main__":
    regs = ler("raw_OSD-569_CBC.csv", "OSD-569", "CBC") + ler("raw_OSD-575_CMP.csv", "OSD-575", "CMP")
    regs.sort(key=lambda r: (r["tripulante"], r["painel"], r["indicador"], r["dia_desde_lancamento"]))
    escrever("i4_exames_longo.csv", regs)
    escrever("i4_linha_base_pre_voo.csv", linha_base(regs))
    from collections import Counter
    print(len(regs), "registros")
    print(Counter(r["flag_qualidade"] for r in regs))
    print(Counter(r["status_faixa"] for r in regs if r["flag_qualidade"] == "ok"))
