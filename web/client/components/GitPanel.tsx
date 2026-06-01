// Painel de revisão de Git (read-only): lista por arquivo com status, contagem
// +/- e diff colapsável (unificado ou dividido). Inspirado no opencode web.
import { useState } from "react";
import { FilePlus2, FilePenLine, FileMinus2, ChevronRight, ChevronDown, RotateCw } from "lucide-react";

// strip do prefixo do repo pai p/ mostrar path relativo ao my-agent
function shortPath(p: string): string {
  return p.replace(/^.*?claude-sk\/my-agent\//, "").replace(/^"|"$/g, "");
}

type FileChange = {
  path: string;
  code: string; // status porcelain (M, A, D, R, ??)
  add: number | null; // null = binário
  del: number | null;
  lines: string[]; // linhas do diff (sem o cabeçalho diff --git)
};

function statusMeta(code: string): { label: string; cls: string; Icon: typeof FilePlus2 } {
  const c = code.replace("?", "A")[0]; // ?? (untracked) -> Adicionado
  if (c === "A") return { label: "Adicionado", cls: "text-green-700 bg-green-50 border-green-200", Icon: FilePlus2 };
  if (c === "D") return { label: "Removido", cls: "text-red-700 bg-red-50 border-red-200", Icon: FileMinus2 };
  return { label: "Modificado", cls: "text-amber-700 bg-amber-50 border-amber-200", Icon: FilePenLine };
}

// junta status (porcelain) + numstat (+/-) + diff (conteúdo) por arquivo
function buildFiles(diff: string, status: string, numstat: string): FileChange[] {
  const counts = new Map<string, { add: number | null; del: number | null }>();
  for (const l of numstat.split("\n").filter(Boolean)) {
    const [a, d, ...rest] = l.split("\t");
    const path = shortPath(rest.join("\t"));
    counts.set(path, { add: a === "-" ? null : +a, del: d === "-" ? null : +d });
  }

  const diffLines = new Map<string, string[]>();
  let cur: string[] | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git")) {
      const m = line.match(/ b\/(.+)$/);
      const path = m ? shortPath(m[1]) : "";
      cur = [];
      diffLines.set(path, cur);
    } else if (cur && !line.startsWith("index ") && !line.startsWith("--- ") && !line.startsWith("+++ ")) {
      cur.push(line);
    }
  }

  const order: string[] = [];
  const codes = new Map<string, string>();
  for (const l of status.split("\n").filter(Boolean)) {
    const code = l.slice(0, 2).trim() || "??";
    const path = shortPath(l.slice(3));
    codes.set(path, code);
    order.push(path);
  }
  // arquivos que aparecem no diff mas não no status (raro) entram no fim
  for (const p of diffLines.keys()) if (!codes.has(p)) order.push(p);

  return order.map((path) => ({
    path,
    code: codes.get(path) ?? "M",
    add: counts.get(path)?.add ?? 0,
    del: counts.get(path)?.del ?? 0,
    lines: diffLines.get(path) ?? [],
  }));
}

function lineClass(line: string): string {
  if (line.startsWith("@@")) return "text-violet-600 bg-violet-50";
  if (line.startsWith("+")) return "text-green-700 bg-green-50";
  if (line.startsWith("-")) return "text-red-700 bg-red-50";
  return "text-gray-600";
}

// pareia -/+ em linhas lado a lado para a visão dividida
function splitRows(lines: string[]): { left?: string; right?: string; ctx?: boolean; hunk?: boolean }[] {
  const rows: { left?: string; right?: string; ctx?: boolean; hunk?: boolean }[] = [];
  let dels: string[] = [];
  let adds: string[] = [];
  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i++) rows.push({ left: dels[i], right: adds[i] });
    dels = [];
    adds = [];
  };
  for (const l of lines) {
    if (l.startsWith("@@")) {
      flush();
      rows.push({ hunk: true, left: l });
    } else if (l.startsWith("-")) dels.push(l.slice(1));
    else if (l.startsWith("+")) adds.push(l.slice(1));
    else {
      flush();
      const t = l.startsWith(" ") ? l.slice(1) : l;
      rows.push({ left: t, right: t, ctx: true });
    }
  }
  flush();
  return rows;
}

function FileBlock({ file, view }: { file: FileChange; view: "unified" | "split" }) {
  const [open, setOpen] = useState(false);
  const { label, cls, Icon } = statusMeta(file.code);
  const hasDiff = file.lines.some((l) => l.trim() !== "");

  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => hasDiff && setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50 disabled:cursor-default"
        disabled={!hasDiff}
      >
        {hasDiff ? (
          open ? <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Icon className={`w-3.5 h-3.5 shrink-0 ${cls.split(" ")[0]}`} />
        <span className="flex-1 truncate text-xs font-mono text-gray-700">{file.path}</span>
        {(file.add ? file.add > 0 : false) && <span className="text-[10px] text-green-600 shrink-0">+{file.add}</span>}
        {(file.del ? file.del > 0 : false) && <span className="text-[10px] text-red-600 shrink-0">-{file.del}</span>}
        <span className={`text-[9px] px-1 py-0.5 rounded border shrink-0 ${cls}`}>{label}</span>
      </button>

      {open && hasDiff && (
        view === "unified" ? (
          <pre className="text-[11px] leading-4 font-mono overflow-x-auto bg-gray-50/50">
            {file.lines.map((line, i) => (
              <div key={i} className={`px-2 ${lineClass(line)}`}>{line || " "}</div>
            ))}
          </pre>
        ) : (
          <div className="text-[11px] leading-4 font-mono overflow-x-auto">
            {splitRows(file.lines).map((r, i) =>
              r.hunk ? (
                <div key={i} className="px-2 text-violet-600 bg-violet-50">{r.left}</div>
              ) : (
                <div key={i} className="grid grid-cols-2">
                  <div className={`px-2 border-r border-gray-200 ${r.ctx ? "text-gray-600" : r.left != null ? "text-red-700 bg-red-50" : "bg-gray-50"}`}>
                    {r.left != null ? (r.ctx ? " " : "-") + r.left : ""}
                  </div>
                  <div className={`px-2 ${r.ctx ? "text-gray-600" : r.right != null ? "text-green-700 bg-green-50" : "bg-gray-50"}`}>
                    {r.right != null ? (r.ctx ? " " : "+") + r.right : ""}
                  </div>
                </div>
              )
            )}
          </div>
        )
      )}
    </div>
  );
}

export function GitPanel({
  diff,
  status,
  numstat,
  onRefresh,
  lastTurnFiles,
}: {
  diff: string;
  status: string;
  numstat: string;
  onRefresh: () => void;
  lastTurnFiles: string[];
}) {
  const [view, setView] = useState<"unified" | "split">("unified");
  const [scope, setScope] = useState<"all" | "turn">("all");

  const all = buildFiles(diff, status, numstat);
  const turnSet = new Set(lastTurnFiles.map(shortPath));
  const files = scope === "turn" ? all.filter((f) => turnSet.has(f.path)) : all;
  const totals = files.reduce((acc, f) => ({ add: acc.add + (f.add ?? 0), del: acc.del + (f.del ?? 0) }), { add: 0, del: 0 });

  return (
    <div className="flex flex-col h-full">
      {/* controles */}
      <div className="px-2 py-1.5 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px]">
          <button
            onClick={() => setScope("all")}
            className={`px-1.5 py-0.5 rounded ${scope === "all" ? "bg-gray-200 text-gray-800" : "text-gray-500 hover:bg-gray-100"}`}
          >
            Tudo
          </button>
          <button
            onClick={() => setScope("turn")}
            className={`px-1.5 py-0.5 rounded ${scope === "turn" ? "bg-gray-200 text-gray-800" : "text-gray-500 hover:bg-gray-100"}`}
          >
            Último turno
          </button>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <button
            onClick={() => setView(view === "unified" ? "split" : "unified")}
            className="px-1.5 py-0.5 rounded text-gray-500 hover:bg-gray-100"
            title="alternar unificado/dividido"
          >
            {view === "unified" ? "Unificado" : "Dividido"}
          </button>
          <button onClick={onRefresh} className="p-1 rounded text-gray-500 hover:bg-gray-100" title="atualizar">
            <RotateCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* resumo */}
      <div className="px-2 py-1 border-b border-gray-100 flex items-center gap-2 text-[10px] text-gray-500">
        <span>{files.length} arquivo(s)</span>
        {totals.add > 0 && <span className="text-green-600">+{totals.add}</span>}
        {totals.del > 0 && <span className="text-red-600">-{totals.del}</span>}
      </div>

      <div className="flex-1 overflow-auto">
        {files.length === 0 ? (
          <p className="text-xs text-gray-400 p-3">
            {scope === "turn" ? "Nenhuma alteração no último turno." : "Nenhuma alteração ainda. Peça ao agente para editar algo."}
          </p>
        ) : (
          files.map((f) => <FileBlock key={f.path} file={f} view={view} />)
        )}
      </div>
    </div>
  );
}
