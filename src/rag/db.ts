// Acesso ao Postgres/Neon (pgvector). Camada fina sobre @neondatabase/serverless.
import { neon } from '@neondatabase/serverless';
import { JINA_DIMS } from './jina.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL não definida. Rode com: npx tsx --env-file=.env <script>');
}

export const sql = neon(url);

// pgvector aceita o literal '[1,2,3]' (string) para uma coluna vector.
function toVectorLiteral(vec: number[]): string {
  if (vec.length !== JINA_DIMS) {
    throw new Error(`Embedding com ${vec.length} dims, esperado ${JINA_DIMS}.`);
  }
  return `[${vec.join(',')}]`;
}

export interface ChunkRow {
  source: string;
  chunkIndex: number;
  content: string;
  chunkHash: string;
  embedding: number[];
}

/**
 * Insere um chunk. ON CONFLICT (chunk_hash) DO NOTHING -> idempotente:
 * re-indexar a mesma fonte não duplica nem re-embeda.
 * Retorna true se inseriu, false se já existia.
 */
export async function insertChunk(row: ChunkRow): Promise<boolean> {
  const res = await sql`
    INSERT INTO documents (source, chunk_index, content, chunk_hash, embedding)
    VALUES (${row.source}, ${row.chunkIndex}, ${row.content}, ${row.chunkHash}, ${toVectorLiteral(row.embedding)})
    ON CONFLICT (chunk_hash) DO NOTHING
    RETURNING id
  `;
  return res.length > 0;
}

export interface SearchResult {
  content: string;
  source: string;
  distance: number; // 0 = idêntico (cosine distance)
}

/**
 * Busca os `k` chunks mais próximos do embedding da query (over-fetch).
 * O operador <=> é cosine distance do pgvector; ORDER BY ASC = mais parecido primeiro.
 */
export async function searchSimilar(queryEmbedding: number[], k: number): Promise<SearchResult[]> {
  const vec = toVectorLiteral(queryEmbedding);
  const rows = await sql`
    SELECT content, source, embedding <=> ${vec} AS distance
    FROM documents
    ORDER BY embedding <=> ${vec}
    LIMIT ${k}
  `;
  return rows as SearchResult[];
}
