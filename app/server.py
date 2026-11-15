import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "web" / "dist"

LM = os.getenv("LM_URL", "http://ollama:11434/v1")
QDRANT = os.getenv("QDRANT_URL", "http://qdrant:6333")
DOCS = json.loads((ROOT / "procedimentos.json").read_text())

KINDS = {".html": "text/html", ".js": "text/javascript", ".css": "text/css",
         ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
         ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".mp3": "audio/mpeg"}

def call(url, body, method="POST", token="", timeout=30):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(url, json.dumps(body).encode(), headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()

def embed(texts):
    result = json.loads(call(LM + "/embeddings", {"model": os.environ["EMBED_MODEL"], "input": texts}, timeout=180))
    return [item["embedding"] for item in sorted(result["data"], key=lambda item: item["index"])]

def retrieve(question):
    query, *vectors = embed([question, *[d["titulo"] + " " + d["texto"] for d in DOCS]])
    base = QDRANT + "/collections/procedimentos"
    with urllib.request.urlopen(base + "/exists", timeout=5) as response:
        exists = json.load(response)["result"]["exists"]
    if not exists:
        call(base, {"vectors": {"size": len(query), "distance": "Cosine"}}, "PUT")
    call(base + "/points?wait=true", {"points": [
        {"id": doc["id"], "vector": vector, "payload": doc} for doc, vector in zip(DOCS, vectors, strict=True)
    ]}, "PUT")
    result = json.loads(call(base + "/points/search", {
        "vector": query, "limit": 2, "score_threshold": .4, "with_payload": True
    }))
    return [item["payload"] for item in result["result"]]

def reachable(url, timeout=2.0):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            response.read(1)
        return True
    except HTTPError:
        return True
    except (URLError, OSError, ValueError):
        return False

def model_ids():
    try:
        with urllib.request.urlopen(LM + "/models", timeout=5) as response:
            return [item["id"] for item in (json.load(response).get("data") or [])]
    except (URLError, OSError, ValueError, KeyError):
        return None

def status():
    gemma = os.getenv("GEMMA_MODEL", "")
    med = os.getenv("MEDGEMMA_MODEL", "")
    ids = model_ids()
    if ids is None:
        lm = {"ok": False,
              "detail": f"Sem resposta em {LM}. Suba o serviço \"ollama\" no Docker Compose ou rode \"ollama serve\"."}
    elif not gemma or not med:
        lm = {"ok": False, "detail": "Servidor ativo, mas GEMMA_MODEL e MEDGEMMA_MODEL não estão definidos no .env."}
    else:
        missing = [model for model in (gemma, med) if model not in ids]
        if missing:
            lm = {"ok": False,
                  "detail": f"Modelo(s) ausente(s) no Ollama: {', '.join(missing)}. Rode \"ollama pull\" "
                            "(o Compose baixa automaticamente na primeira subida)."}
        else:
            lm = {"ok": True, "detail": f"Ollama pronto com {gemma} e {med}."}
    qd = ({"ok": True, "detail": f"Qdrant respondeu em {QDRANT}."} if reachable(QDRANT + "/collections")
          else {"ok": False, "detail": f"Sem resposta em {QDRANT}. Suba o serviço pelo Docker Compose."})
    tts = os.getenv("TTS_URL", "")
    if not tts:
        voz = {"ok": False, "detail": "TTS_URL não configurado. A interface usa a voz do navegador quando existir."}
    elif not os.getenv("TTS_MODEL") or not os.getenv("TTS_VOICE"):
        voz = {"ok": False, "detail": "Defina TTS_MODEL e TTS_VOICE para o Voice Studio."}
    elif reachable(tts):
        voz = {"ok": True, "detail": f"Voice Studio em {tts}."}
    else:
        voz = {"ok": False, "detail": f"Sem resposta em {tts}. Confira TTS_URL ou use a voz do navegador."}
    return {"ollama": lm, "qdrant": qd, "voz": voz, "provider": gemma or "não informado"}

def static_file(path):
    rel = path.split("?", 1)[0]
    if rel in ("/", "/index.html"):
        target, base = DIST / "index.html", DIST
        if not target.is_file():
            target, base = ROOT / "index.html", ROOT
    elif rel == "/simulador-emergencia.html":
        target, base = ROOT / "simulador-emergencia.html", ROOT
    elif rel == "/ia.js":
        target, base = ROOT / "ia.js", ROOT
    elif rel.startswith("/assets/"):
        target, base = DIST / rel.lstrip("/"), DIST
    else:
        return None
    try:
        target = target.resolve()
        target.relative_to(base.resolve())
    except (ValueError, OSError):
        return None
    return target if target.is_file() else None

def kind_for(suffix):
    base = KINDS.get(suffix, "application/octet-stream")
    return base + ("; charset=utf-8" if base.startswith(("text/", "application/json")) else "")

class Handler(BaseHTTPRequestHandler):
    def send(self, body, kind="application/json; charset=utf-8", status=200):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/status":
            return self.send(status())
        target = static_file(self.path)
        if not target:
            return self.send_error(404)
        self.send(target.read_bytes(), kind_for(target.suffix))

    def do_POST(self):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 65_536:
                return self.send({"error": "Solicitação inválida."}, status=400)
            data = json.loads(self.rfile.read(size))
            if self.path == "/api/voz":
                url = os.getenv("TTS_URL")
                if not url:
                    return self.send({"error": "Provedor de voz não configurado."}, status=503)
                audio = call(url, {"input": data["texto"][:4000], "model": os.environ["TTS_MODEL"],
                                   "voice": os.environ["TTS_VOICE"], "response_format": "mp3"},
                             token=os.getenv("TTS_TOKEN", ""))
                return self.send(audio, "audio/mpeg")
            if self.path != "/api/assistente":
                return self.send_error(404)
            medical = data.get("modo") == "medgemma"
            model = os.getenv("MEDGEMMA_MODEL" if medical else "GEMMA_MODEL")
            if not model:
                return self.send({"error": "Defina GEMMA_MODEL e MEDGEMMA_MODEL para o Ollama."}, status=503)
            question = data["pergunta"].strip()[:1600]
            if not question:
                return self.send({"error": "Informe uma pergunta."}, status=400)
            sources = []
            status = "Busca vetorial indisponível."
            try:
                sources = retrieve(question)
                status = "Nenhum trecho relevante encontrado." if not sources else ""
            except (OSError, ValueError, KeyError, IndexError):
                pass
            history = [{"role": item["role"], "content": item["content"][:4000]}
                       for item in data.get("historico", [])[-6:]
                       if isinstance(item, dict) and item.get("role") in {"user","assistant"}
                       and isinstance(item.get("content"), str)]
            context = str(data.get("evento", ""))[:4000]
            prompt = ("Responda em português sobre este exercício fictício. Use apenas o evento e os trechos "
                      "fornecidos como evidência. Cite o ID dos trechos usados. Não dê instruções clínicas, "
                      "diagnóstico ou tratamento. Indique quando faltam dados. "
                      + json.dumps({"evento":context,"trechos":sources}, ensure_ascii=False))
            response = json.loads(call(LM + "/chat/completions", {
                "model": model, "max_tokens": 480, "temperature": .2,
                "messages": [{"role":"system","content":prompt}, *history, {"role":"user","content":question}]
            }, timeout=300))
            answer = response["choices"][0]["message"]["content"]
            if not isinstance(answer, str) or not answer.strip():
                raise ValueError("Resposta vazia")
            self.send({"resposta": answer, "fontes": sources, "modelo":model, "status":status})
        except (OSError, ValueError, KeyError, TypeError, AttributeError, IndexError):
            self.send({"error":"Integração indisponível. Confira a configuração do serviço."}, status=503)

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
