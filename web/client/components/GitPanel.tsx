// Painel de Git diff: mostra o que o agente alterou no projeto (read-only).
// Você revisa o diff antes de aceitar/commitar (commit fica manual, fora daqui).

function lineClass(line: string): string {
  if (line.startsWith("diff --git") || line.startsWith("index ")) return "text-gray-400";
  if (line.startsWith("+++") || line.startsWith("---")) return "text-gray-500 font-semibold";
  if (line.startsWith("@@")) return "text-violet-600 bg-violet-50";
  if (line.startsWith("+")) return "text-green-700 bg-green-50";
  if (line.startsWith("-")) return "text-red-700 bg-red-50";
  return "text-gray-600";
}

// strip do prefixo do repo pai p/ mostrar path relativo ao my-agent
function shortPath(p: string): string {
  return p.replace(/^.*?claude-sk\/my-agent\//, "");
}

function parseStatus(status: string): { code: string; path: string }[] {
  return status
    .split("\n")
    .filter(Boolean)
    .map((l) => ({ code: l.slice(0, 2).trim() || "??", path: shortPath(l.slice(3)) }));
}

export function GitPanel({ diff, status, onRefresh }: { diff: string; status: string; onRefresh: () => void }) {
  const files = parseStatus(status);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs text-gray-500">{files.length} arquivo(s) alterado(s)</span>
        <button onClick={onRefresh} className="text-xs text-blue-600 hover:underline">
          atualizar
        </button>
      </div>

      {/* lista de arquivos */}
      {files.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100 space-y-0.5">
          {files.map((f) => (
            <div key={f.path} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[10px] text-gray-400 w-4">{f.code}</span>
              <span className="truncate text-gray-700">{f.path}</span>
            </div>
          ))}
        </div>
      )}

      {/* diff */}
      <div className="flex-1 overflow-auto">
        {diff.trim() === "" ? (
          <p className="text-xs text-gray-400 p-3">
            {files.length === 0
              ? "Nenhuma alteração ainda. Peça ao agente para editar algo."
              : "Arquivos novos (sem diff de conteúdo). Modificações em arquivos existentes aparecem aqui."}
          </p>
        ) : (
          <pre className="text-[11px] leading-4 font-mono">
            {diff.split("\n").map((line, i) => (
              <div key={i} className={`px-2 ${lineClass(line)}`}>
                {line || " "}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
