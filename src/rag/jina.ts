// Cliente fino da API de embeddings da Jina.
// Replica o contrato usado pela skill jina-semantic-index (_jina.py) para manter
// compatibilidade: mesmo modelo, dimensão e tasks assimétricas.

export const JINA_MODEL = 'jina-embeddings-v5-text-small';
export const JINA_RERANK_MODEL = 'jina-reranker-v3';
export const JINA_DIMS = 1024; // dimensão do vetor -> coluna vector(1024) no Postgres/pgvector

// Jina usa task assimétrica: 'retrieval.passage' ao indexar documentos,
// 'retrieval.query' ao buscar. Casar os dois melhora a relevância.
export type JinaTask = 'retrieval.passage' | 'retrieval.query';

function resolveKey(): string {
  const key = process.env.JINA_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'JINA_API_KEY não encontrada no ambiente. Exporte a chave (https://jina.ai) antes de rodar.',
    );
  }
  return key;
}

/**
 * Gera embeddings para um lote de textos. Faz retry com backoff exponencial
 * em HTTP 429 (rate limit), igual ao _jina.py.
 */
export async function embed(
  texts: string[],
  task: JinaTask,
  { maxRetries = 5 }: { maxRetries?: number } = {},
): Promise<number[][]> {
  const key = resolveKey();
  const payload = {
    model: JINA_MODEL,
    input: texts,
    task,
    dimensions: JINA_DIMS,
    normalized: true,
  };

  let delay = 2000;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = (await res.json()) as { data: { embedding: number[] }[] };
      return data.data.map((row) => row.embedding);
    }

    const body = (await res.text()).slice(0, 300);
    if (res.status === 429 && attempt < maxRetries - 1) {
      console.error(`  429 - retry em ${(delay / 1000).toFixed(1)}s`);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Jina auth falhou (HTTP ${res.status}). Chave inválida ou sem cota. Body: ${body}`);
    }
    throw new Error(`Jina embeddings HTTP ${res.status}: ${body}`);
  }
  throw new Error('Jina embeddings: máximo de retries excedido');
}

/** Atalho para embeddar um único texto (usado na busca da query). */
export async function embedOne(text: string, task: JinaTask): Promise<number[]> {
  const [vec] = await embed([text], task);
  return vec;
}

export interface RerankHit {
  index: number; // posição do doc no array `documents` enviado
  relevance_score: number; // 0..1, maior = mais relevante
}

/**
 * Reordena `documents` por relevância à `query` via cross-encoder da Jina.
 * Retorna os `topN` melhores (índices relativos ao array de entrada).
 *
 * Só faz sentido com over-fetch: se documents.length <= topN, reordenar não muda
 * QUEM entra no contexto — então a função faz curto-circuito e devolve a ordem
 * original (sem gastar a chamada de rede).
 */
export async function rerank(query: string, documents: string[], topN: number): Promise<RerankHit[]> {
  if (documents.length === 0) return [];
  if (documents.length <= topN) {
    // pool <= teto: todos entram de qualquer jeito; rerankear seria desperdício.
    return documents.map((_, index) => ({ index, relevance_score: 1 }));
  }

  const key = resolveKey();
  const res = await fetch('https://api.jina.ai/v1/rerank', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: JINA_RERANK_MODEL,
      query,
      documents,
      top_n: topN,
      return_documents: false,
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Jina rerank HTTP ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { results: RerankHit[] };
  return data.results;
}
