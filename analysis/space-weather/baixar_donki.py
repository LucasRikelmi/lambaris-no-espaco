"""Baixa um snapshot da NASA DONKI (clima espacial) para uso offline no pitch.

Uso (na máquina de alguém da equipe, com internet):
    python3 baixar_donki.py                  # usa DEMO_KEY
    NASA_API_KEY=sua_chave python3 baixar_donki.py

Gera, nesta pasta:
    donki_SEP.json  eventos de partículas solares (ligados ao perigo radiação)
    donki_FLR.json  flares solares
    donki_GST.json  tempestades geomagnéticas
    donki_snapshot_meta.json  período, data do download e contagem por tipo

A DEMO_KEY tem limite baixo de chamadas por hora; uma execução faz só 3.
Não dependa da API ao vivo na apresentação: use estes arquivos.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

INICIO = "2024-01-01"
FIM = datetime.now(timezone.utc).strftime("%Y-%m-%d")
CHAVE = os.environ.get("NASA_API_KEY", "DEMO_KEY")
PASTA = os.path.dirname(os.path.abspath(__file__))

meta = {"inicio": INICIO, "fim": FIM, "baixado_em": datetime.now(timezone.utc).isoformat(), "contagem": {}}
for tipo in ("SEP", "FLR", "GST"):
    url = f"https://api.nasa.gov/DONKI/{tipo}?startDate={INICIO}&endDate={FIM}&api_key={CHAVE}"
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            dados = json.load(r)
    except Exception as e:  # sem rede, limite da chave etc.
        print(f"{tipo}: falhou ({e})", file=sys.stderr)
        continue
    with open(os.path.join(PASTA, f"donki_{tipo}.json"), "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=1)
    meta["contagem"][tipo] = len(dados)
    print(f"{tipo}: {len(dados)} eventos")

with open(os.path.join(PASTA, "donki_snapshot_meta.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=1)
