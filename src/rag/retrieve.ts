// Pipeline de retrieval: embed da query -> pgvector top-K.
// Sem reranker: o guardian (leitor LLM) lê todos os chunks retornados e seleciona
// por conta própria — reordenar antes seria redundante (ver reranker_so_vale_com_overfetch).
import { embedOne } from './jina.ts';
import { searchSimilar } from './db.ts';

export interface RetrievedChunk {
  content: string;
  source: string;
  score: number; // similaridade (1 - distância cosseno); maior = mais parecido
}

/**
 * Busca os `topK` trechos mais próximos da `query` no pgvector.
 * Entrega-os direto ao guardian, que faz a seleção final ao raciocinar.
 */
export async function retrieve(
  query: string,
  { topK = 8 }: { topK?: number } = {},
): Promise<RetrievedChunk[]> {
  const queryVec = await embedOne(query, 'retrieval.query');
  const rows = await searchSimilar(queryVec, topK);
  return rows.map((r) => ({
    content: r.content,
    source: r.source,
    score: 1 - r.distance,
  }));
}
