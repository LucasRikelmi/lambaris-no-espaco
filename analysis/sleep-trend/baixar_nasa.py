import pathlib
import requests
from urllib.parse import quote

BASE = "https://osdr.nasa.gov"
ESTUDOS = ["OSD-569", "OSD-575"]
DESTINO = pathlib.Path("nasa")

for estudo in ESTUDOS:
    numero = estudo.split("-")[1]
    resp = requests.get(
        f"{BASE}/osdr/data/osd/files/{numero}/",
        params={"page": 1, "size": 100},
        timeout=60,
    )
    resp.raise_for_status()
    dados = resp.json().get("studies", {}).get(estudo)
    if not dados:
        print(f"{estudo}: não encontrado na resposta")
        continue

    arquivos = dados["study_files"]
    print(f"\n== {estudo}: {len(arquivos)} arquivos ==")
    pasta = DESTINO / estudo
    pasta.mkdir(parents=True, exist_ok=True)

    for arq in arquivos:
        nome = arq["file_name"]
        print(f"  {nome}")
        if nome.lower().endswith(".csv") and not arq.get("restricted"):
            url = BASE + quote(arq["remote_url"], safe="/?=&()%")
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            (pasta / nome).write_bytes(r.content)
            print(f"    -> baixado em {pasta / nome}")