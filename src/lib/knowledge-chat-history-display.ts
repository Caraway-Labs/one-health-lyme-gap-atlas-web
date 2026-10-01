import type { KnowledgeChatResponse } from "@/generated/models";

import type { LocalConversation } from "./knowledge-chat-storage";

const PREVIEW_MAX_LENGTH = 72;

const answeredEvidenceLabels: Partial<
  Record<KnowledgeChatResponse["evidence_state"], string>
> = {
  single_study: "Single-study",
  consistent: "Consistent",
  limited: "Limited",
  mixed: "Mixed",
  conflicting: "Conflicting",
  insufficient_to_compare: "Insufficient to compare",
};

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function relativeConversationTime(
  isoTimestamp: string,
  now = Date.now()
): string {
  const then = Date.parse(isoTimestamp);
  if (Number.isNaN(then)) {
    return "";
  }
  const deltaMs = Math.max(0, now - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (deltaMs < minute) {
    return "Just now";
  }
  if (deltaMs < hour) {
    const minutes = Math.floor(deltaMs / minute);
    return `${minutes}m ago`;
  }
  if (deltaMs < day) {
    const hours = Math.floor(deltaMs / hour);
    return `${hours}h ago`;
  }
  if (deltaMs < 7 * day) {
    const days = Math.floor(deltaMs / day);
    return days === 1 ? "Yesterday" : `${days}d ago`;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(then));
}

export function conversationTurnPreview(
  conversation: LocalConversation
): string | null {
  const lastAssistant = conversation.turns
    .toReversed()
    .find((turn) => turn.role === "assistant" && turn.text.trim());
  if (!lastAssistant) {
    return null;
  }
  return truncate(lastAssistant.text, PREVIEW_MAX_LENGTH);
}

export function conversationEvidenceStrengthLabel(
  conversation: LocalConversation
): string | null {
  const lastAnswered = conversation.turns
    .toReversed()
    .find(
      (turn) =>
        turn.role === "assistant" && turn.response?.status === "answered"
    );
  if (!lastAnswered?.response) {
    return null;
  }
  return answeredEvidenceLabels[lastAnswered.response.evidence_state] ?? null;
}
