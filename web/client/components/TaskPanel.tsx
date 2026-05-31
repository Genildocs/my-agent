// Painel de tarefas: renderiza o plano do agente (tool TodoWrite) ao vivo.
// O agente, em tarefas multi-step, emite a lista completa a cada update.

export interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

function mark(status: Todo["status"]): { icon: string; cls: string } {
  switch (status) {
    case "completed":
      return { icon: "☑", cls: "text-green-600 line-through opacity-70" };
    case "in_progress":
      return { icon: "◐", cls: "text-blue-600 font-medium" };
    default:
      return { icon: "☐", cls: "text-gray-500" };
  }
}

export function TaskPanel({ todos }: { todos: Todo[] }) {
  const done = todos.filter((t) => t.status === "completed").length;

  if (todos.length === 0) {
    return (
      <p className="text-xs text-gray-400 p-3">
        Quando o agente planejar uma tarefa multi-step, o checklist dele aparece aqui.
      </p>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500">
        {done} de {todos.length} tarefas concluídas
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {todos.map((t, i) => {
          const m = mark(t.status);
          return (
            <li key={i} className="flex items-start gap-2 text-xs px-1 py-1">
              <span className={`${m.cls} leading-4`}>{m.icon}</span>
              <span className={m.cls}>{t.status === "in_progress" && t.activeForm ? t.activeForm : t.content}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
