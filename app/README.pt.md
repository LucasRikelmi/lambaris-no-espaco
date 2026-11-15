# Lambaris no Espaço — Simulador de emergência a bordo

Protótipo web para a NASA Space Apps 2026. Tudo nele é **simulado**: os sinais são gerados no navegador e a tripulante é fictícia. Não é dispositivo médico.

A interface é uma aplicação **Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Lucide Icons**, em tema escuro, servida pelo `server.py` junto das integrações locais (Ollama, Qdrant e Voice Studio).

## Como rodar

Pré-requisitos: Docker, e Node.js 18+ apenas para compilar a interface.

```bash
# 1. Compile a interface (gera web/dist)
cd web
npm install
npm run build
cd ..

# 2. Suba o simulador, o Qdrant, o Ollama e o serviço de voz
cp .env.example .env        # edite se quiser trocar modelos ou vozes
docker compose up
```

Abra http://localhost:8080.

Na primeira subida, o serviço `ollama` baixa os modelos (`gemma3:4b`, `medgemma:4b`, `nomic-embed-text`); isso pode demorar alguns minutos e fica guardado no volume `modelos`.

Sem Docker, rode `python3 server.py` a partir desta pasta (a interface precisa de `web/dist`, gerado no passo 1) e rode `ollama serve` na máquina. Nesse caso aponte os serviços para `localhost`: `LM_URL=http://127.0.0.1:11434/v1`, `QDRANT_URL=http://localhost:6333` e `TTS_URL=http://127.0.0.1:8880/v1/audio/speech`.

### Modo de desenvolvimento

```bash
cd web && npm run dev      # http://localhost:5173 com proxy de /api para o servidor local
```

## Integrações (opcionais)

Tudo funciona sem elas; o alarme e o registro do evento não dependem de nenhum serviço externo.

- **Ollama** (`LM_URL`, `GEMMA_MODEL`, `MEDGEMMA_MODEL`, `EMBED_MODEL`): o Compose sobe o serviço **`ollama`** na porta 11434 e baixa os modelos automaticamente. `LM_URL=http://ollama:11434/v1` (API compatível com a OpenAI). Os modelos em `.env` são:
  - `gemma3:4b` — **Gemma 3 4B**, conversa em português;
  - `medgemma:4b` — **MedGemma 4B**, resume o evento em modo texto;
  - `nomic-embed-text` — embeddings da busca vetorial.

  Para adicionar outro modelo, rode `docker compose exec ollama ollama pull <modelo>` e ajuste o `.env`. Fora do Docker, use `LM_URL=http://127.0.0.1:11434/v1`. Como os modelos rodam em CPU, a primeira resposta pode levar alguns segundos.
- **Qdrant**: sobe pelo Compose e indexa `procedimentos.json` (material fictício) na primeira busca. Ajuste com `QDRANT_URL`.
- **Voice Studio** (narração): o Compose já sobe um TTS compatível com a API OpenAI no serviço **`voz`** (Kokoro-FastAPI, porta 8880) e `TTS_URL=http://voz:8880/v1/audio/speech` aponta para ele. `TTS_MODEL=kokoro` e `TTS_VOICE=pf_dora` (português feminino; `pm_alex` é a masculina). Para usar um Voice Studio próprio, troque `TTS_URL` pelo endpoint que aceite `input`, `model`, `voice` e `response_format` e devolva MP3. Sem provedor, a narração usa a voz do navegador quando existir.

As credenciais ficam **no servidor** (variáveis do Docker Compose) e nunca vão para o navegador. A tela **Configurações** mostra o estado de cada serviço via `GET /api/status`, com orientação de correção.

## Telas

- **Simulação** — executar e monitorar: cenário, iniciar/pausar, reiniciar, velocidade, som e botão de pânico separado dos controles. Sinais do cenário ativo em destaque; os demais agrupados em Tripulante, Cabine e Qualidade da coleta. Quando uma regra dispara, um único cartão mostra a regra, os sinais envolvidos e **Abrir evento**; parâmetros, explicação para a banca e detalhes técnicos ficam em seções recolhíveis.
- **Eventos** — investigar e registrar: lista à esquerda e detalhe à direita no desktop; tela própria com retorno no celular. Ordenados por tempo simulado, com filtro por tipo e estado. O detalhe segue a ordem *o que aconteceu → qual regra disparou → quais sinais sustentam → quais ações foram registradas*, com **Perguntar ao assistente** e **Registrar revisão**. Reconhecimento, silenciamento e revisão entram como ações distintas na linha do tempo.
- **Assistente** — conversar e consultar procedimentos: cartão compacto do evento com acesso ao detalhe, conversa, fontes consultadas (ID, título e origem no Qdrant) e campo de mensagem. Entrada por texto e **Falar pergunta** (gravação, parada, transcrição editável e envio explícito). Com a leitura automática ligada, narra a resposta pelo Voice Studio com **Ouvir novamente**, **Pausar** e **Parar**.
- **Configurações** — ajustar e diagnosticar: **som do alarme**, **voz do alarme** e **voz do assistente** são ajustes independentes; estado do Ollama, Qdrant e serviço de voz com orientação; e a lista de **Fontes dos dados**.

## Fluxo operacional

A regra determinística (camada 1) detecta o evento e a camada 2 dispara o alarme **visual e sonoro local** na hora. A IA entra **depois**, para explicar o ocorrido e recuperar referências. Um novo alarme crítico interrompe a narração em andamento.

Com Ollama, Qdrant ou Voice Studio indisponíveis, a pessoa ainda consegue abrir o evento, consultar as evidências registradas e salvar a revisão — a interface informa a falha no ponto em que ela afeta a tarefa.

## Artefato

```bash
cd web && npm run build:artifact
```

Gera `simulador-emergencia.html` (arquivo único, com CSS e JS embutidos, em `web/dist-artifact/` e copiado para a raiz). Abre direto no navegador com a simulação completa; as chamadas de IA e de voz, porém, precisam do servidor.

## Arquivos

- `server.py` — servidor e integrações (`/api/assistente`, `/api/voz`, `/api/status`); serve `web/dist`.
- `compose.yaml` — `simulador` (Python + servidor), `ollama` (modelos locais), `qdrant` (busca vetorial) e `voz` (Voice Studio / Kokoro-FastAPI).
- `.env.example` — modelos do Ollama e configuração do Voice Studio.
- `procedimentos.json` — procedimentos fictícios indexados no Qdrant.
- `web/` — código-fonte da interface (React + shadcn/ui).
- `index.html` — protótipo legado em arquivo único (fallback quando `web/dist` não existe).

## Fontes dos dados

Os limiares das regras vêm destas referências; os códigos `MED-*`, `AMB-*` e `TEC-*` são fictícios da missão e não existem em nenhuma base real.

- **AHA/ILCOR 2020 — Guidelines for CPR and ECC**: o reconhecimento de parada cardíaca recomenda verificar o pulso por **no máximo 10 s**. O protótipo usa 8 s na regra *Parada cardíaca* (r1).
  - Destaques: https://www.heart.org/-/media/cpr-files/cpr-guidelines-files/highlights/hghlghts_2020_ecc_guidelines_english.pdf
  - Suporte básico de vida: https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-basic-life-support
- **NASA OCHMO-TB-004 — Carbon Dioxide** (e NASA-STD-3001 Vol. 2): limite de ppCO₂ com média de 1 h **≤ 3 mmHg**; sintomas começam por volta de **2,8–4,5 mmHg** (cefaleia) e acima disso (fadiga, náusea). Base dos avisos de CO₂ da regra *Falta de ar (cabine)* (r3).
  - https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/
  - https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf
- **NASA-STD-3001 Vol. 2 — Human Factors, Habitability and Environmental Health**: referência de saúde ambiental da cabine e tolerância humana (r3 e r4).
  - https://standards.nasa.gov/standard/nasa/nasa-std-3001
- **Sinais vitais normais do adulto**: SpO₂ **94–98%**, FR **12–20 rpm**, FC **60–100 bpm**. Base das faixas de exibição e da regra *Falta de ar (corpo)* (r2).
  - StatPearls: https://www.ncbi.nlm.nih.gov/books/NBK593192/
  - Medtronic Resparray (referência de sinais vitais): https://www.medtronic.com/content/dam/medtronic-wide/public/western-europe/products/patient-monitoring/pulse-oximetry/resparray-monitor-normal-vitals-infosheet.pdf
- **Limiares de projeto do protótipo**: o pico de aceleração de 4 g (r4) e o tempo de 3 s do eletrodo (r5) são escolhas de projeto, não limiares clínicos. As durações de persistência (8 s, 15 s, 5 s) também são escolhas de projeto.

As mesmas fontes aparecem no app: em **Configurações › Fontes dos dados**, em **Simulação › Parâmetros das regras** e no cartão de cada regra do motor de regras.

## Avisos

- Os limiares têm origem nas fontes acima, mas seguem **ilustrativos** para o protótipo e precisam de validação clínica antes de qualquer uso real.
- Os checklists são exemplos genéricos, não protocolos oficiais da NASA. Os códigos de manual (`MED-RCP-01` etc.) são fictícios.
- Não é dispositivo médico.
