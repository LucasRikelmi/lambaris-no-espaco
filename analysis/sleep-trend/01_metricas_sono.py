import pathlib
import mne
import pandas as pd

PASTA_HIPNOGRAMAS = pathlib.Path("sleep-cassette")
ARQUIVO_SUJEITOS = pathlib.Path("SC-subjects.xls")
SAIDA = pathlib.Path("dados/metricas_noites.csv")

ESTAGIOS_SONO = {
    "Sleep stage 1",
    "Sleep stage 2",
    "Sleep stage 3",
    "Sleep stage 4",
    "Sleep stage R",
}


def extrair_metricas_noite(caminho_edf: pathlib.Path) -> dict | None:
    anotacoes = mne.read_annotations(str(caminho_edf))
    df = pd.DataFrame({
        "inicio": anotacoes.onset,
        "duracao": anotacoes.duration,
        "estagio": anotacoes.description,
    })

    # Ignora trechos nao classificados
    df = df[df["estagio"] != "Sleep stage ?"].copy()
    df["eh_sono"] = df["estagio"].isin(ESTAGIOS_SONO)
    if not df["eh_sono"].any():
        return None

    # Separa cochilos diurnos do sono principal (vigilia >= 2h divide blocos)
    df["vigilia_longa"] = (~df["eh_sono"]) & (df["duracao"] >= 7200)
    df["bloco"] = df["vigilia_longa"].cumsum()
    bloco_principal = df[df["eh_sono"]].groupby("bloco")["duracao"].sum().idxmax()

    indices_sono = df[(df["bloco"] == bloco_principal) & df["eh_sono"]].index
    janela = df.loc[indices_sono.min() : indices_sono.max()]

    duracao_sono_s = janela[janela["eh_sono"]]["duracao"].sum()
    tempo_janela_s = janela["duracao"].sum()
    acordado_apos_dormir_s = janela[janela["estagio"] == "Sleep stage W"]["duracao"].sum()
    n3_s = janela[janela["estagio"].isin({"Sleep stage 3", "Sleep stage 4"})]["duracao"].sum()
    rem_s = janela[janela["estagio"] == "Sleep stage R"]["duracao"].sum()

    duracao_total_min = duracao_sono_s / 60.0
    eficiencia = (duracao_sono_s / tempo_janela_s) * 100.0 if tempo_janela_s > 0 else 0.0
    tempo_acordado_min = acordado_apos_dormir_s / 60.0
    pct_n3 = (n3_s / duracao_sono_s) * 100.0 if duracao_sono_s > 0 else 0.0
    pct_rem = (rem_s / duracao_sono_s) * 100.0 if duracao_sono_s > 0 else 0.0

    return {
        "duracao_total_min": round(duracao_total_min, 2),
        "eficiencia_pct": round(eficiencia, 2),
        "tempo_acordado_apos_dormir_min": round(tempo_acordado_min, 2),
        "pct_n3": round(pct_n3, 2),
        "pct_rem": round(pct_rem, 2),
    }


def main():
    sujeitos = pd.read_excel(ARQUIVO_SUJEITOS)
    sujeitos_filtrados = sujeitos[(sujeitos["age"] >= 25) & (sujeitos["age"] <= 60)]
    mapa_idade = {
        (int(linha["subject"]), int(linha["night"])): int(linha["age"])
        for _, linha in sujeitos_filtrados.iterrows()
    }

    registros = []
    for arquivo in sorted(PASTA_HIPNOGRAMAS.glob("*Hypnogram.edf")):
        nome = arquivo.name
        sujeito = int(nome[3:5])
        noite = int(nome[5:6])
        if (sujeito, noite) not in mapa_idade:
            continue

        metricas = extrair_metricas_noite(arquivo)
        if not metricas:
            continue

        registros.append({
            "sujeito": sujeito,
            "noite": noite,
            "idade": mapa_idade[(sujeito, noite)],
            **metricas,
            "origem": "terrestre",
            "fonte": f"Sleep-EDF/{nome}",
        })

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    df_saida = pd.DataFrame(registros)
    df_saida.to_csv(SAIDA, index=False)

    print(f"Arquivo salvo em: {SAIDA} ({len(df_saida)} noites, {df_saida['sujeito'].nunique()} sujeitos)")
    print(df_saida[["duracao_total_min", "eficiencia_pct", "tempo_acordado_apos_dormir_min", "pct_n3", "pct_rem"]].describe().round(2))


if __name__ == "__main__":
    main()
