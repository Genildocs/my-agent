// CLI do Guardian of Library. A lógica vive em guardian.ts (askGuardian),
// reutilizável também por outros agentes (ver agent.ts).
//
// Uso: npx tsx --env-file=.env guardian-of-library.ts "sua pergunta"
import { askGuardian } from './guardian.ts';

const pergunta = process.argv.slice(2).join(' ');
if (!pergunta) {
  console.error('Uso: npx tsx --env-file=.env guardian-of-library.ts "<sua pergunta>"');
  process.exit(1);
}

// streaming no console enquanto o guardião trabalha
const { cost, turns } = await askGuardian(pergunta, (line) => process.stdout.write(line));
console.log(`\n\nDone | Custo: $${cost} | Turns: ${turns}`);
