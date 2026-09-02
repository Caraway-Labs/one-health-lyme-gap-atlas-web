import { z } from "zod";

import type { KnowledgeChatResponse } from "@/generated/models";
import { KnowledgeGraphChatV1KnowledgeGraphChatPostResponse } from "@/generated/zod/atlas";

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

export interface ChatStore {
  version: 1;
  conversations: LocalConversation[];
}

const timestamp = z.iso.datetime({ offset: true });

const localChatTurnSchema = z.object({
  createdAt: timestamp,
  id: z.string(),
  response: KnowledgeGraphChatV1KnowledgeGraphChatPostResponse.optional(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
});

const localConversationSchema = z.object({
  createdAt: timestamp,
  expiresAt: timestamp,
  id: z.string(),
  title: z.string(),
  token: z.string(),
  turns: z.array(localChatTurnSchema),
  updatedAt: timestamp,
});

const chatStoreSchema = z.object({
  conversations: z.array(z.unknown()),
  version: z.literal(1),
});

export function loadConversations(now = Date.now()): LocalConversation[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = chatStoreSchema.safeParse(
      JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "{}")
    );
    if (!parsed.success) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return [];
    }
    const conversations = parsed.data.conversations
      .map((item) => localConversationSchema.safeParse(item))
      .filter((item) => item.success)
      .map((item) => item.data)
      .filter((item) => Date.parse(item.expiresAt) > now)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, MAX_CONVERSATIONS);
    if (conversations.length !== parsed.data.conversations.length) {
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
