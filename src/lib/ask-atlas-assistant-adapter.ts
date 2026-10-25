import { askAtlasMixed, askAtlasStructured } from "@/generated/atlas";
import type {
  ChatHistoryTurn,
  KnowledgeChatResponse,
  StructuredContext,
} from "@/generated/models";
import { MixedAssistantRequest as MixedAssistantRequestSchema } from "@/generated/zod/mixedAssistantRequest.zod";
import { StructuredAssistantRequest as StructuredAssistantRequestSchema } from "@/generated/zod/structuredAssistantRequest.zod";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  acceptAskAtlasPayload,
  AskAtlasAnswerContractError,
} from "@/lib/ask-atlas-answer-contract";
import {
  parseMixedAssistantResponse,
  parseStructuredAssistantResponse,
  type AskAtlasGovernedTurn,
} from "@/lib/ask-atlas-assistant-payload";
import { postLiteratureChat } from "@/lib/ask-atlas-literature-adapter";
import {
  isEnabledAskAtlasSourceMode,
  type AskAtlasSourceMode,
} from "@/lib/ask-atlas-source-mode";

const structuredRequestSchema = StructuredAssistantRequestSchema.strict();
const mixedRequestSchema = MixedAssistantRequestSchema.strict();

export class AskAtlasAssistantRequestError extends Error {
  constructor() {
    super(
      "That question could not be processed. Please revise it and try again."
    );
    this.name = "AskAtlasAssistantRequestError";
  }
}

export type AskAtlasAssistantResult =
  | { kind: "literature"; response: KnowledgeChatResponse }
  | AskAtlasGovernedTurn;

export async function postAskAtlas(input: {
  context?: StructuredContext;
  history: ChatHistoryTurn[];
  mode: AskAtlasSourceMode;
  question: string;
  signal?: AbortSignal;
}): Promise<AskAtlasAssistantResult> {
  if (!isEnabledAskAtlasSourceMode(input.mode)) {
    throw new AskAtlasAssistantRequestError();
  }
  switch (input.mode) {
    case "Literature": {
      return postLiterature(input.history, input.question, input.signal);
    }
    case "Structured": {
      return postStructured(input.question, input.context, input.signal);
    }
    case "Both": {
      return postMixed(input.question, input.context, input.signal);
    }
    default: {
      const unhandled: never = input.mode;
      return unhandled;
    }
  }
}

async function postLiterature(
  history: ChatHistoryTurn[],
  question: string,
  signal: AbortSignal | undefined
): Promise<AskAtlasAssistantResult> {
  try {
    const result = await postLiteratureChat(
      { history, message: question },
      { signal }
    );
    const accepted = acceptAskAtlasPayload(result.data);
    if (!accepted.ok) {
      throw new AskAtlasAnswerContractError(
        accepted.reason === "not_chat_response" ? "malformed" : accepted.reason
      );
    }
    return { kind: "literature", response: accepted.response };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof AtlasApiError) {
      const accepted = acceptAskAtlasPayload(error.responseBody);
      if (accepted.ok) {
        return { kind: "literature", response: accepted.response };
      }
      if (accepted.reason !== "not_chat_response") {
        throw new AskAtlasAnswerContractError(accepted.reason);
      }
    }
    throw error;
  }
}

async function postStructured(
  question: string,
  context: StructuredContext | undefined,
  signal: AbortSignal | undefined
): Promise<AskAtlasGovernedTurn> {
  const request = structuredRequestSchema.safeParse({
    question,
    source_mode: "Structured",
    ...(context ? { context } : {}),
  });
  if (!request.success) {
    throw new AskAtlasAssistantRequestError();
  }
  try {
    const result = await askAtlasStructured(request.data, { signal });
    const response = parseStructuredAssistantResponse(result.data);
    if (!response) {
      throw new AskAtlasAnswerContractError("malformed");
    }
    return {
      kind: "structured",
      requestId: result.headers.get("X-Request-ID"),
      response,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof AskAtlasAnswerContractError) {
      throw error;
    }
    if (error instanceof AtlasApiError) {
      const response = parseStructuredAssistantResponse(error.responseBody);
      if (response) {
        return { kind: "structured", requestId: error.requestId, response };
      }
    }
    throw error;
  }
}

async function postMixed(
  question: string,
  context: StructuredContext | undefined,
  signal: AbortSignal | undefined
): Promise<AskAtlasGovernedTurn> {
  const request = mixedRequestSchema.safeParse({
    question,
    source_mode: "Both",
    ...(context ? { context } : {}),
  });
  if (!request.success) {
    throw new AskAtlasAssistantRequestError();
  }
  try {
    const result = await askAtlasMixed(request.data, { signal });
    const response = parseMixedAssistantResponse(result.data);
    if (!response) {
      throw new AskAtlasAnswerContractError("malformed");
    }
    return {
      kind: "mixed",
      requestId: result.headers.get("X-Request-ID"),
      response,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof AskAtlasAnswerContractError) {
      throw error;
    }
    if (error instanceof AtlasApiError) {
      const response = parseMixedAssistantResponse(error.responseBody);
      if (response) {
        return { kind: "mixed", requestId: error.requestId, response };
      }
    }
    throw error;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
