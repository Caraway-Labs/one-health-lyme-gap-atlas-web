"use client";

import { useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";

import {
  clientFailure,
  type ClientFailure,
} from "@/components/evidence-chat/client-failure";
import type { EvidenceChatConversationModel } from "@/components/evidence-chat/use-evidence-chat";
import type { KnowledgeChatResponse } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";
import { ASK_ATLAS_SOURCE_MODES } from "@/lib/ask-atlas-source-mode";
import type { LocalConversation } from "@/lib/knowledge-chat-storage";

import {
  isOutcomeMatrixChatBody,
  outcomeMatrixByStoryPreset,
} from "../../tests/fixtures/ask-atlas-outcome-matrix";
import {
  oneCitationResponse,
  STORY_CHAT_CREATED_AT,
  STORY_CHAT_QUESTION,
} from "../fixtures/story-chat";

const NEAR_LIMIT_NOTE = "Synthetic question. ";

export const storyChatNearLimitMessage = NEAR_LIMIT_NOTE.repeat(45);

export const OUTCOME_MATRIX_STORY_PRESETS = [
  "matrix-answered-limited",
  "matrix-answered-single-study",
  "matrix-capacity-limited",
  "matrix-corpus-gap",
  "matrix-evidence-unavailable",
  "matrix-network",
  "matrix-rate-limited",
  "matrix-safety-refusal",
  "matrix-timeout",
  "matrix-unprocessable",
] as const;

export type OutcomeMatrixStoryPreset =
  (typeof OUTCOME_MATRIX_STORY_PRESETS)[number];

export type StoryChatPreset =
  | "client-failure"
  | "empty"
  | "grounded"
  | "near-limit"
  | "pending"
  | "structured-outcome"
  | OutcomeMatrixStoryPreset;

function isOutcomeMatrixStoryPreset(
  preset: StoryChatPreset
): preset is OutcomeMatrixStoryPreset {
  return (OUTCOME_MATRIX_STORY_PRESETS as readonly string[]).includes(preset);
}

function matrixFailure(preset: OutcomeMatrixStoryPreset): ClientFailure | null {
  switch (preset) {
    case "matrix-answered-limited":
    case "matrix-answered-single-study":
    case "matrix-capacity-limited":
    case "matrix-corpus-gap":
    case "matrix-evidence-unavailable":
    case "matrix-safety-refusal": {
      return null;
    }
    case "matrix-network": {
      return clientFailure(new TypeError("Failed to fetch"));
    }
    case "matrix-rate-limited": {
      return clientFailure(
        new AtlasApiError("busy", "/v1/knowledge-graph/chat", 429, null)
      );
    }
    case "matrix-timeout": {
      return clientFailure(
        new AtlasApiError("timeout", "/v1/knowledge-graph/chat", 504, null)
      );
    }
    case "matrix-unprocessable": {
      return clientFailure(
        new AtlasApiError("invalid", "/v1/knowledge-graph/chat", 422, null)
      );
    }
    default: {
      const unhandled: never = preset;
      return unhandled;
    }
  }
}

function matrixStoryInitial(preset: OutcomeMatrixStoryPreset): {
  conversations: LocalConversation[];
  failure: ClientFailure | null;
  message: string;
  pending: boolean;
  retryQuestion: string;
} {
  const outcome = outcomeMatrixByStoryPreset(preset);
  if (!outcome) {
    throw new Error(`Missing Ask Atlas outcome story for ${preset}`);
  }
  const failure = matrixFailure(preset);
  const response = isOutcomeMatrixChatBody(outcome.body) ? outcome.body : null;
  const retained = outcome.composer === "retained";
  return {
    conversations:
      response === null
        ? []
        : [conversation([userTurn(outcome.question), assistantTurn(response)])],
    failure,
    message: retained ? outcome.question : "",
    pending: false,
    retryQuestion: failure?.retry ? outcome.question : "",
  };
}

function conversation(turns: LocalConversation["turns"]): LocalConversation {
  return {
    createdAt: STORY_CHAT_CREATED_AT,
    expiresAt: "2026-11-05T04:57:46.000Z",
    id: "story-chat-conversation",
    title: "Synthetic literature question",
    turns,
    updatedAt: STORY_CHAT_CREATED_AT,
  };
}

function userTurn(text: string): LocalConversation["turns"][number] {
  return {
    createdAt: STORY_CHAT_CREATED_AT,
    id: "story-user-turn",
    role: "user",
    text,
  };
}

function assistantTurn(
  response: KnowledgeChatResponse
): LocalConversation["turns"][number] {
  return {
    createdAt: STORY_CHAT_CREATED_AT,
    id: "story-assistant-turn",
    response,
    role: "assistant",
    text: response.answer,
  };
}

export function storyChatInitial(
  preset: StoryChatPreset,
  outcome: KnowledgeChatResponse
): {
  conversations: LocalConversation[];
  failure: ClientFailure | null;
  message: string;
  pending: boolean;
  retryQuestion: string;
} {
  switch (preset) {
    case "empty": {
      return {
        conversations: [],
        failure: null,
        message: "",
        pending: false,
        retryQuestion: "",
      };
    }
    case "grounded": {
      return {
        conversations: [
          conversation([
            userTurn(STORY_CHAT_QUESTION),
            assistantTurn(oneCitationResponse()),
          ]),
        ],
        failure: null,
        message: "",
        pending: false,
        retryQuestion: "",
      };
    }
    case "pending": {
      return {
        conversations: [conversation([userTurn(STORY_CHAT_QUESTION)])],
        failure: null,
        message: "Synthetic draft kept while the preview is pending.",
        pending: true,
        retryQuestion: "",
      };
    }
    case "structured-outcome": {
      return {
        conversations: [
          conversation([userTurn(STORY_CHAT_QUESTION), assistantTurn(outcome)]),
        ],
        failure: null,
        message: "",
        pending: false,
        retryQuestion: "",
      };
    }
    case "client-failure": {
      return {
        conversations: [conversation([userTurn(STORY_CHAT_QUESTION)])],
        failure: {
          message:
            "This browser could not complete the request. Check your connection and try again.",
          retry: true,
          state: "network_failure",
          title: "Connection problem.",
        },
        message: "",
        pending: false,
        retryQuestion: STORY_CHAT_QUESTION,
      };
    }
    case "near-limit": {
      return {
        conversations: [],
        failure: null,
        message: storyChatNearLimitMessage,
        pending: false,
        retryQuestion: "",
      };
    }
    default: {
      if (isOutcomeMatrixStoryPreset(preset)) {
        return matrixStoryInitial(preset);
      }
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export function useStoryChatModel(
  preset: StoryChatPreset,
  outcome: KnowledgeChatResponse
): EvidenceChatConversationModel & { action: string } {
  const initial = storyChatInitial(preset, outcome);
  const [conversations, setConversations] = useState(initial.conversations);
  const [message, setMessage] = useState(initial.message);
  const [pending, setPending] = useState(initial.pending);
  const [failure, setFailure] = useState<ClientFailure | null>(initial.failure);
  const [retryQuestion, setRetryQuestion] = useState(initial.retryQuestion);
  const [action, setAction] = useState("No local action yet.");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const failureRegionRef = useRef<HTMLDivElement>(null);
  const mobileHistoryToggleRef = useRef<HTMLButtonElement>(null);
  const active = conversations[0];

  const ask = async (question: string) => {
    setPending(false);
    setFailure(null);
    setRetryQuestion("");
    setAction(`Retried: ${question}`);
  };

  const editQuestion = (question: string) => {
    setMessage(question);
    setAction(`Editing: ${question}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const question = message.trim();
    if (!question || pending) {
      return;
    }
    const response = oneCitationResponse();
    setConversations([
      conversation([
        ...(active?.turns ?? []),
        {
          createdAt: STORY_CHAT_CREATED_AT,
          id: `story-user-${active?.turns.length ?? 0}`,
          role: "user",
          text: question,
        },
        {
          createdAt: STORY_CHAT_CREATED_AT,
          id: `story-assistant-${active?.turns.length ?? 0}`,
          response,
          role: "assistant",
          text: response.answer,
        },
      ]),
    ]);
    setFailure(null);
    setMessage("");
    setRetryQuestion("");
    setAction(`Submitted: ${question}`);
  };

  return {
    action,
    active,
    activeId: active?.id ?? "__latest__",
    ask,
    charCountNearLimit: message.length >= 900,
    clearAllConversations: () => {
      setConversations([]);
      setFailure(null);
      setMessage("");
      setPending(false);
      setRetryQuestion("");
      setAction("Cleared conversations.");
    },
    composerHasUnsentText: () => message.trim().length > 0,
    conversations,
    deleteOne: () => {
      setConversations([]);
      setFailure(null);
      setMessage("");
      setPending(false);
      setRetryQuestion("");
      setAction("Deleted the conversation.");
    },
    editQuestion,
    failure,
    failureRegionRef: failureRegionRef as RefObject<HTMLDivElement | null>,
    hasSavedConversations: conversations.length > 0,
    hydrated: true,
    inputRef: inputRef as RefObject<HTMLTextAreaElement | null>,
    message,
    missingConversationId: null,
    mobileHistoryOpen: false,
    mobileHistoryToggleRef:
      mobileHistoryToggleRef as RefObject<HTMLButtonElement | null>,
    mode: "drawer",
    pending,
    pendingStatusVisible: pending,
    requestsEnabled: false,
    retryQuestion,
    selectConversation: () => {},
    setMessage,
    setMobileHistoryOpen: () => {},
    showEmptyState: (active?.turns.length ?? 0) === 0 && !pending && !failure,
    startNewChat: () => {
      setConversations([]);
      setFailure(null);
      setMessage("");
      setPending(false);
      setRetryQuestion("");
      setAction("Started a new chat.");
    },
    submit,
    sourceMode: "Literature",
    sourceModeSelection: false,
    sourceModes: ASK_ATLAS_SOURCE_MODES,
    setSourceMode: () => {},
    workspaceHandoffConversationId: active ? active.id : undefined,
  };
}
