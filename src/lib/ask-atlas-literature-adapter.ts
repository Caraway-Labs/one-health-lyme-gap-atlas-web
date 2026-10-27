import { askKnowledgeGraph } from "@/generated/atlas";
import type { ChatHistoryTurn } from "@/generated/models";
import { KnowledgeChatRequest as KnowledgeChatRequestSchema } from "@/generated/zod/knowledgeChatRequest.zod";

/**
 * Literature chat is the only Ask Atlas request this shell sends.
 * The generated contract is message plus optional history. Page reference,
 * geography, source mode, and session tokens are not request fields.
 */
const literatureChatRequestSchema = KnowledgeChatRequestSchema.strict();

const SESSION_FIELDS = ["conversation_id", "conversation_token"] as const;

export class AskAtlasLiteratureRequestError extends Error {
  constructor() {
    super(
      "That question could not be processed. Please revise it and try again."
    );
    this.name = "AskAtlasLiteratureRequestError";
  }
}

export type LiteratureChatRequest = {
  history: ChatHistoryTurn[];
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLiteratureChatRequest(
  input: unknown
): LiteratureChatRequest {
  if (!isRecord(input) || SESSION_FIELDS.some((field) => field in input)) {
    throw new AskAtlasLiteratureRequestError();
  }
  const parsed = literatureChatRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new AskAtlasLiteratureRequestError();
  }
  return {
    history: parsed.data.history ?? [],
    message: parsed.data.message,
  };
}

export function postLiteratureChat(
  input: unknown,
  options?: Parameters<typeof askKnowledgeGraph>[1]
): ReturnType<typeof askKnowledgeGraph> {
  const request = parseLiteratureChatRequest(input);
  return askKnowledgeGraph(request, options);
}
