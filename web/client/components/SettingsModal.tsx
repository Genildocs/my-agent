import { useState, useEffect } from "react";
import { X, Eye, EyeOff, ExternalLink, CheckCircle, AlertCircle, Trash2, Save } from "lucide-react";
import { getProviders, saveProviderKey, deleteProviderKey, type Provider } from "../lib/api";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

function ProviderRow({ provider, onSaved }: { provider: Provider; onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    const ok = await saveProviderKey(provider.id, key.trim());
    setSaving(false);
    if (ok) {
      setKey("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSaved();
    } else {
      setError("Falha ao salvar. Verifique o servidor.");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteProviderKey(provider.id);
    setDeleting(false);
    if (result.ok) {
      onSaved();
    } else {
      setError(result.error ?? "Falha ao remover.");
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      {/* header do provider */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {provider.connected ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          )}
          <span className="font-medium text-gray-900">{provider.name}</span>
          {provider.connected && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
              provider.source === "env"
                ? "bg-blue-100 text-blue-700"
                : "bg-green-100 text-green-700"
            }`}>
              {provider.source === "env" ? "env var" : "config"}
            </span>
          )}
        </div>
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
        >
          Obter chave <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* key atual (mascarada) */}
      {provider.connected && provider.keyPreview && (
        <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
          <span className="font-mono">{provider.keyPreview}</span>
          {provider.source === "config" && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-500 hover:text-red-700 disabled:opacity-50"
              title="Remover chave do config"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* input para nova chave */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={provider.connected ? `Substituir (${provider.keyHint})` : provider.keyHint}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!key.trim() || saving}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>

      {/* feedback */}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-600">Chave salva com sucesso.</p>}
    </div>
  );
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProviders = async () => {
    setLoading(true);
    const list = await getProviders();
    setProviders(list);
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadProviders();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Configurações de Providers</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            Configure as chaves de API dos providers de LLM. As chaves são armazenadas em{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">~/.config/my-agent/config.json</code>.
            Variáveis de ambiente têm prioridade sobre o config.
          </p>

          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Carregando…</div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhum provider disponível.</div>
          ) : (
            providers.map((p) => (
              <ProviderRow key={p.id} provider={p} onSaved={loadProviders} />
            ))
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
