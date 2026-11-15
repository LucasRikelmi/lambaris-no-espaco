import pathlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ENTRADA = pathlib.Path("dados/metricas_noites.csv")
SAIDA_CSV = pathlib.Path("dados/serie_marina.csv")
SAIDA_PNG = pathlib.Path("dados/serie_marina.png")

SEED = 42
DIAS = 30
QUEDA_MIN = 80.0
NOITES_QUEDA = 3


def calibrar_parametros(df: pd.DataFrame) -> dict:
    pivo = df.pivot(index="sujeito", columns="noite", values="duracao_total_min").dropna()
    # Remove extremos de artefato de gravacao (>150 min entre noite 1 e 2) para estimar variacao intra-sujeito
    pivo_limpo = pivo[(pivo[1] - pivo[2]).abs() < 150]

    media = float(df["duracao_total_min"].mean())
    desvio = float(((pivo_limpo[1] - pivo_limpo[2]).abs().median() / np.sqrt(2)) * 1.4826)
    autocorr = float(pivo_limpo[1].corr(pivo_limpo[2]))

    return {
        "media": round(media, 2),
        "desvio": round(desvio, 2),
        "autocorr": round(max(0.0, min(0.8, autocorr)), 2),
        "eficiencia_media": float(df["eficiencia_pct"].mean()),
        "waso_medio": float(df["tempo_acordado_apos_dormir_min"].mean()),
        "n3_medio": float(df["pct_n3"].mean()),
        "rem_medio": float(df["pct_rem"].mean()),
    }


def simular_serie_ar1(
    dias: int,
    media: float,
    desvio: float,
    autocorr: float,
    queda_min: float = 0.0,
    noites_queda: int = 3,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    if rng is None:
        rng = np.random.default_rng(SEED)

    sigma_ruido = desvio * np.sqrt(1.0 - autocorr**2)
    valores = np.zeros(dias)
    desvio_atual = rng.normal(0.0, desvio)

    for t in range(dias):
        if t > 0:
            desvio_atual = autocorr * desvio_atual + rng.normal(0.0, sigma_ruido)
        valores[t] = media + desvio_atual

    if queda_min != 0.0 and noites_queda > 0:
        media_base = float(valores[:10].mean())
        # Deriva acumulada nas vésperas (-60 min nos dias 26 e 27) seguida de queda de ~74 min nos dias 28-30
        if dias > noites_queda + 1:
            valores[dias - noites_queda - 2] = media_base - (0.76 * queda_min)
            valores[dias - noites_queda - 1] = media_base - (0.82 * queda_min)
        pesos = [0.91, 0.92, 0.93][:noites_queda]
        for idx_peso, i in enumerate(range(dias - noites_queda, dias)):
            valores[i] = media_base - (pesos[idx_peso] * queda_min)

    return np.round(valores, 1)


def main():
    df_noites = pd.read_csv(ENTRADA)
    params = calibrar_parametros(df_noites)
    rng = np.random.default_rng(SEED)

    duracoes = simular_serie_ar1(
        dias=DIAS,
        media=params["media"],
        desvio=params["desvio"],
        autocorr=params["autocorr"],
        queda_min=QUEDA_MIN,
        noites_queda=NOITES_QUEDA,
        rng=rng,
    )

    registros = []
    for idx, duracao in enumerate(duracoes, start=1):
        em_queda = idx > (DIAS - NOITES_QUEDA)
        eficiencia = np.clip(
            params["eficiencia_media"] + rng.normal(-6.0 if em_queda else 0.0, 2.5),
            65.0,
            99.0,
        )
        waso = max(2.0, params["waso_medio"] + rng.normal(18.0 if em_queda else 0.0, 6.0))
        pct_n3 = np.clip(params["n3_medio"] + rng.normal(-2.5 if em_queda else 0.0, 2.0), 2.0, 35.0)
        pct_rem = np.clip(params["rem_medio"] + rng.normal(-3.0 if em_queda else 0.0, 2.5), 5.0, 35.0)

        registros.append({
            "tripulante": "C02",
            "nome": "Marina",
            "dia_missao": idx,
            "duracao_total_min": round(float(duracao), 1),
            "eficiencia_pct": round(float(eficiencia), 1),
            "tempo_acordado_apos_dormir_min": round(float(waso), 1),
            "pct_n3": round(float(pct_n3), 1),
            "pct_rem": round(float(pct_rem), 1),
            "origem": "demo",
            "fonte": "Simulador AR(1) calibrado com Sleep-EDF",
        })

    df_marina = pd.DataFrame(registros)
    SAIDA_CSV.parent.mkdir(parents=True, exist_ok=True)
    df_marina.to_csv(SAIDA_CSV, index=False)

    # Faixa individual baseada nos 10 primeiros dias (baseline)
    base = df_marina.iloc[:10]["duracao_total_min"]
    media_base = float(base.mean())
    desvio_base = float(base.std(ddof=1))
    lim_inf = media_base - 2.0 * desvio_base
    lim_sup = media_base + 2.0 * desvio_base

    fig, ax = plt.subplots(figsize=(10, 4.5))
    dias_x = df_marina["dia_missao"]
    y = df_marina["duracao_total_min"]

    ax.fill_between(
        dias_x,
        lim_inf,
        lim_sup,
        color="#a8dadc",
        alpha=0.35,
        label=f"Faixa individual (±2 DP: {lim_inf:.0f}–{lim_sup:.0f} min)",
    )
    ax.axhline(media_base, color="#457b9d", linestyle="--", linewidth=1.2, label=f"Média baseline ({media_base:.0f} min)")
    ax.plot(dias_x, y, marker="o", color="#1d3557", linewidth=2, label="Duração do sono (min)")

    # Destaca as noites em queda
    ultimos = df_marina.iloc[-NOITES_QUEDA:]
    ax.scatter(
        ultimos["dia_missao"],
        ultimos["duracao_total_min"],
        color="#e63946",
        s=70,
        zorder=5,
        label="Queda recente (~80 min)",
    )

    ax.set_title("Série de Sono da Astronauta Marina (C02) — 30 Dias de Missão")
    ax.set_xlabel("Dia de Missão")
    ax.set_ylabel("Duração Total de Sono (min)")
    ax.set_xticks(range(1, DIAS + 1, 2))
    ax.grid(True, alpha=0.25)
    ax.legend(loc="lower left")
    fig.tight_layout()
    fig.savefig(SAIDA_PNG, dpi=150)
    plt.close(fig)

    print(f"Parâmetros calibrados: média={params['media']} min, desvio={params['desvio']} min, autocorr={params['autocorr']}")
    print(f"Baseline Marina (dias 1-10): média={media_base:.1f} min, DP={desvio_base:.1f} min, faixa=[{lim_inf:.1f}, {lim_sup:.1f}]")
    print(f"Últimas 3 noites (dias 28-30): {df_marina.iloc[-3:]['duracao_total_min'].tolist()}")
    print(f"Salvo em: {SAIDA_CSV} e {SAIDA_PNG}")


if __name__ == "__main__":
    main()
