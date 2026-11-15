# Dados de saúde: fontes, limpeza e série simulada

Gerado em 14/11/2026 para o MVP "Lambaris no Espaço".

## Arquivos

| Arquivo | O que é |
|---|---|
| `raw_OSD-569_CBC.csv`, `raw_OSD-575_CMP.csv` | Cópias sem alteração dos CSVs enviados (os uploads "_1" eram idênticos, mesmo MD5) |
| `limpar_i4.py` | Script de limpeza (stdlib, sem dependências). `python3 -I limpar_i4.py` |
| `i4_exames_longo.csv` | 1.092 registros, um por tripulante × coleta × indicador (CBC 20 indicadores + CMP 19) |
| `i4_linha_base_pre_voo.csv` | Média pré-voo (L-92, L-44, L-3) por tripulante/indicador e delta % em R+1, R+45, R+82, R+194 |
| `simular_sono.py` | Gera a série de sono **SIMULADA** e aplica a regra de alerta. `python3 -I simular_sono.py` |
| `sono_simulado_demo.csv` | 37 noites (7 em solo + 30 em voo), coluna `simulado=SIM` em todas as linhas |

## 1. Avaliação das fontes

| Fonte | Conteúdo (verificado) | Licença | Serve ao MVP de sono? | Serve à tela de exames? |
|---|---|---|---|---|
| **OSD-569** (Inspiration4) | CBC (Sysmex XN, Quest) + RNA-seq long-read. 4 tripulantes, C001/C004 M, C002/C003 F. Coletas L-92, L-44, L-3, R+1, R+45, R+82, R+194 | Não aparece no metadado obtido via API do OSDR. Dados públicos da NASA, mas **confirmar na página do estudo** | Não | Sim, é a melhor fonte real |
| **OSD-575** (Inspiration4) | CMP (Beckman AU5800, Quest) + painel inflamatório NULISA-seq 200plex (Alamar), soro | Idem | Não | Sim |
| **OSD-656** | Urina, mesmo painel NULISA-seq 200plex de inflamação, Homo sapiens, C001–C004, L-92 a R+82 (sem R+194) | Idem | Não | Não para o MVP: 203 proteínas sem faixa de referência clínica, ilegível para um astronauta |
| **NASA RadLab** | Telemetria de radiação de detectores **na ISS** (DOSTEL, Liulin-5, RAD, REM, TEPC). Interface web + API | Não encontrei termos de uso explícitos | Não | Não para o indivíduo. Serve como contexto ambiental (dose na SAA), não como indicador de saúde |
| **PhysioNet Sleep-EDF Expanded** | 197 PSG noturnos: 153 SC (1987–91, saudáveis, 25–101 anos, em casa) + 44 ST (estudo temazepam, 22 sujeitos). Hipnogramas R&K (W, 1–4, R, M) em EDF+ | ODC-By 1.0 (exige atribuição: Kemp et al. 2000 + PhysioNet) | Só como referência de realismo. Pessoas em terra | Não |
| **PhysioNet BIDMC** | 53 gravações de **8 minutos**, pacientes críticos do BIDMC. PPG, ECG, respiração a 125 Hz; FC, FR, SpO2 a 1 Hz | ODC-By 1.0 (Pimentel et al. 2016) | Não | Não. Ver crítica abaixo |

Fontes: [OSDR API](https://www.nasa.gov/?p=696974), [Sleep-EDF](https://www.physionet.org/content/sleep-edfx/1.0.0/), [BIDMC](https://physionet.org/content/bidmc/), [RadLab](https://astrobiology.com/2024/03/03/nasa-open-science-for-life-in-space-the-radlab-portal-radlab-data-api/).

**Acesso:** a rede deste ambiente bloqueia `osdr.nasa.gov` e `physionet.org` para download direto. Os metadados acima vieram das páginas e da API via leitor web. **Não baixei nenhum arquivo EDF do Sleep-EDF** nem dados do RadLab. Os metadados do OSDR vieram truncados: título, descrição e licença dos três estudos não foram lidos.

## 2. Limpeza (`i4_exames_longo.csv`)

Colunas: `fonte, painel, tripulante, sexo, coleta, fase, dia_rel_evento, dia_desde_lancamento, indicador, unidade, valor, faixa_min, faixa_max, status_faixa, flag_qualidade, nota`.

- `dia_rel_evento`: L-92 = -92 (relativo ao lançamento); R+1 = 1 (relativo ao retorno).
- `dia_desde_lancamento`: pós-voo = 3 + n. **Premissa:** missão de 3 dias (15 a 18/09/2021).
- `status_faixa`: `abaixo/dentro/acima` contra a faixa do próprio laboratório. Vazio se não há valor ou faixa.

Problemas encontrados e como foram tratados:

| Problema | Tratamento |
|---|---|
| **C003 L-92 (CBC)**: colunas rotacionadas. Ex.: "linfócitos abs" 6826 = 9,6 × 71,1% (na verdade neutrófilos); plaquetas 12,9 e MPV 330 trocados; MCH vazio | Linha inteira `corrompido`. Não reconstruí: a reconstrução seria um palpite |
| **C003 faixas de referência masculinas no pré-voo** e femininas no pós-voo (Hb, Ht, hemácias, ALT, AST, FA, creatinina, cálcio). Metadado diz F | Flag `faixa_varia_entre_coletas`. O `status_faixa` pré-voo de C003 nesses indicadores está calculado contra a referência errada. Não usar para alerta |
| **Glicose 44, 36, 43 mg/dL em R+45** (C002, C003, C004). Três de quatro no mesmo dia aponta para problema de lote/processamento, não fisiologia. C004 R+45 tem também K 5,9 (padrão compatível com separação tardia do soro, **hipótese, não confirmado**) | Glicose < 54 → `suspeita_pre_analitica`. O potássio não foi marcado |
| `NA`, `N/A` e vazio misturados | Tudo vira valor vazio + flag `ausente`. eGFR com máximo `N/A` = faixa aberta (só mínimo) |
| Cabeçalho do CBC rotula hemoglobina como `percent` | Unidade corrigida para g/dL (valores 11–17 e faixas confirmam) |
| CMP: `alt_max_...`/`ast_max_...` sem `range_` | Tratado como faixa máxima |
| BUN/creatinina ausente na maioria das coletas | Mantido como `ausente`. Não é calculado a partir de BUN e creatinina |

`i4_linha_base_pre_voo.csv` exclui valores `corrompido`, `ausente` e `suspeita_pre_analitica`. **n = 3 coletas pré-voo no máximo**: o desvio-padrão com n=3 não serve como limiar estatístico. Por isso o arquivo traz média, mínimo, máximo e delta %, e não z-score.

## 3. Série de sono simulada (`sono_simulado_demo.csv`)

**Tudo é simulado.** Os parâmetros são escolhas de design, não estimativas do Sleep-EDF, porque não consegui baixar os hipnogramas. Média de 7,2 h em solo e 6,5 h em voo, DP de 0,4 a 0,45 h, seed 42. Roteiro: troca de turno no dia de voo 20, quatro noites curtas (4,6–5,6 h) e relatos em texto nos dias 20, 22 e 25.

Regra aplicada (a mesma do pitch): linha de base das 7 noites anteriores à janela avaliada, z ≤ -1,5 por 3 noites seguidas, DP mínimo de 0,25 h. Resultado: **um único alerta, no dia de voo 22**.

Dois defeitos da regra que a simulação expôs:
1. **Falso alerta na adaptação ao voo.** Com linha de base contínua, a queda de 7,3 h (solo) para cerca de 6,5 h (voo) dispara alerta nos dias de voo 3 e 4. Correção aplicada: a linha de base reinicia na mudança de fase (`BASE_REINICIA_NA_FASE`). Custo: sem alerta nos primeiros 9 dias de voo, porque é preciso juntar 7 noites mais a janela.
2. **Contaminação depois do alerta.** As noites curtas entram na linha de base seguinte (a média cai para 5,8 h nos dias 26 a 29), e uma segunda queda seria julgada contra uma referência degradada. **Não corrigido.** Opções: excluir da linha de base as noites já sinalizadas, ou usar mediana+MAD de 14 noites.

Para calibrar com dados reais quando houver acesso ao PhysioNet: ler os `*-Hypnogram.edf` do SC com `mne.read_annotations` e extrair o tempo total de sono (estágios 1–4 + R) e a eficiência por noite. Não executei isso aqui.

## 4. Recomendação para o pitch

- **Entram:** OSD-569 e OSD-575, numa tela secundária de exames com linha de base pessoal pré-voo. Serve como prova de que o conceito "comparar com o próprio histórico" funciona com dado real de voo, com 3 ressalvas ditas em voz alta: são 4 pessoas, a missão durou 3 dias e **não há nenhuma coleta durante o voo**.
- **Entra só como citação:** Sleep-EDF, como "estrutura de hipnograma usada como referência", e só se alguém realmente calibrar a simulação com ele. Hoje não está calibrada, então não afirmem isso.
- **Ficam fora:**
  - BIDMC: são 8 minutos de pacientes críticos. Usar isso como "sinais vitais de astronauta" é tecnicamente indefensável diante de um jurado da área.
  - OSD-656: 203 proteínas inflamatórias sem faixa clínica, com n=4.
  - RadLab: radiação do ambiente da ISS, não do tripulante, e o Inspiration4 nem esteve na ISS. Cabe no máximo um slide de "visão futura".
- **Risco maior:** apresentar dado simulado como real. Toda tela de sono precisa do selo "dados simulados".
