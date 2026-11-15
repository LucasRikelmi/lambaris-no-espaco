"""Resume os datasets públicos baixados em dados-saude/publicos/. Uso: python3 -I resumir_publicos.py"""
import csv, io, statistics, zipfile
from datetime import datetime
from pathlib import Path
AQUI = Path(__file__).resolve().parent

def dexcom():
    out = []
    for f in sorted((AQUI / "big-ideas-dexcom").glob("Dexcom_*.csv")):
        rows = list(csv.DictReader(open(f, encoding="utf-8-sig")))
        egv = [(r["Timestamp (YYYY-MM-DDThh:mm:ss)"], r["Glucose Value (mg/dL)"]) for r in rows if r["Event Type"] == "EGV"]
        vals = []
        for t, v in egv:
            v = v.strip()
            if v.lower() == "low": v = 40     # sensor reporta "Low" abaixo de 40
            elif v.lower() == "high": v = 400
            vals.append(float(v))
        ts = [datetime.fromisoformat(t) for t, _ in egv]
        out.append({"participante": f.stem.split("_")[1], "n_leituras": len(vals),
                    "dias": round((max(ts) - min(ts)).total_seconds() / 86400, 1),
                    "media_mg_dl": round(statistics.mean(vals), 1), "dp_mg_dl": round(statistics.stdev(vals), 1),
                    "pct_abaixo_70": round(100 * sum(v < 70 for v in vals) / len(vals), 1),
                    "pct_acima_140": round(100 * sum(v > 140 for v in vals) / len(vals), 1)})
    return out

def pvt():
    rows = list(csv.DictReader(open(AQUI / "pvt-ds004902/participants.tsv"), delimiter="\t"))
    out = []
    for r in rows:
        out.append({"participante": r["participant_id"], "sexo": r["Gender"], "idade": r["Age"],
                    "lapsos_NS": r["PVT_item1_NS"], "lapsos_SD": r["PVT_item1_SD"],
                    "tr_mediano_ms_NS": r["PVT_item2_NS"], "tr_mediano_ms_SD": r["PVT_item2_SD"],
                    "KSS_NS": r["KSS_NS"], "KSS_SD": r["KSS_SD"],
                    "PANAS_pos_NS": r["PANAS_P_NS"], "PANAS_pos_SD": r["PANAS_P_SD"],
                    "PANAS_neg_NS": r["PANAS_N_NS"], "PANAS_neg_SD": r["PANAS_N_SD"]})
    return out

def mmash():
    z = zipfile.ZipFile(AQUI / "mmash/MMASH.zip")
    out = []
    for name in sorted(n for n in z.namelist() if n.endswith("/sleep.csv")):
        user = name.split("/")[-2]
        s = list(csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8")))
        q = list(csv.DictReader(io.TextIOWrapper(z.open(name.replace("sleep.csv", "questionnaire.csv")), encoding="utf-8")))
        q = q[0] if q else {}
        for r in s:
            out.append({"participante": user, "sono_total_min": r["Total Sleep Time (TST)"], "eficiencia_pct": r["Efficiency"],
                        "latencia_min": r["Latency"], "waso_min": r["Wake After Sleep Onset (WASO)"],
                        "despertares": r["Number of Awakenings"], "PSQI": q.get("Pittsburgh", ""),
                        "estresse_diario": q.get("Daily_stress", ""), "PANAS_pos_manha": q.get("panas_pos_9+1", ""),
                        "PANAS_neg_manha": q.get("panas_neg_9+1", "")})
    return out

def salvar(nome, linhas):
    with open(AQUI / nome, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0])); w.writeheader(); w.writerows(linhas)

if __name__ == "__main__":
    for nome, fn in [("resumo_glicose_bigideas.csv", dexcom), ("resumo_pvt_privacao_sono.csv", pvt), ("resumo_sono_humor_mmash.csv", mmash)]:
        linhas = fn(); salvar(nome, linhas); print(nome, len(linhas))
