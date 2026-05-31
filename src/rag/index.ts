// Indexador: lê .md de sources/, divide em chunks, embeda com Jina (passage)
// e grava no Neon. Idempotente (chunk_hash) — re-rodar não duplica nem re-embeda.
//
// Uso: npx tsx --env-file=.env index.ts [pasta]   (default: ./sources)

import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { embed } from './jina.ts';
import { insertChunk } from './db.ts';

const MIN_CHUNK = 200;
const MAX_CHUNK = 2000;
const EMBED_BATCH = 50; // textos por chamada à Jina

// Quebra um bloco em "unidades" atômicas: parágrafos de prosa e code blocks
// inteiros (``` ... ```). Um code block NUNCA é dividido — fica inteiro numa unidade.
interface Unit {
  text: string;
  isCode: boolean;
}
function splitUnits(block: string): Unit[] {
  const lines = block.split('\n');
  const units: Unit[] = [];
  let i = 0;
  const isFence = (l: string) => l.trimStart().startsWith('```');

  while (i < lines.length) {
    if (isFence(lines[i])) {
      const code = [lines[i++]];
      while (i < lines.length && !isFence(lines[i])) code.push(lines[i++]);
      if (i < lines.length) code.push(lines[i++]); // fence de fechamento
      units.push({ text: code.join('\n'), isCode: true });
    } else {
      const prose = [];
      while (i < lines.length && !isFence(lines[i])) prose.push(lines[i++]);
      const t = prose.join('\n');
      if (t.trim()) units.push({ text: t, isCode: false });
    }
  }
  return units;
}

// Chunking section-aware + fence-aware: quebra nos headings; dentro de seções
// grandes, agrupa por unidades sem cortar code blocks e SEM orfanizar código —
// um code block sempre fica colado à prosa que o precede (não inicia chunk sozinho).
function chunkMarkdown(text: string): string[] {
  const blocks = text.split(/\n(?=#{1,6}\s)/);
  const chunks: string[] = [];

  for (const block of blocks) {
    if (block.trim().length === 0) continue;
    if (block.length <= MAX_CHUNK) {
      chunks.push(block.trim());
      continue;
    }
    // seção grande: agrupa unidades respeitando MAX, colando código à prosa anterior
    let buf = '';
    for (const unit of splitUnits(block)) {
      const candidate = buf ? `${buf}\n\n${unit.text}` : unit.text;
      // só fecha o buffer ANTES de prosa; antes de código, cola pra não orfanizar.
      if (buf && candidate.length > MAX_CHUNK && !unit.isCode) {
        chunks.push(buf.trim());
        buf = unit.text;
      } else {
        buf = candidate;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
  }

  // descarta fragmentos minúsculos de prosa, mas mantém qualquer chunk com código.
  return chunks.filter((c) => c.length >= MIN_CHUNK || c.includes('```'));
}

function hashChunk(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function main() {
  const dir = process.argv[2] ?? './sources';
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  if (files.length === 0) {
    console.error(`Nenhum .md em ${dir}`);
    process.exit(1);
  }
  console.log(`Indexando ${files.length} arquivo(s) de ${dir}\n`);

  let totalChunks = 0;
  let inserted = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = await readFile(join(dir, file), 'utf8');
    const chunks = chunkMarkdown(raw);
    totalChunks += chunks.length;

    // embeda em lotes
    const records: { content: string; hash: string; index: number }[] = chunks.map((content, index) => ({
      content,
      hash: hashChunk(content),
      index,
    }));

    for (let i = 0; i < records.length; i += EMBED_BATCH) {
      const batch = records.slice(i, i + EMBED_BATCH);
      const vectors = await embed(batch.map((r) => r.content), 'retrieval.passage');
      for (let j = 0; j < batch.length; j++) {
        const ok = await insertChunk({
          source: file,
          chunkIndex: batch[j].index,
          content: batch[j].content,
          chunkHash: batch[j].hash,
          embedding: vectors[j],
        });
        ok ? inserted++ : skipped++;
      }
    }
    console.log(`  ${file}: ${chunks.length} chunks`);
  }

  console.log(`\nTotal: ${totalChunks} chunks | inseridos: ${inserted} | já existentes: ${skipped}`);
}

main();
