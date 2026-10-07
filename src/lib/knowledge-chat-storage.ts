import { z } from "zod";

import type {
  ChatHistoryTurn,
  KnowledgeChatResponse,
} from "@/generated/models";
import { acceptAskAtlasPayload } from "@/lib/ask-atlas-answer-contract";

export const CHAT_STORAGE_KEY = "one-health-lyme-gap-atlas:knowledge-chat:v1";
export const CHAT_STORAGE_EVENT = "atlas-knowledge-chat-storage";
const MAX_CONVERSATIONS = 5;
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface LocalChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: KnowledgeChatResponse;
  createdAt: string;
}

export interface LocalConversation {
  id: string;
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
  response: z.unknown().optional(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
});

const localConversationSchema = z.object({
  createdAt: timestamp,
  expiresAt: timestamp,
  id: z.string(),
  title: z.string(),
  turns: z.array(localChatTurnSchema),
  updatedAt: timestamp,
});

const chatStoreSchema = z.object({
  conversations: z.array(z.unknown()),
  version: z.literal(1),
});

type StoredTurn = z.infer<typeof localChatTurnSchema>;

function restoreAssistantTurn(turn: StoredTurn): LocalChatTurn | null {
  if (turn.role !== "assistant" || turn.response === undefined) {
    return null;
  }
  const accepted = acceptAskAtlasPayload(turn.response);
  if (!accepted.ok) {
    return null;
  }
  return {
    createdAt: turn.createdAt,
    id: turn.id,
    response: accepted.response,
    role: "assistant",
    text: accepted.response.answer,
  };
}

/** Drop a rejected answer together with its question so later pairs stay aligned. */
function restoreStoredTurns(turns: StoredTurn[]): LocalChatTurn[] {
  const restored: LocalChatTurn[] = [];
  let index = 0;
  while (index < turns.length) {
    const current = turns[index];
    const next = turns[index + 1];
    if (current?.role === "user" && next?.role === "assistant") {
      const assistant = restoreAssistantTurn(next);
      if (assistant) {
        restored.push(
          {
            createdAt: current.createdAt,
            id: current.id,
            role: "user",
            text: current.text,
          },
          assistant
        );
      }
      index += 2;
      continue;
    }
    if (current?.role === "assistant") {
      const assistant = restoreAssistantTurn(current);
      if (assistant) {
        restored.push(assistant);
      }
      index += 1;
      continue;
    }
    if (current?.role === "user" && current.text.trim()) {
      restored.push({
        createdAt: current.createdAt,
        id: current.id,
        role: "user",
        text: current.text,
      });
    }
    index += 1;
  }
  return restored;
}

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
    const conversations: LocalConversation[] = parsed.data.conversations
      .map((item) => localConversationSchema.safeParse(item))
      .filter((item) => item.success)
      .map((item) => ({
        ...item.data,
        turns: restoreStoredTurns(item.data.turns),
      }))
      .filter((item) => Date.parse(item.expiresAt) > now)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, MAX_CONVERSATIONS);
    if (
      conversations.length !== parsed.data.conversations.length ||
      JSON.stringify(conversations) !==
        JSON.stringify(parsed.data.conversations)
    ) {
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
    conversations: conversations.slice(0, MAX_CONVERSATIONS).map((item) => ({
      ...item,
      turns: item.turns.map((turn) => ({
        ...turn,
        response: turn.response
          ? { ...turn.response, conversation_token: undefined }
          : undefined,
      })),
    })),
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
    turns: [],
    updatedAt: now.toISOString(),
  };
}

function isOperationalFailure(turn: LocalChatTurn): boolean {
  const status = turn.response?.status;
  return status === "evidence_unavailable" || status === "capacity_limited";
}

/** Send complete recent pairs only; the API enforces 12 turns and 30,000 characters. */
export function conversationHistory(
  conversation?: LocalConversation
): ChatHistoryTurn[] {
  if (!conversation) return [];
  const pairs: ChatHistoryTurn[][] = [];
  for (let index = 0; index + 1 < conversation.turns.length; index += 2) {
    const user = conversation.turns[index];
    const assistant = conversation.turns[index + 1];
    if (user.role !== "user" || assistant.role !== "assistant") continue;
    if (!assistant.response || isOperationalFailure(assistant)) continue;
    const accepted = acceptAskAtlasPayload(assistant.response);
    if (!accepted.ok) continue;
    const question = user.text.trim().slice(0, 5000);
    const answer = accepted.response.answer.trim().slice(0, 5000);
    if (question && answer) {
      pairs.push([
        { role: "user", content: question },
        { role: "assistant", content: answer },
      ]);
    }
  }
  const recent = pairs.slice(-6);
  while (
    recent.length &&
    recent.flat().reduce((total, turn) => total + turn.content.length, 0) >
      30_000
  ) {
    recent.shift();
  }
  return recent.flat();
}

export function removeConversation(id: string): LocalConversation[] {
  const next = loadConversations().filter((item) => item.id !== id);
  saveConversations(next);
  return next;
}

export function clearConversations(): void {
  saveConversations([]);
}
