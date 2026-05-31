import { useState, useEffect, useCallback } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import { ToolPanel, type PanelEvent } from "./components/ToolPanel";
import { GitPanel } from "./components/GitPanel";

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "tool_use";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, any>;
}

// Use relative URLs - Vite will proxy to the backend
const API_BASE = "/api";
const WS_URL = `ws://${window.location.hostname}:3001/ws`;

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolEvents, setToolEvents] = useState<PanelEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rightTab, setRightTab] = useState<"tools" | "git">("tools");
  const [git, setGit] = useState({ diff: "", status: "" });

  const fetchGitDiff = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/git/diff`);
      const data = await res.json();
      setGit({ diff: data.diff || "", status: data.status || "" });
    } catch (error) {
      console.error("Failed to fetch git diff:", error);
    }
  }, []);

  // Handle WebSocket messages
  const handleWSMessage = useCallback((message: any) => {
    switch (message.type) {
      case "connected":
        console.log("Connected to server");
        break;

      case "history":
        setMessages(message.messages || []);
        break;

      case "user_message":
        // User message already added locally
        break;

      case "assistant_message":
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: message.content,
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsLoading(false);
        break;

      case "tool_use":
        // Atividade de tools vai para o painel lateral (não polui a conversa).
        setToolEvents((prev) => [
          ...prev,
          {
            id: message.toolId,
            kind: "tool",
            toolName: message.toolName,
            toolInput: message.toolInput,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case "prefetch":
        setToolEvents((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            kind: "prefetch",
            hits: message.hits,
            sources: message.sources || [],
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case "guard":
        setToolEvents((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            kind: "guard",
            tool: message.tool,
            reason: message.reason,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      case "result":
        setIsLoading(false);
        // Refresh chat list to get updated titles
        fetchChats();
        // o agente pode ter editado arquivos -> atualiza o diff
        fetchGitDiff();
        break;

      case "error":
        console.error("Server error:", message.error);
        setIsLoading(false);
        break;
    }
  }, [fetchGitDiff]);

  const { sendJsonMessage, readyState, lastJsonMessage } = useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  const isConnected = readyState === ReadyState.OPEN;

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastJsonMessage) {
      handleWSMessage(lastJsonMessage);
    }
  }, [lastJsonMessage, handleWSMessage]);

  // Fetch all chats
  const fetchChats = async () => {
    try {
      const res = await fetch(`${API_BASE}/chats`);
      const data = await res.json();
      setChats(data);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    }
  };

  // Create new chat
  const createChat = async () => {
    try {
      const res = await fetch(`${API_BASE}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const chat = await res.json();
      setChats((prev) => [chat, ...prev]);
      selectChat(chat.id);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  // Delete chat
  const deleteChat = async (chatId: string) => {
    try {
      await fetch(`${API_BASE}/chats/${chatId}`, { method: "DELETE" });
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  // Select a chat
  const selectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setMessages([]);
    setToolEvents([]);
    setIsLoading(false);

    // Subscribe to chat via WebSocket
    sendJsonMessage({ type: "subscribe", chatId });
  };

  // Send a message
  const handleSendMessage = (content: string) => {
    if (!selectedChatId || !isConnected) return;

    // Add message optimistically
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      },
    ]);

    setIsLoading(true);

    // Send via WebSocket
    sendJsonMessage({
      type: "chat",
      content,
      chatId: selectedChatId,
    });
  };

  // Initial fetch
  useEffect(() => {
    fetchChats();
  }, []);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        <ChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={selectChat}
          onNewChat={createChat}
          onDeleteChat={deleteChat}
        />
      </div>

      {/* Main chat area */}
      <ChatWindow
        chatId={selectedChatId}
        messages={messages}
        isConnected={isConnected}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
      />

      {/* Painel direito: abas Tools (ao vivo) / Git (diff das edições) */}
      {selectedChatId && (
        <div className="w-80 shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col">
          <div className="flex border-b border-gray-200 text-sm">
            <button
              onClick={() => setRightTab("tools")}
              className={`flex-1 px-3 py-2 font-medium ${
                rightTab === "tools" ? "bg-white text-gray-900 border-b-2 border-blue-500" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              🔧 Tools <span className="text-xs text-gray-400">{toolEvents.length}</span>
            </button>
            <button
              onClick={() => {
                setRightTab("git");
                fetchGitDiff();
              }}
              className={`flex-1 px-3 py-2 font-medium ${
                rightTab === "git" ? "bg-white text-gray-900 border-b-2 border-blue-500" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              🌿 Git
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {rightTab === "tools" ? (
              <ToolPanel events={toolEvents} />
            ) : (
              <GitPanel diff={git.diff} status={git.status} onRefresh={fetchGitDiff} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
