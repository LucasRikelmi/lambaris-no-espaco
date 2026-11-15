import pathlib
import re
import pandas as pd

ENTRADA = pathlib.Path("nasa/OSD-569/LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv")
SAIDA = pathlib.Path("dados/exames_ref.csv")

# Amostra com deslocamento de colunas na planilha original da NASA (mpv=330, platelet=12.9, neutrophils=10.1)
AMOSTRAS_CORROMPIDAS = {"C003_whole-blood_L-92_cbc"}

MAPA_UNIDADES = {
    "cells_per_microliter": "cells/uL",
    "thousand_per_microliter": "10^3/uL",
    "million_per_microliter": "10^6/uL",
    "grams_per_deciliter": "g/dL",
    "picogram": "pg",
    "femtoliter": "fL",
    "percent": "%",
}


def extrair_tripulante_momento(sample_name: str) -> tuple[str, str]:
    partes = sample_name.split("_")
    codigo_bruto = partes[0]
    m = re.match(r"C0*(\d+)", codigo_bruto)
    tripulante = f"C{int(m.group(1)):02d}" if m else codigo_bruto
    momento = partes[2] if len(partes) > 2 else ""
    return tripulante, momento


def classificar_fase_e_origem(momento: str) -> tuple[str, str]:
    # Coletas L- (Launch minus) e R+ (Return plus) sao feitas em solo antes/depois do voo orbital da missao Inspiration4
    if momento.startswith("L-"):
        return "pre_voo", "terrestre"
    if momento.startswith("R+"):
        return "pos_voo", "terrestre"
    return "em_voo", "voo"


def classificar_status(valor: float, minimo: float, maximo: float) -> str:
    if pd.isna(valor) or pd.isna(minimo) or pd.isna(maximo):
        return "indefinido"
    if valor < minimo:
        return "abaixo"
    if valor > maximo:
        return "acima"
    return "normal"


def main():
    df = pd.read_csv(ENTRADA)

    colunas_valor = [c for c in df.columns if "_value_" in c]
    registros = []
    ignoradas = 0

    for _, linha in df.iterrows():
        sample_name = str(linha["Sample Name"]).strip()
        if sample_name in AMOSTRAS_CORROMPIDAS:
            ignoradas += 1
            continue

        tripulante, momento = extrair_tripulante_momento(sample_name)
        fase_missao, origem = classificar_fase_e_origem(momento)

        for col_val in colunas_valor:
            exame, sufixo_unidade = col_val.split("_value_", 1)
            col_min = f"{exame}_range_min_{sufixo_unidade}"
            col_max = f"{exame}_range_max_{sufixo_unidade}"

            valor = linha.get(col_val)
            minimo = linha.get(col_min)
            maximo = linha.get(col_max)
            if pd.isna(valor):
                continue

            # Hemoglobina esta rotulada como percent no CSV, mas a unidade real e g/dL
            if exame == "hemoglobin":
                unidade = "g/dL"
            else:
                unidade = MAPA_UNIDADES.get(sufixo_unidade, sufixo_unidade)

            status = classificar_status(float(valor), float(minimo), float(maximo))

            registros.append({
                "tripulante": tripulante,
                "momento": momento,
                "fase_missao": fase_missao,
                "exame": exame,
                "unidade": unidade,
                "valor": float(valor),
                "min": float(minimo),
                "max": float(maximo),
                "status": status,
                "origem": origem,
                "fonte": f"NASA OSDR OSD-569 (Inspiration4 CBC - {fase_missao})",
            })

    df_saida = pd.DataFrame(registros)
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    df_saida.to_csv(SAIDA, index=False)

    print(f"Arquivo salvo em: {SAIDA} ({len(df_saida)} registros, {ignoradas} amostra corrompida removida)")
    print("Contagem por status:")
    print(df_saida["status"].value_counts().to_string())
    print("\nExames fora da faixa de referência (pós-limpeza):")
    print(df_saida[df_saida["status"] != "normal"][["tripulante", "momento", "fase_missao", "exame", "valor", "min", "max", "status"]].to_string(index=False))


if __name__ == "__main__":
    main()
