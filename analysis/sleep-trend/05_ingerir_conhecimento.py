import atexit
import pathlib
import re
from bs4 import BeautifulSoup
from fastembed import TextEmbedding
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

PASTA_TEXTOS = pathlib.Path("textos")
PASTA_MODELS = "models"
PASTA_QDRANT = "qdrant_storage"
COLECAO = "knowledge"
MODELO_EMBEDDING = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DIMENSAO = 384
PALAVRAS_POR_TRECHO = 300
MAX_TRECHOS = 30

METADADOS_FONTES = {
    "hrp_sono_evidence_report_2015.pdf": {
        "fonte": "NASA HRP Evidence Report: Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss (2015)",
        "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Sleep.pdf",
        "origem": "voo",
        "quota": 10,
    },
    "hrp_sono_evidence_report_2016.pdf": {
        "fonte": "NASA HRP Evidence Report: Circadian Desynchronization and Work Overload (2016)",
        "url": "https://humanresearchroadmap.nasa.gov/evidence/reports/Circadian.pdf",
        "origem": "voo",
        "quota": 10,
    },
    "i4_data_access.pdf": {
        "fonte": "Nature / Space Omics and Medical Atlas (SOMA) — Inspiration4 Crew Data (2024)",
        "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569",
        "origem": "voo",
        "quota": 6,
    },
    "nasa_risco_sono.html": {
        "fonte": "NASA Human Research Program — Risk of Adverse Cognitive or Behavioral Conditions and Psychiatric Disorders / Sleep Loss",
        "url": "https://www.nasa.gov/hrp/risks/sleep-loss/",
        "origem": "voo",
        "quota": 4,
    },
}

_CLIENTE_CACHE: QdrantClient | None = None
_MODELO_CACHE: TextEmbedding | None = None


def obter_cliente_qdrant() -> QdrantClient:
    global _CLIENTE_CACHE
    if _CLIENTE_CACHE is not None:
        return _CLIENTE_CACHE

    # Tenta servidor Qdrant (Docker porta 6333); se indisponivel, usa armazenamento local em ./qdrant_storage
    try:
        cliente_http = QdrantClient(url="http://localhost:6333", timeout=2, check_compatibility=False)
        cliente_http.get_collections()
        _CLIENTE_CACHE = cliente_http
    except Exception:
        _CLIENTE_CACHE = QdrantClient(path=PASTA_QDRANT)

    atexit.register(lambda: _CLIENTE_CACHE.close() if _CLIENTE_CACHE else None)
    return _CLIENTE_CACHE


def obter_modelo_embedding() -> TextEmbedding:
    global _MODELO_CACHE
    if _MODELO_CACHE is None:
        try:
            _MODELO_CACHE = TextEmbedding(
                model_name=MODELO_EMBEDDING,
                cache_dir=PASTA_MODELS,
                local_files_only=True,
            )
        except Exception:
            _MODELO_CACHE = TextEmbedding(
                model_name=MODELO_EMBEDDING,
                cache_dir=PASTA_MODELS,
            )
    return _MODELO_CACHE


def limpar_texto(texto: str) -> str:
    return re.sub(r"\s+", " ", texto).strip()


def extrair_texto_arquivo(caminho: pathlib.Path) -> str:
    if caminho.suffix.lower() == ".pdf":
        leitor = PdfReader(str(caminho))
        paginas = []
        # Pula capa/sumario inicial em relatorios grandes para pegar conteudo util
        inicio = 4 if len(leitor.pages) > 20 else 0
        for pagina in leitor.pages[inicio:]:
            txt = pagina.extract_text() or ""
            if len(txt.split()) > 40:
                paginas.append(txt)
        return limpar_texto(" ".join(paginas))

    if caminho.suffix.lower() in {".html", ".htm"}:
        html = caminho.read_text(encoding="utf-8", errors="ignore")
        sopa = BeautifulSoup(html, "html.parser")
        for tag in sopa(["script", "style", "nav", "header", "footer", "noscript"]):
            tag.decompose()
        return limpar_texto(sopa.get_text(" ", strip=True))

    return ""


def dividir_em_trechos(texto: str, tamanho_palavras: int = PALAVRAS_POR_TRECHO, limite: int = 10) -> list[str]:
    palavras = texto.split()
    trechos = []
    for i in range(0, len(palavras), tamanho_palavras):
        fatia = palavras[i : i + tamanho_palavras]
        if len(fatia) < 60:
            continue
        trechos.append(" ".join(fatia))
        if len(trechos) >= limite:
            break
    return trechos


def ingerir_conhecimento() -> int:
    cliente = obter_cliente_qdrant()
    modelo = obter_modelo_embedding()

    documentos = []
    for nome_arq, meta in METADADOS_FONTES.items():
        caminho = PASTA_TEXTOS / nome_arq
        if not caminho.exists():
            continue
        texto = extrair_texto_arquivo(caminho)
        trechos = dividir_em_trechos(texto, PALAVRAS_POR_TRECHO, meta["quota"])
        for trecho in trechos:
            documentos.append({
                "texto": trecho,
                "fonte": meta["fonte"],
                "url": meta["url"],
                "origem": meta["origem"],
                "arquivo": nome_arq,
            })
            if len(documentos) >= MAX_TRECHOS:
                break
        if len(documentos) >= MAX_TRECHOS:
            break

    textos_lista = [d["texto"] for d in documentos]
    vetores = list(modelo.embed(textos_lista))

    if cliente.collection_exists(COLECAO):
        cliente.delete_collection(COLECAO)

    cliente.create_collection(
        collection_name=COLECAO,
        vectors_config=VectorParams(size=DIMENSAO, distance=Distance.COSINE),
    )

    pontos = [
        PointStruct(
            id=idx + 1,
            vector=vetor.tolist(),
            payload={
                "texto": doc["texto"],
                "fonte": doc["fonte"],
                "url": doc["url"],
                "origem": doc["origem"],
            },
        )
        for idx, (doc, vetor) in enumerate(zip(documentos, vetores))
    ]
    cliente.upsert(collection_name=COLECAO, points=pontos)
    return len(pontos)


def buscar_conhecimento(consulta: str, top_k: int = 3) -> list[dict]:
    cliente = obter_cliente_qdrant()
    modelo = obter_modelo_embedding()
    vetor = list(modelo.embed([consulta]))[0].tolist()

    resposta = cliente.query_points(
        collection_name=COLECAO,
        query=vetor,
        limit=top_k,
    )

    resultados = []
    for ponto in resposta.points:
        payload = ponto.payload or {}
        resultados.append({
            "id": ponto.id,
            "score": round(float(ponto.score), 4),
            "texto": payload.get("texto", ""),
            "fonte": payload.get("fonte", ""),
            "url": payload.get("url", ""),
            "origem": payload.get("origem", "voo"),
        })
    return resultados


def main():
    total = ingerir_conhecimento()
    print(f"Coleção '{COLECAO}' criada no Qdrant com {total} trechos (~{PALAVRAS_POR_TRECHO} palavras cada, máx {MAX_TRECHOS}).")

    consulta = "sono insuficiente em astronautas"
    print(f"\n== Teste de busca: '{consulta}' ==")
    resultados = buscar_conhecimento(consulta, top_k=3)
    for i, r in enumerate(resultados, start=1):
        resumo_trecho = r["texto"][:180] + "..."
        print(f"[{i}] score={r['score']} | origem={r['origem']} | fonte={r['fonte']}")
        print(f"    url={r['url']}")
        print(f"    trecho={resumo_trecho}")


if __name__ == "__main__":
    main()
