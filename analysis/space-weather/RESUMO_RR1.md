# RR-1 — dosimetria de radiação (NASA OSDR)

Fonte: https://visualization.osdr.nasa.gov/eda/api/missions/RR-1/radiation_data/
Arquivo: raw/rr1_radiation_data.json (39 registros, baixado em 14/11/2026)
Metadados da missão: raw/rr1_mission.json

## O que é
Rodent Research-1 (SpaceX CRS-4): camundongos na ISS, lançamento 21/09/2014, retorno 25/10/2014 (37 dias, Expedições 41/42).
O dado é dosimetria do AMBIENTE da ISS durante a missão. Não é dose medida em humanos nem nos animais.

## Campos (1 registro por dia, 21/09/2014 a 29/10/2014, sem lacunas)
- time: data (UTC)
- gcr: dose diária de raios cósmicos galácticos
- saa: dose diária da Anomalia do Atlântico Sul
- total: gcr + saa
- milestones: Launch (21/09), Transfer to ISS (25/09), Sac 1 (12/10), Sac 2 (13/10), Sac 3 (28/10)

Unidade: mGy/dia (dose absorvida). A API não traz unidade; ela vem do rótulo dos gráficos do próprio painel da NASA (radiation_plots.js: "Dose [mGy/day]").

## Números
| | média (mGy/dia) | mín | máx | soma 39 dias (mGy) | % do total |
|---|---|---|---|---|---|
| GCR | 0,131 | 0,125 | 0,139 | 5,11 | 64,2% |
| SAA | 0,073 | 0,059 | 0,097 | 2,85 | 35,8% |
| Total | 0,204 | 0,189 (29/10) | 0,231 (22/09) | 7,96 | 100% |

Acumulado (soma das taxas diárias): 1,07 mGy na transferência para a ISS (25/09); 4,57 mGy no Sac 1 (12/10); 7,77 mGy no Sac 3 (28/10); 7,96 mGy em 29/10.

## O que dá para afirmar
- A taxa de dose na ISS ficou estável, por volta de 0,2 mGy por dia (0,19 a 0,23).
- Cerca de 2/3 vieram de raios cósmicos galácticos e 1/3 da passagem pela Anomalia do Atlântico Sul.
- Em ~39 dias, a dose absorvida acumulada no ambiente foi de ~8 mGy.

## O que NÃO dá para afirmar
- Não é dose humana nem dose equivalente (Sv); não serve para risco individual de câncer.
- Não diz nada sobre efeitos na saúde, nem sobre o local exato do detector.
- É órbita baixa, protegida pela magnetosfera; não representa Lua ou Marte.
- Os registros vão até 29/10, depois do retorno citado (25/10); o arquivo não explica a diferença.
