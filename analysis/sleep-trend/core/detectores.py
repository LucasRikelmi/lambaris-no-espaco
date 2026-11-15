import numpy as np

DESVIO_PRIORS_SLEEP_EDF = 24.37
AUTOCORR_SLEEP_EDF = 0.41


def estatisticas_baseline(serie: np.ndarray, dias_base: int = 10) -> tuple[float, float]:
    base = np.asarray(serie[:dias_base], dtype=float)
    media = float(np.mean(base))
    desvio_amostral = float(np.std(base, ddof=1))
    # Regularizacao empirica (shrinkage) com o desvio intra-sujeito do Sleep-EDF
    # Evita que 10 noites subestimem a variancia real e inflem falsos alarmes
    desvio = float(np.sqrt(0.4 * (desvio_amostral**2) + 0.6 * (DESVIO_PRIORS_SLEEP_EDF**2)))
    return media, max(12.0, desvio)


def detectar_limiar_fixo(
    serie: np.ndarray,
    dias_base: int = 10,
    z_critico: float = 3.25,
) -> dict:
    """Detector de queda pontual (unilateral inferior) calibrado para ~8% de falso alarme."""
    valores = np.asarray(serie, dtype=float)
    media, desvio = estatisticas_baseline(valores, dias_base)
    limiar_inf = media - z_critico * desvio
    limiar_sup = media + z_critico * desvio

    dias_alerta = []
    for idx in range(dias_base, len(valores)):
        if valores[idx] < limiar_inf:
            dias_alerta.append(idx + 1)

    return {
        "metodo": "limiar_fixo",
        "alerta": len(dias_alerta) > 0,
        "dias_alerta": dias_alerta,
        "primeiro_dia_alerta": dias_alerta[0] if dias_alerta else None,
        "media_baseline": round(media, 2),
        "desvio_baseline": round(desvio, 2),
        "limiar_inferior": round(limiar_inf, 2),
        "limiar_superior": round(limiar_sup, 2),
    }


def detectar_ewma(
    serie: np.ndarray,
    dias_base: int = 10,
    alfa: float = 0.25,
    L: float = 3.65,
) -> dict:
    """Detector EWMA unilateral inferior corrigido para autocorrelacao AR(1), ~8% de falso alarme."""
    valores = np.asarray(serie, dtype=float)
    media, desvio = estatisticas_baseline(valores, dias_base)
    fator_ar1 = np.sqrt(
        (1.0 + AUTOCORR_SLEEP_EDF * (1.0 - alfa))
        / (1.0 - AUTOCORR_SLEEP_EDF * (1.0 - alfa))
    )

    z = media
    dias_alerta = []
    historico_ewma = []

    for idx, x in enumerate(valores):
        if idx < dias_base:
            historico_ewma.append(round(float(z), 2))
            continue

        t = idx - dias_base + 1
        z = alfa * x + (1.0 - alfa) * z
        historico_ewma.append(round(float(z), 2))

        sigma_z = (
            desvio
            * np.sqrt((alfa / (2.0 - alfa)) * (1.0 - (1.0 - alfa) ** (2 * t)))
            * fator_ar1
        )
        if (z - media) < -L * sigma_z:
            dias_alerta.append(idx + 1)

    return {
        "metodo": "ewma",
        "alerta": len(dias_alerta) > 0,
        "dias_alerta": dias_alerta,
        "primeiro_dia_alerta": dias_alerta[0] if dias_alerta else None,
        "media_baseline": round(media, 2),
        "desvio_baseline": round(desvio, 2),
        "serie_ewma": historico_ewma,
    }


def detectar_cusum(
    serie: np.ndarray,
    dias_base: int = 10,
    k: float = 1.25,
    h: float = 4.5,
) -> dict:
    """Detector CUSUM tabular unilateral inferior calibrado para ~8% de falso alarme."""
    valores = np.asarray(serie, dtype=float)
    media, desvio = estatisticas_baseline(valores, dias_base)

    s_neg = 0.0
    dias_alerta = []
    historico_s_neg = []

    for idx, x in enumerate(valores):
        if idx < dias_base:
            historico_s_neg.append(0.0)
            continue

        z = (x - media) / desvio
        s_neg = max(0.0, s_neg - z - k)
        historico_s_neg.append(round(float(s_neg), 2))

        if s_neg > h:
            dias_alerta.append(idx + 1)

    return {
        "metodo": "cusum",
        "alerta": len(dias_alerta) > 0,
        "dias_alerta": dias_alerta,
        "primeiro_dia_alerta": dias_alerta[0] if dias_alerta else None,
        "media_baseline": round(media, 2),
        "desvio_baseline": round(desvio, 2),
        "serie_cusum_neg": historico_s_neg,
    }


DETECTORES = {
    "limiar_fixo": detectar_limiar_fixo,
    "ewma": detectar_ewma,
    "cusum": detectar_cusum,
}
