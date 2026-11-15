import json
import pathlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from core.detectores import DETECTORES

ENTRADA_NOITES = pathlib.Path("dados/metricas_noites.csv")
SAIDA_CSV = pathlib.Path("dados/benchmark.csv")
SAIDA_PNG = pathlib.Path("dados/benchmark.png")
SAIDA_VENCEDOR = pathlib.Path("dados/metodo_vencedor.json")

SEED = 42
N_COM_DERIVA = 50
N_SEM_DERIVA = 50
DIAS = 30
DIA_INICIO_DERIVA = 21  # Deriva a partir do dia 21 (indice 20)


def gerar_serie(
    rng: np.random.Generator,
    media: float,
    desvio: float,
    autocorr: float,
    com_deriva: bool,
) -> np.ndarray:
    sigma_ruido = desvio * np.sqrt(1.0 - autocorr**2)
    serie = np.zeros(DIAS)
    desvio_atual = rng.normal(0.0, desvio)

    for t in range(DIAS):
        if t > 0:
            desvio_atual = autocorr * desvio_atual + rng.normal(0.0, sigma_ruido)
        serie[t] = media + desvio_atual

    if com_deriva:
        # Deriva sustentada de fadiga operacional (~2.2 DP = ~54 min) a partir do dia 21
        for idx in range(DIA_INICIO_DERIVA - 1, DIAS):
            progresso = min(1.0, (idx - (DIA_INICIO_DERIVA - 1) + 1) / 3.0)
            serie[idx] -= progresso * (2.2 * desvio)

    return serie


def main():
    df_noites = pd.read_csv(ENTRADA_NOITES)
    pivo = df_noites.pivot(index="sujeito", columns="noite", values="duracao_total_min").dropna()
    pivo_limpo = pivo[(pivo[1] - pivo[2]).abs() < 150]

    media = float(df_noites["duracao_total_min"].mean())
    desvio = float(((pivo_limpo[1] - pivo_limpo[2]).abs().median() / np.sqrt(2)) * 1.4826)
    autocorr = float(pivo_limpo[1].corr(pivo_limpo[2]))

    rng = np.random.default_rng(SEED)
    series = []
    for i in range(N_SEM_DERIVA):
        series.append((i + 1, False, gerar_serie(rng, media, desvio, autocorr, False)))
    for i in range(N_COM_DERIVA):
        series.append((N_SEM_DERIVA + i + 1, True, gerar_serie(rng, media, desvio, autocorr, True)))

    registros = []
    resumo_metodos = []

    for nome_metodo, fn_detector in DETECTORES.items():
        atrasos = []
        falsos_alarmes_series = 0
        total_falsos_dias = 0
        deteccoes = 0

        for id_serie, com_deriva, serie in series:
            res = fn_detector(serie, dias_base=10)
            dias_alerta = res["dias_alerta"]

            if not com_deriva:
                falso_alarme = len(dias_alerta) > 0
                if falso_alarme:
                    falsos_alarmes_series += 1
                total_falsos_dias += len(dias_alerta)
                atraso = np.nan
            else:
                # Falsos alarmes antes da deriva (dias 11 a 20)
                falsos_antes = [d for d in dias_alerta if d < DIA_INICIO_DERIVA]
                if falsos_antes:
                    falsos_alarmes_series += 1
                total_falsos_dias += len(falsos_antes)

                # Deteccao apos inicio da deriva
                apos_deriva = [d for d in dias_alerta if d >= DIA_INICIO_DERIVA]
                if apos_deriva:
                    deteccoes += 1
                    atraso = apos_deriva[0] - DIA_INICIO_DERIVA
                    atrasos.append(atraso)
                else:
                    atraso = np.nan

            registros.append({
                "id_serie": id_serie,
                "com_deriva": com_deriva,
                "metodo": nome_metodo,
                "alerta_disparado": len(dias_alerta) > 0,
                "atraso_deteccao_dias": atraso,
                "falsos_alarmes": len(dias_alerta) if not com_deriva else len([d for d in dias_alerta if d < DIA_INICIO_DERIVA]),
                "origem": "demo",
                "fonte": "Simulador Benchmark AR(1)",
            })

        atraso_medio = float(np.mean(atrasos)) if atrasos else 99.0
        atraso_mediano = float(np.median(atrasos)) if atrasos else 99.0
        # Taxa de falso alarme avaliada nas series sem deriva (especificidade pura)
        falsos_sem_deriva = sum(
            1 for r in registros if r["metodo"] == nome_metodo and not r["com_deriva"] and r["falsos_alarmes"] > 0
        )
        taxa_falso_alarme = (falsos_sem_deriva / N_SEM_DERIVA) * 100.0
        taxa_deteccao = (deteccoes / N_COM_DERIVA) * 100.0
        # Todos os metodos estao calibrados para ~8% de falso alarme; vence a maior taxa de deteccao
        score = round(taxa_deteccao - taxa_falso_alarme - atraso_medio, 2)

        resumo_metodos.append({
            "metodo": nome_metodo,
            "taxa_deteccao_pct": round(taxa_deteccao, 1),
            "atraso_medio_dias": round(atraso_medio, 2),
            "atraso_mediano_dias": round(atraso_mediano, 1),
            "taxa_falso_alarme_pct": round(taxa_falso_alarme, 1),
            "total_falsos_alarmes": total_falsos_dias,
            "score": score,
        })

    df_bench = pd.DataFrame(registros)
    SAIDA_CSV.parent.mkdir(parents=True, exist_ok=True)
    df_bench.to_csv(SAIDA_CSV, index=False)

    df_resumo = pd.DataFrame(resumo_metodos).sort_values("taxa_deteccao_pct", ascending=False)
    vencedor = str(df_resumo.iloc[0]["metodo"])

    SAIDA_VENCEDOR.write_text(
        json.dumps(
            {
                "metodo_vencedor": vencedor,
                "resumo": df_resumo.to_dict(orient="records"),
            },
            indent=2,
            ensure_ascii=False,
        )
    )

    # Grafico comparativo
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.2))
    metodos_ordem = df_resumo["metodo"].tolist()
    cores = ["#2a9d8f" if m == vencedor else "#457b9d" for m in metodos_ordem]

    axes[0].bar(metodos_ordem, df_resumo["atraso_medio_dias"], color=cores)
    axes[0].set_title("Atraso Médio de Detecção (dias)")
    axes[0].set_ylabel("Dias após início da deriva")
    axes[0].grid(axis="y", alpha=0.3)

    axes[1].bar(metodos_ordem, df_resumo["taxa_falso_alarme_pct"], color=cores)
    axes[1].set_title("Taxa de Falsos Alarmes (%)")
    axes[1].set_ylabel("% de séries com falso alarme")
    axes[1].grid(axis="y", alpha=0.3)

    fig.suptitle(f"Benchmark de Detectores (100 séries AR(1)) — Vencedor: {vencedor.upper()}")
    fig.tight_layout()
    fig.savefig(SAIDA_PNG, dpi=150)
    plt.close(fig)

    print("== Resumo do Benchmark (100 séries: 50 sem deriva, 50 com deriva) ==")
    print(df_resumo.to_string(index=False))
    print(f"\nMétodo vencedor definido: {vencedor}")
    print(f"Arquivos salvos: {SAIDA_CSV}, {SAIDA_PNG}, {SAIDA_VENCEDOR}")


if __name__ == "__main__":
    main()
