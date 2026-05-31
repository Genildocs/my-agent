// Persistência das conversas em SQLite local (better-sqlite3). Mesma interface
// do store em memória do demo — server.ts/session.ts não percebem a troca.
// Banco em data/chat.db (relativo ao cwd = raiz, de onde o web:server roda).
import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Chat, ChatMessage } from "./types.js";

const DB_PATH = process.env.CHAT_DB ?? "data/chat.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL"); // melhor concorrência leitura/escrita
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id        TEXT PRIMARY KEY,
    title     TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id        TEXT PRIMARY KEY,
    chatId    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role      TEXT NOT NULL,
    content   TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chatId, timestamp);
`);

class ChatStore {
  private insertChat = db.prepare(
    "INSERT INTO chats (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
  );
  private selectChat = db.prepare("SELECT * FROM chats WHERE id = ?");
  private selectAllChats = db.prepare("SELECT * FROM chats ORDER BY updatedAt DESC");
  private touchChat = db.prepare("UPDATE chats SET title = ?, updatedAt = ? WHERE id = ?");
  private removeChat = db.prepare("DELETE FROM chats WHERE id = ?");
  private insertMessage = db.prepare(
    "INSERT INTO messages (id, chatId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
  );
  private selectMessages = db.prepare("SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp ASC");

  createChat(title?: string): Chat {
    const now = new Date().toISOString();
    const chat: Chat = { id: uuidv4(), title: title || "New Chat", createdAt: now, updatedAt: now };
    this.insertChat.run(chat.id, chat.title, chat.createdAt, chat.updatedAt);
    return chat;
  }

  getChat(id: string): Chat | undefined {
    return this.selectChat.get(id) as Chat | undefined;
  }

  getAllChats(): Chat[] {
    return this.selectAllChats.all() as Chat[];
  }

  updateChatTitle(id: string, title: string): Chat | undefined {
    const chat = this.getChat(id);
    if (!chat) return undefined;
    const updatedAt = new Date().toISOString();
    this.touchChat.run(title, updatedAt, id);
    return { ...chat, title, updatedAt };
  }

  deleteChat(id: string): boolean {
    return this.removeChat.run(id).changes > 0; // CASCADE remove as mensagens
  }

  addMessage(chatId: string, message: Omit<ChatMessage, "id" | "chatId" | "timestamp">): ChatMessage {
    const chat = this.getChat(chatId);
    if (!chat) throw new Error(`Chat ${chatId} not found`);

    const newMessage: ChatMessage = {
      id: uuidv4(),
      chatId,
      timestamp: new Date().toISOString(),
      ...message,
    };
    this.insertMessage.run(newMessage.id, chatId, newMessage.role, newMessage.content, newMessage.timestamp);

    // título automático a partir da 1ª mensagem do usuário (se ainda "New Chat")
    const title =
      chat.title === "New Chat" && message.role === "user"
        ? message.content.slice(0, 50) + (message.content.length > 50 ? "..." : "")
        : chat.title;
    this.touchChat.run(title, newMessage.timestamp, chatId);

    return newMessage;
  }

  getMessages(chatId: string): ChatMessage[] {
    return this.selectMessages.all(chatId) as ChatMessage[];
  }
}

export const chatStore = new ChatStore();
