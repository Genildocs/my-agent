// Tipos compartilhados do client (web).

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  cwd?: string; // diretório de trabalho do chat
}

// Formato da tool nativa AskUserQuestion (ver sources/user-input.md).
export interface AskQuestionOption { label: string; description?: string; }
export interface AskQuestionItem {
  question: string;
  header?: string;
  options?: AskQuestionOption[];
  multiSelect?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "tool_use" | "thinking" | "subagent" | "tester" | "question" | "error";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  images?: string[]; // URLs (/uploads/...) ou data: das imagens da mensagem
  commands?: string[]; // (tester) comandos Bash executados
  done?: boolean; // (tester) terminou de rodar
  success?: boolean; // (tester) resultado final
  answered?: boolean; // (question) usuário já respondeu
}
