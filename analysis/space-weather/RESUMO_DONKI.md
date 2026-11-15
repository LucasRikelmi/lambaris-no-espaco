# DONKI (NASA) — partículas solares e tempestades, 14/11/2023 a 14/11/2026

Fonte: api.nasa.gov/DONKI (SEP e GST), baixado em 14/11/2026 em janelas de 60 dias (máximo aceito pela API).
Arquivos: raw/donki_SEP_2023-11-14_2026-11-14.json (218 registros), raw/donki_GST_2023-11-14_2026-11-14.json (65 registros).
FLR (erupções solares) indisponível: o endpoint api.nasa.gov/DONKI/FLR responde 404.
Atenção: 2023 só cobre 14/11 a 31/12, e 2026 vai de 01/01 a 14/11.

## Como ler o SEP
Cada registro da DONKI é UM instrumento ou canal de energia. O mesmo evento solar aparece várias vezes
(GOES, SOHO, STEREO-A, modelos). Por isso, os 218 registros não são 218 eventos.
A DONKI não traz a intensidade (fluxo) do SEP. Como indicador, usamos o canal de energia do GOES, em órbita da Terra:
">10 MeV" é o limiar usado pela NOAA para eventos de prótons; ">100 MeV" são os mais energéticos.

| Ano | Registros SEP | Observados (sem modelo) | Dias com SEP observado | GOES >10 MeV | GOES >100 MeV |
|---|---|---|---|---|---|
| 2023 (desde 14/11) | 4 | 2 | 1 | 1 | 0 |
| 2024 | 119 | 73 | 27 | 15 | 6 |
| 2025 | 60 | 36 | 18 | 9 | 1 |
| 2026 (até 14/11) | 35 | 20 | 10 | 4 | 2 |
| Total | 218 | 131 | 56 | 29 | 9 |

## SEP mais energéticos (GOES >100 MeV)
12/02/2024; 11/05/2024 (ligado ao flare de 11/05 01:10); 08/06/2024; 23/07/2024; 09/10/2024 (flare de 09/10 01:25);
21/11/2024; 11/11/2025 (flare de 11/11 09:49); 30/07/2026 (flare de 30/07 15:53); 05/09/2026 (flare de 05/09 15:04).
A classe dos flares (X, M) não está disponível porque o endpoint FLR saiu do ar.

## Tempestades geomagnéticas (GST, índice Kp de 0 a 9)
| Ano | Tempestades | Kp máximo | Kp ≥ 7 | Kp ≥ 8 |
|---|---|---|---|---|
| 2023 (desde 14/11) | 3 | 7,0 | 1 | 0 |
| 2024 | 20 | 9,0 | 9 | 4 |
| 2025 | 24 | 8,67 | 6 | 3 |
| 2026 (até 14/11) | 18 | 8,67 | 4 | 1 |

Mais fortes: 10/05/2024 (Kp 9,0); 10/10/2024 (8,67); 12/11/2025 (8,67); 19/01/2026 (8,67); 24/03/2024 (8,0); 12/08/2024 (8,0).

## O que dá para afirmar
- 2024 foi o ano mais ativo: 15 dos 29 eventos de prótons acima de 10 MeV e 6 dos 9 acima de 100 MeV.
- Em 3 anos, o GOES registrou 29 eventos de prótons acima de 10 MeV, cerca de 1 por mês.
- Em maio de 2024, um SEP acima de 100 MeV (11/05) coincidiu com a tempestade mais forte do período (Kp 9, 10/05).

## O que NÃO dá para afirmar
- A DONKI não traz dose de radiação nem o fluxo de partículas; não dá para dizer quanto um astronauta recebeu.
- Uma tempestade geomagnética (Kp) afeta a Terra e a órbita baixa, mas não é dose de radiação.
