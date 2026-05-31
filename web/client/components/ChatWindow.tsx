import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface Message {
  id: string;
  role: "user" | "assistant" | "tool_use";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, any>;
}

interface ChatWindowProps {
  chatId: string | null;
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  onSendMessage: (content: string, images?: { media_type: string; data: string }[]) => void;
  onStop: () => void;
  model: string;
  onModelChange: (model: string) => void;
  agentStatus: string;
}

const MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-opus-4-8", label: "Opus 4.8" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

function ToolUseBlock({ message }: { message: Message }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getToolSummary = () => {
    const input = message.toolInput || {};
    switch (message.toolName) {
      case "Read":
        return input.file_path;
      case "Write":
      case "Edit":
        return input.file_path;
      case "Bash":
        return input.command?.slice(0, 60) + (input.command?.length > 60 ? "..." : "");
      case "Grep":
        return `"${input.pattern}" in ${input.path || "."}`;
      case "Glob":
        return input.pattern;
      case "WebSearch":
        return input.query;
      case "WebFetch":
        return input.url;
      default:
        return JSON.stringify(input).slice(0, 50);
    }
  };

  return (
    <div className="my-2 border border-gray-200 bg-gray-50 rounded">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-2 flex items-center justify-between text-left hover:bg-gray-100"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 uppercase">
            {message.toolName}
          </span>
          <span className="text-xs text-gray-500 truncate max-w-md">
            {getToolSummary()}
          </span>
        </div>
        <span className="text-xs text-gray-400">{isExpanded ? "▼" : "▶"}</span>
      </button>
      {isExpanded && (
        <div className="p-2 border-t border-gray-200">
          <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
            {JSON.stringify(message.toolInput, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Bloco de código com botão de copiar (usado no render do markdown).
function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(ref.current?.innerText ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 text-[10px] bg-gray-700 text-gray-200 rounded px-2 py-0.5 opacity-0 group-hover:opacity-100 transition"
      >
        {copied ? "✓ copiado" : "copiar"}
      </button>
      <pre ref={ref} {...props} />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-lg px-4 py-2 ${
          isUser
            ? "max-w-[80%] bg-blue-600 text-white"
            : "max-w-[90%] bg-gray-100 text-gray-900"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          // markdown renderizado: GFM (tabelas) + rehype-highlight (syntax colorido)
          <div className="prose prose-sm max-w-none prose-code:text-pink-600 prose-code:before:content-none prose-code:after:content-none prose-table:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ pre: CodeBlock }}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatWindow({
  chatId,
  messages,
  isConnected,
  isLoading,
  onSendMessage,
  onStop,
  model,
  onModelChange,
  agentStatus,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [mention, setMention] = useState<string | null>(null); // query do @ ou null
  const [images, setImages] = useState<{ media_type: string; data: string; url: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // colar imagem (Ctrl+V) -> lê como base64 e anexa
  const onPaste = (e: React.ClipboardEvent) => {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result as string; // data:image/png;base64,XXXX
          const data = url.split(",")[1] ?? "";
          const media_type = url.match(/data:(.*?);/)?.[1] || "image/png";
          setImages((prev) => [...prev, { media_type, data, url }]);
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // carrega a lista de arquivos do projeto (para o autocomplete @)
  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((d) => setFiles(d.files || []))
      .catch(() => {});
  }, []);

  // detecta um @ + texto no fim do input -> abre o picker filtrado
  const onInputChange = (value: string) => {
    setInput(value);
    const m = value.match(/@([^\s]*)$/);
    setMention(m ? m[1] : null);
  };

  const matches = mention !== null ? files.filter((f) => f.toLowerCase().includes(mention.toLowerCase())).slice(0, 8) : [];

  const pickFile = (file: string) => {
    setInput((cur) => cur.replace(/@[^\s]*$/, `@${file} `));
    setMention(null);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && images.length === 0) || !chatId || isLoading || !isConnected) return;
    onSendMessage(input.trim(), images.map(({ media_type, data }) => ({ media_type, data })));
    setInput("");
    setMention(null);
    setImages([]);
  };

  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg">Welcome to Simple Chat</p>
          <p className="text-sm mt-2">Select a chat or create a new one to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Chat</h2>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="text-xs text-green-600">● Connected</span>
          ) : (
            <span className="text-xs text-red-600">○ Disconnected</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p>Start a conversation</p>
          </div>
        ) : (
          <>
            {messages.map((msg) =>
              msg.role === "tool_use" ? (
                <ToolUseBlock key={msg.id} message={msg} />
              ) : (
                <MessageBubble key={msg.id} message={msg} />
              )
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <span className="animate-pulse">●</span>
                <span className="text-sm">{agentStatus}</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 relative">
        {/* picker de arquivos (@) */}
        {matches.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-10">
            {matches.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => pickFile(f)}
                className="w-full text-left px-3 py-1.5 text-xs font-mono text-gray-700 hover:bg-blue-50"
              >
                {f}
              </button>
            ))}
          </div>
        )}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">modelo:</span>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-gray-400">trocar reinicia o contexto do agente</span>
        </div>
        {/* preview das imagens coladas */}
        {images.length > 0 && (
          <div className="mb-2 flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.url} alt="anexo" className="h-16 w-16 object-cover rounded border border-gray-300" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white rounded-full w-4 h-4 text-[10px] leading-4"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onPaste={onPaste}
            placeholder={isConnected ? "Mensagem... (@ arquivos · cole imagem)" : "Connecting..."}
            disabled={!isConnected || isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              ⏹ Parar
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!input.trim() && images.length === 0) || !isConnected}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
