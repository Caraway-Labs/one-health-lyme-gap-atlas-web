import { RESET_ASSISTANT_PATH } from "@/features/ux-reset/routes";

const LEGACY_ASSISTANT_PATH = "/assistant";

/** Legacy `/assistant` and the reset research workspace share one local conversation id. */
const ASSISTANT_WORKSPACE_PATHS = new Set<string>([
  LEGACY_ASSISTANT_PATH,
  RESET_ASSISTANT_PATH,
]);

function assistantWorkspacePath(href: string): string | null {
  try {
    const url = new URL(href);
    return ASSISTANT_WORKSPACE_PATHS.has(url.pathname) ? url.pathname : null;
  } catch {
    return null;
  }
}

export function readAssistantConversationId(
  href = typeof window === "undefined" ? "" : window.location.href
): string | null {
  if (!assistantWorkspacePath(href)) {
    return null;
  }
  try {
    return new URL(href).searchParams.get("conversation");
  } catch {
    return null;
  }
}

export function assistantConversationHref(conversationId?: string): string {
  if (!conversationId) {
    return LEGACY_ASSISTANT_PATH;
  }
  return `${LEGACY_ASSISTANT_PATH}?conversation=${encodeURIComponent(conversationId)}`;
}

/**
 * Keep the assistant workspace URL aligned with the active local conversation.
 * Uses replaceState so high-frequency chat updates do not pollute browser history.
 */
export function synchronizeAssistantConversationUrl(
  conversationId?: string,
  href = window.location.href
): void {
  const url = new URL(href);
  if (!ASSISTANT_WORKSPACE_PATHS.has(url.pathname)) {
    return;
  }
  const current = url.searchParams.get("conversation");
  if (!conversationId) {
    if (!current) {
      return;
    }
    url.searchParams.delete("conversation");
  } else if (current === conversationId) {
    return;
  } else {
    url.searchParams.set("conversation", conversationId);
  }
  window.history.replaceState(window.history.state, "", url.href);
}

export interface ConversationSelection {
  activeId: string;
  missingConversationId: string | null;
}

export function resolveConversationSelection(
  requestedId: string | null | undefined,
  conversations: { id: string }[],
  preferLatestWhenEmpty = true
): ConversationSelection {
  if (!requestedId) {
    return {
      activeId: preferLatestWhenEmpty
        ? (conversations[0]?.id ?? "__new__")
        : "__new__",
      missingConversationId: null,
    };
  }
  const exists = conversations.some((item) => item.id === requestedId);
  if (exists) {
    return { activeId: requestedId, missingConversationId: null };
  }
  return { activeId: "__new__", missingConversationId: requestedId };
}

export function resolveActiveConversation<T extends { id: string }>(
  activeId: string,
  conversations: T[],
  hydrated: boolean
): T | undefined {
  if (activeId === "__new__" || activeId === "") {
    return undefined;
  }
  const match = conversations.find((item) => item.id === activeId);
  if (match) {
    return match;
  }
  if (!hydrated || activeId !== "__latest__") {
    return undefined;
  }
  return conversations[0];
}
