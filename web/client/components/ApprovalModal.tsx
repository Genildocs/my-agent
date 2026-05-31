// Modal de human-in-the-loop: o agente quer usar uma tool que mexe no sistema
// (Write/Edit/Bash) e o canUseTool no servidor está esperando sua decisão.

export interface ApprovalRequest {
  id: string;
  tool: string;
  input: any;
}

export function ApprovalModal({
  req,
  onApprove,
  onReject,
}: {
  req: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
}) {
  const i = req.input || {};
  const detail = req.tool === "Bash" ? i.command : i.file_path || "";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-4">
        <h3 className="font-semibold text-gray-800 mb-1">⚠️ Confirmar ação do agente</h3>
        <p className="text-sm text-gray-600 mb-2">
          O agente quer usar <b className="font-mono">{req.tool}</b>:
        </p>
        {detail && <p className="text-xs font-mono text-gray-800 mb-2 break-all bg-gray-50 px-2 py-1 rounded">{detail}</p>}
        <pre className="text-[11px] bg-gray-50 p-2 rounded border border-gray-200 max-h-48 overflow-auto mb-3">
          {JSON.stringify(req.input, null, 2)}
        </pre>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onReject}
            className="px-3 py-1.5 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            Recusar
          </button>
          <button
            onClick={onApprove}
            className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
          >
            Aprovar
          </button>
        </div>
      </div>
    </div>
  );
}
