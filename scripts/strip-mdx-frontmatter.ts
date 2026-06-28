// Remove o frontmatter YAML do topo de arquivos .md/.mdx baixados (ex: docs do
// OpenTUI/Starlight). O título já vive no corpo como "# Title", então o
// frontmatter (title/description/order/navTitle/skill) é puro metadado de
// navegação — ruído pros chunks do RAG. NÃO toca em mais nada: imports e JSX
// que aparecem nos docs estão DENTRO de code blocks (exemplos da lib), são
// conteúdo legítimo e ficam intactos.
//
// Uso: npx tsx scripts/strip-mdx-frontmatter.ts [pasta]   (default: ./sources-opentui)

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

async function main() {
  const dir = process.argv[2] ?? './sources-opentui';
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
  let stripped = 0;

  for (const file of files) {
    const path = join(dir, file);
    const raw = await readFile(path, 'utf8');
    if (!FRONTMATTER.test(raw)) continue;
    const out = raw.replace(FRONTMATTER, '').replace(/^\s+/, '');
    await writeFile(path, out, 'utf8');
    stripped++;
  }

  console.log(`Frontmatter removido de ${stripped}/${files.length} arquivo(s) em ${dir}`);
}

main();
