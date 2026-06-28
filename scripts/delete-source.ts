// Remove todos os chunks de uma `source` da tabela documents (Neon).
// Uso: tsx --env-file=.env scripts/delete-source.ts <source>
import { sql } from '../src/rag/db.ts';

async function main() {
  const source = process.argv[2];
  if (!source) {
    console.error('uso: delete-source.ts <source>');
    process.exit(1);
  }
  const res = await sql`DELETE FROM documents WHERE source = ${source} RETURNING id`;
  console.log(`deletados: ${res.length} chunks de '${source}'`);
}

main();
