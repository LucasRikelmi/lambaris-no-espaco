# Datasets públicos extras (baixados em 15/11/2026)

Todos são de **pessoas em terra**. Nenhum é de astronauta. Servem para calibrar valores de referência e dar realismo à demo, não para dizer "dados de astronauta".

Para baixar, usei os espelhos em S3: `physionet-open.s3.amazonaws.com` e `s3.amazonaws.com/openneuro.org`. Os sites principais (physionet.org, openneuro.org, zenodo, osf) estão bloqueados neste ambiente.

## Baixados e prontos

| Dataset | Lacuna que cobre | n / duração | Licença | Arquivos aqui | Ressalvas |
|---|---|---|---|---|---|
| **BIG IDEAs Glycemic Variability** (PhysioNet v1.1.2) | **Glicemia contínua** (Dexcom G6, a cada 5 min). O dataset completo tem também **FC, temperatura da pele**, EDA e acelerometria (Empatica E4) | 16 pessoas, 7 a 10 dias | ODC-By 1.0 (exige citar) | `big-ideas-dexcom/` (só a glicose, 2,3 MB), `resumo_glicose_bigideas.csv` | HbA1c entre 5,3 e 6,4: **vários participantes são pré-diabéticos** (≥ 5,7), ou seja, não é uma população saudável típica. Cada arquivo de FC tem cerca de 13 MB e cada um de temperatura cerca de 78 MB por pessoa. Não baixei esses dois |
| **OpenNeuro ds004902** (EEG em privação de sono) | **Fadiga/PVT**, sonolência (KSS) e humor (PANAS), comparando sono normal com 24 a 30 h acordado | 71 pessoas, 2 sessões | **CC0** | `pvt-ds004902/participants.tsv` (12 KB), `resumo_pvt_privacao_sono.csv` | Só escores agregados por sessão (lapsos, TR mediano, DP do TR). Não há o PVT tentativa por tentativa. Muitos `n/a`: só 30 pares completos de PVT. **Anomalia:** a mediana de lapsos cai de 2 para 1 após a privação, o contrário da literatura. O TR mediano sobe de 320 para 359 ms, como esperado. Verificar antes de citar |
| **MMASH** (PhysioNet) | Sono por actigrafia (TST, eficiência, WASO), FC batimento a batimento, humor (PANAS em 5 horários), ansiedade, estresse diário, cortisol e melatonina | 22 homens jovens, **24 h** (1 noite cada) | ODbL 1.0 | `mmash/MMASH.zip` (24 MB), `resumo_sono_humor_mmash.csv` | Uma única noite por pessoa: **não serve para linha de base pessoal**. Serve como exemplo de como sono, FC e humor se ligam numa mesma pessoa |

Rode `python3 -I resumir_publicos.py` para regenerar os resumos.

## Encontrados, mas não baixados

| Dataset | Lacuna | Licença | Por que não baixei |
|---|---|---|---|
| **LifeSnaps** (Zenodo 6826682) | Fitbit por 4 meses + questionários de humor (PANAS, STAI) + EMA. É o mais próximo de uma "linha de base pessoal longa" | CC BY 4.0 | O zip tem 615 MB e o Zenodo está bloqueado aqui. **Recomendo que alguém da equipe baixe localmente.** O CSV `daily_fitbit_sema_df_unprocessed.csv` deve bastar. Não confirmei quais colunas ele tem |
| **PMData** (Simula) | Fitbit (sono, FC de repouso) + wellness diário (**fadiga, humor, prontidão, qualidade do sono, estresse**), exatamente o formato de autorrelato do MVP | CC BY 4.0 | A página fala em 12 pessoas por 3 meses. O artigo original pode citar outro número, então confiram. O download é pelo OSF, bloqueado aqui. Há um espelho no Hugging Face (`aai530-group6/pmdata`), que também está bloqueado e é não oficial |
| Sleep-EDF (sleep-edfx) | Hipnogramas | ODC-By | Outro thread já usou. Está disponível pelo espelho S3 |

## Não encontrei versão pública

- **Pressão arterial longitudinal** (medida diária com manguito): não achei dataset aberto. O `bp-graphene-bioimpedance` do PhysioNet é PA contínua de laboratório em poucas sessões, inútil para tendência diária. **Sugestão:** simular, com selo de simulado.
- **Temperatura corporal central:** só temperatura da pele (BIG IDEAs/Empatica), que não é a mesma coisa.
- **HERA, Mars-500, NASA Twins, Polaris, Axiom:** não encontrei dado bruto público de sono ou sinais vitais. A busca de ontem no OSDR por "Inspiration4" e "astronaut" não retornou Polaris nem Axiom. Os dados de análogos e do Twins, quando existem, ficam no LSDA (por pedido). **Não verifiquei hoje** as condições específicas do Twins nem do Mars-500.

## Prioridade para hoje à tarde

1. **BIG IDEAs (glicose):** já está aqui. Escolham 1 participante com HbA1c < 5,7 (por exemplo, o 007 ou o 014) e usem a série como "glicose do astronauta" **rotulada como dado de terra, não de voo**.
2. **ds004902 (PVT):** já está aqui. Usem as medianas de sono normal e de privação para definir as faixas de cor do teste de fadiga (TR mediano de cerca de 320 ms normal contra cerca de 360 ms após privação, KSS 5 contra 7). Nada de usar os lapsos até entender a anomalia.
3. **PMData ou LifeSnaps:** só se alguém conseguir baixar localmente nas próximas horas. Seria o melhor substituto real para a série de sono simulada, porque tem várias semanas da mesma pessoa e autorrelato de humor e fadiga.
4. **MMASH:** só se sobrar tempo. O ganho para o MVP é baixo.

Citações obrigatórias (ODC-By/CC BY): BIG IDEAs (PhysioNet, Cho et al.), ds004902 (Xiang et al., DOI 10.18112/openneuro.ds004902.v1.0.8), MMASH (Rossi et al., PhysioNet), LifeSnaps (Yfantidou et al., Scientific Data 2022), PMData (Thambawita et al., MMSys 2020). **Confiram autores e anos nas páginas antes de colocar no slide.** Os nomes vêm da minha memória, não das páginas que li.
