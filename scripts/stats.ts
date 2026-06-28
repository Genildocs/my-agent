// Stats da tabela documents (Neon). Uso: tsx --env-file=.env scripts/stats.ts [prefixoSource]
import { sql } from '../src/rag/db.ts';

async function main() {
  const prefix = process.argv[2] ?? '';
  const like = `${prefix}%`;
  const tot = await sql`SELECT count(*)::int n FROM documents`;
  const grp = await sql`
    SELECT count(DISTINCT source)::int sources, count(*)::int chunks
    FROM documents WHERE source LIKE ${like}`;
  console.log(`total geral: ${tot[0].n} chunks`);
  console.log(`fontes '${prefix}*': ${grp[0].sources} | chunks: ${grp[0].chunks}`);
}

main();
