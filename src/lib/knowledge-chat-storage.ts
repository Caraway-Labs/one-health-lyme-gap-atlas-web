import type { KnowledgeChatResponse } from "@/generated/models";

export const CHAT_STORAGE_KEY = "one-health-lyme-gap-atlas:knowledge-chat:v1";
export const CHAT_STORAGE_EVENT = "atlas-knowledge-chat-storage";
const MAX_CONVERSATIONS = 5;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface LocalChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: KnowledgeChatResponse;
  createdAt: string;
}

export interface LocalConversation {
  id: string;
  token: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  turns: LocalChatTurn[];
}

interface ChatStore {
  version: 1;
  conversations: LocalConversation[];
}

function validConversation(
  value: unknown,
  now: number
): value is LocalConversation {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<LocalConversation>;
  return Boolean(
    item.id &&
    item.token &&
    item.title &&
    item.expiresAt &&
    Date.parse(item.expiresAt) > now &&
    Array.isArray(item.turns)
  );
}

export function loadConversations(now = Date.now()): LocalConversation[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(
      localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}"
    ) as Partial<ChatStore>;
    const conversations = (parsed.conversations ?? [])
      .filter((item) => validConversation(item, now))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, MAX_CONVERSATIONS);
    if (conversations.length !== (parsed.conversations ?? []).length) {
      saveConversations(conversations);
    }
    return conversations;
  } catch {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    return [];
  }
}

export function saveConversations(conversations: LocalConversation[]): void {
  const value: ChatStore = {
    conversations: conversations.slice(0, MAX_CONVERSATIONS),
    version: 1,
  };
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(CHAT_STORAGE_EVENT));
}

export function createConversation(
  response: KnowledgeChatResponse,
  question: string
): LocalConversation {
  const now = new Date();
  return {
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + RETENTION_MS).toISOString(),
    id: response.conversation_id,
    title: question.slice(0, 72),
    token: response.conversation_token ?? "",
    turns: [],
    updatedAt: now.toISOString(),
  };
}

export function removeConversation(id: string): LocalConversation[] {
  const next = loadConversations().filter((item) => item.id !== id);
  saveConversations(next);
  return next;
}

export function clearConversations(): void {
  saveConversations([]);
}
