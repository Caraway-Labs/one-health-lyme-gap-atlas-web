import type { KnowledgeChatResponse } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";
import { ApiResponseValidationError } from "@/lib/api-response-validation";
import {
  AskAtlasAnswerContractError,
  type AskAtlasCloseReason,
} from "@/lib/ask-atlas-answer-contract";
import type { LocalConversation } from "@/lib/knowledge-chat-storage";

export interface ClientFailure {
  message: string;
  reason?: AskAtlasCloseReason;
  retry: boolean;
  state:
    | "network_failure"
    | "rate_limited"
    | "request_not_processed"
    | "response_unverified"
    | "timeout";
  title: string;
}

export function isOperationalStatus(
  status: KnowledgeChatResponse["status"] | undefined
): boolean {
  return status === "evidence_unavailable" || status === "capacity_limited";
}

export function retainsSubmittedQuestion(
  response: KnowledgeChatResponse
): boolean {
  return (
    isOperationalStatus(response.status) ||
    (response.status === "no_evidence" &&
      response.evidence_state === "no_relevant_corpus_evidence")
  );
}

export function shouldReplaceOperationalTurn(
  conversation: LocalConversation | undefined,
  question: string
): boolean {
  const user = conversation?.turns.at(-2);
  const assistant = conversation?.turns.at(-1);
  return (
    user?.role === "user" &&
    user.text === question &&
    isOperationalStatus(assistant?.response?.status)
  );
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof AtlasApiError) {
    return error.status === 408 || error.status === 504;
  }
  return error instanceof Error && error.name === "TimeoutError";
}

export function clientFailure(error: unknown): ClientFailure {
  if (
    error instanceof ApiResponseValidationError ||
    error instanceof AskAtlasAnswerContractError
  ) {
    return {
      message: error.message,
      reason:
        error instanceof AskAtlasAnswerContractError
          ? error.reason
          : "malformed",
      retry: true,
      state: "response_unverified",
      title: "Response could not be verified.",
    };
  }
  if (isTimeoutError(error)) {
    return {
      message:
        "The assistant did not answer before the request timed out. This is not a finding that the Atlas corpus lacks relevant literature.",
      retry: true,
      state: "timeout",
      title: "Request timed out.",
    };
  }
  if (!(error instanceof AtlasApiError)) {
    return {
      message:
        "This browser could not complete the request. Check your connection and try again.",
      retry: true,
      state: "network_failure",
      title: "Connection problem.",
    };
  }
  if (error.status === 429) {
    return {
      message:
        "The assistant is busy and did not finish this request. Please try again shortly.",
      retry: true,
      state: "rate_limited",
      title: "Assistant is busy.",
    };
  }
  if (error.status === 422) {
    return {
      message:
        "That question could not be processed. Please revise it and try again.",
      retry: false,
      state: "request_not_processed",
      title: "Question not processed.",
    };
  }
  return {
    message:
      "The assistant service did not complete this request. This is not a finding that the Atlas corpus lacks relevant literature.",
    retry: true,
    state: "network_failure",
    title: "Service error.",
  };
}
