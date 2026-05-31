# my-agent

> Um laboratório de agentes construídos com o **[Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript)** — começou como o exemplo "bug-fixing" do quickstart e virou um **mini-NotebookLM** com RAG ancorado, um **agente-revisor de código** e uma **UI web de chat** completa.

Tudo em TypeScript, rodado com `tsx`. O agente responde **ancorado na documentação oficial** do SDK (RAG sobre as docs), lê e edita o teu código, e te dá controle total: cada ação que mexe no sistema passa por aprovação.

---

## O que ele faz

- 🧠 **RAG ancorado** — indexa documentação num vetor store (Jina embeddings → Neon/pgvector) e responde **só com base nas fontes**, com pre-fetch obrigatório (a ancoragem é garantida por código, não por prompt).
- 🤖 **Agente-revisor capaz** — lê (`Read`/`Glob`/`Grep`), consulta as docs via um guardião, e **corrige código** (`Edit`/`Write`/`Bash`).
- 🛡️ **Segurança em 2 camadas** — um *guard hook* veta o destrutivo automaticamente; o `canUseTool` pede **tua confirmação** antes de cada escrita/comando.
- 💬 **3 formas de uso** — CLI de pergunta única, chat no terminal, e uma **UI web** rica.

### UI web

- Streaming de respostas com **markdown + syntax highlight** e botão de copiar
- Painéis ao vivo: **🔧 Tools**, **📋 Tarefas** (TodoWrite), **🌿 Git diff**
- Seletor de modelo (Sonnet/Opus/Haiku), botão **parar**, status de atividade
- **`@`** para referenciar arquivos do projeto e **colar imagem** (multimodal)
- Modal de **aprovação** (human-in-the-loop) antes de ações que mexem no código
- Conversas persistidas em SQLite

---

## Arquitetura

```
sources/          # docs do Agent SDK em Markdown (ver "Obter as docs")
src/
  rag/            # indexador (chunk fence-aware → Jina embed → Neon/pgvector) + retriever
  agents/
    guardian.ts        Guardian of Library — responde ancorado nas fontes (loop travado)
    guardian-of-library.ts  CLI do guardião (npm run ask)
    consultor.ts       Expõe o guardião como MCP server in-process (consultar_guardian)
    reviewer.ts        Revisa um arquivo contra as docs
    orquestrator.ts    Demo de encadeamento de agentes
    chat.ts            Chat no terminal
  core/
    guard.ts      Hook PreToolUse — veta ações destrutivas
    hooks.ts      Tracking de toda tool call (logger)
    logger.ts     Log JSONL + .log legível + EventEmitter (para a UI)
web/
  server/         Express + WebSocket; sessões, canUseTool, git diff, SQLite
  client/         React 18 + Vite + Tailwind (chat, painéis, modais)
```

### Fluxo RAG (ancoragem por código)

```
sources/*.md → chunker (section + fence-aware) → Jina embed (passage)
             → Neon (pgvector, idempotente por chunk_hash)
                            ↑
pergunta → [pre-fetch] Jina embed (query) → top-8 → injeta no prompt → Guardian → resposta citada
```

### Segurança em camadas (ordem de avaliação do SDK)

```
ação do agente
  → 1. guard hook       ⛔ veta rm -rf / .env / fora do projeto (automático)
  → 2. allowedTools     ✅ Read/Glob/Grep/guardião liberados
  → 3. canUseTool       ⚠️ Write/Edit/Bash → pede TUA aprovação no browser
```

---

## Setup

### Pré-requisitos

- Node.js ≥ 20
- Conta no [Neon](https://neon.tech) (free tier) com a extensão `vector`
- Chaves: [Anthropic](https://console.anthropic.com), [Jina](https://jina.ai)

### `.env` (na raiz)

```bash
DATABASE_URL=postgresql://...   # connection string do Neon
# ANTHROPIC_API_KEY e JINA_API_KEY podem estar no ambiente ou no .env
```

### Banco (uma vez)

No teu projeto Neon, crie a tabela do vetor store:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL, chunk_index int NOT NULL,
  content text NOT NULL, chunk_hash text NOT NULL UNIQUE,
  embedding vector(1024) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_embedding_hnsw ON documents USING hnsw (embedding vector_cosine_ops);
```

### Obter as docs

Este repo **não inclui** a documentação do Agent SDK (conteúdo da Anthropic). Coloque os arquivos `.md` das docs em `sources/` e indexe:

```bash
npm install
npm run index          # lê sources/, embeda e grava no Neon
```

---

## Uso

### Web

```bash
npm run web            # sobe server (3001) + Vite (5173)
# abra http://localhost:5173
```

### CLI

```bash
npm run ask "como configuro tools no SDK?"     # pergunta às docs
npm run review src/agents/guardian.ts          # revisa um arquivo contra as docs
npm run chat                                   # chat no terminal
npm run orquestrator                           # demo de encadeamento
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| Agentes | `@anthropic-ai/claude-agent-sdk` |
| Embeddings | Jina AI (`jina-embeddings-v5-text-small`, 1024d) |
| Vector store | Neon + pgvector |
| Conversas | SQLite (`better-sqlite3`) |
| Servidor | Express + `ws` |
| Cliente | React 18 + Vite + Tailwind + react-markdown |
| Runtime | tsx (ESM) |

---

## Notas

- Projeto **educacional / experimental** — feito pra aprender o Agent SDK na prática. Não foi pensado pra produção.
- A documentação em `sources/` pertence à **Anthropic**; não é redistribuída aqui.
- A UI web reaproveita a estrutura do demo oficial [`simple-chatapp`](https://github.com/anthropics/claude-agent-sdk-demos) da Anthropic, com a lógica de agentes substituída.
