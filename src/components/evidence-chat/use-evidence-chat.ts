"use client";

import type { FormEvent, RefObject } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { knowledgeGraphChatV1KnowledgeGraphChatPost } from "@/generated/atlas";
import type { KnowledgeChatResponse } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  acceptAskAtlasPayload,
  AskAtlasAnswerContractError,
} from "@/lib/ask-atlas-answer-contract";
import {
  readAssistantConversationId,
  resolveActiveConversation,
  resolveConversationSelection,
  synchronizeAssistantConversationUrl,
} from "@/lib/assistant-conversation-url";
import type { LocalConversation } from "@/lib/knowledge-chat-storage";
import {
  CHAT_STORAGE_EVENT,
  clearConversations,
  conversationHistory,
  createConversation,
  loadConversations,
  removeConversation,
  RETENTION_MS,
  saveConversations,
} from "@/lib/knowledge-chat-storage";

import {
  clientFailure,
  isOperationalStatus,
  retainsSubmittedQuestion,
  shouldReplaceOperationalTurn,
  type ClientFailure,
} from "./client-failure";
import type { AssistantChatLayoutMode } from "./types";

export interface EvidenceChatConversationModel {
  active: LocalConversation | undefined;
  activeId: string;
  ask: (question: string) => Promise<void>;
  charCountNearLimit: boolean;
  clearAllConversations: () => void;
  conversations: LocalConversation[];
  deleteOne: (id: string) => void;
  editQuestion: (question: string) => void;
  failure: ClientFailure | null;
  failureRegionRef: RefObject<HTMLDivElement | null>;
  hasSavedConversations: boolean;
  hydrated: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  message: string;
  missingConversationId: string | null;
  mobileHistoryOpen: boolean;
  mobileHistoryToggleRef: RefObject<HTMLButtonElement | null>;
  mode: AssistantChatLayoutMode;
  pending: boolean;
  requestsEnabled: boolean;
  retryQuestion: string;
  selectConversation: (id: string) => void;
  setMessage: (value: string) => void;
  setMobileHistoryOpen: (open: boolean) => void;
  showEmptyState: boolean;
  startNewChat: (focusComposer?: boolean) => void;
  submit: (event: FormEvent) => void;
  workspaceHandoffConversationId: string | undefined;
}

export function useEvidenceChat({
  mode = "workspace",
  initialConversationId,
  requestsEnabled = true,
}: {
  mode?: AssistantChatLayoutMode;
  initialConversationId?: string;
  requestsEnabled?: boolean;
}): EvidenceChatConversationModel {
  const syncWorkspaceUrl = mode === "workspace";
  const requestSerial = useRef(0);
  const ownerAlive = useRef(true);
  const requestAbort = useRef<Set<AbortController>>(new Set());
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState(
    initialConversationId ?? "__latest__"
  );
  const activeIdRef = useRef(activeId);
  const [missingConversationId, setMissingConversationId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientFailure | null>(null);
  const [retryQuestion, setRetryQuestion] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const failureRegionRef = useRef<HTMLDivElement>(null);
  const focusQuestionOnSettle = useRef(false);
  const handoffFocusApplied = useRef(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const mobileHistoryToggleRef = useRef<HTMLButtonElement>(null);

  const applyConversationSelection = useCallback(
    (
      requestedId: string | null | undefined,
      nextConversations: LocalConversation[]
    ) => {
      const selection = resolveConversationSelection(
        requestedId,
        nextConversations
      );
      setActiveId(selection.activeId);
      setMissingConversationId(selection.missingConversationId);
      if (syncWorkspaceUrl && selection.missingConversationId) {
        synchronizeAssistantConversationUrl();
      }
    },
    [syncWorkspaceUrl]
  );

  const syncActiveConversationUrl = useCallback(
    (conversationId: string) => {
      if (!syncWorkspaceUrl || conversationId === "__latest__") {
        return;
      }
      if (conversationId === "__new__" || conversationId === "") {
        synchronizeAssistantConversationUrl();
        return;
      }
      if (conversations.some((item) => item.id === conversationId)) {
        synchronizeAssistantConversationUrl(conversationId);
      }
    },
    [conversations, syncWorkspaceUrl]
  );

  useLayoutEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useLayoutEffect(() => {
    ownerAlive.current = true;
    const controllers = requestAbort.current;
    return () => {
      ownerAlive.current = false;
      requestSerial.current += 1;
      for (const controller of controllers) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  const startNewChat = useCallback(
    (focusComposer = true) => {
      abandonOwnedRequest(requestSerial, requestAbort);
      setPending(false);
      activeIdRef.current = "__new__";
      setActiveId("__new__");
      setMissingConversationId(null);
      setFailure(null);
      setRetryQuestion("");
      setMessage("");
      if (syncWorkspaceUrl) {
        synchronizeAssistantConversationUrl();
      }
      if (focusComposer) {
        inputRef.current?.focus();
      }
    },
    [syncWorkspaceUrl]
  );

  useEffect(() => {
    const loaded = loadConversations();
    const refresh = () => setConversations(loadConversations());
    // eslint-disable-next-line react/set-state-in-effect -- hydrate browser-local chat history once on mount.
    setConversations(loaded);
    setHydrated(true);
    if (syncWorkspaceUrl) {
      const requestedId =
        initialConversationId ?? readAssistantConversationId() ?? undefined;
      applyConversationSelection(requestedId, loaded);
    }
    window.addEventListener(CHAT_STORAGE_EVENT, refresh);
    return () => window.removeEventListener(CHAT_STORAGE_EVENT, refresh);
  }, [applyConversationSelection, initialConversationId, syncWorkspaceUrl]);

  useEffect(() => {
    if (syncWorkspaceUrl && missingConversationId) {
      synchronizeAssistantConversationUrl();
    }
  }, [missingConversationId, syncWorkspaceUrl]);

  useEffect(() => {
    if (!syncWorkspaceUrl || !hydrated) {
      return;
    }
    function onPopState() {
      const requestedId = readAssistantConversationId();
      const loaded = loadConversations();
      const selection = resolveConversationSelection(requestedId, loaded);
      if (selection.activeId !== activeIdRef.current) {
        abandonOwnedRequest(requestSerial, requestAbort);
        setPending(false);
        setFailure(null);
        setRetryQuestion("");
      }
      activeIdRef.current = selection.activeId;
      applyConversationSelection(requestedId, loaded);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyConversationSelection, hydrated, syncWorkspaceUrl]);

  useEffect(() => {
    if (!syncWorkspaceUrl || !hydrated || missingConversationId) {
      return;
    }
    syncActiveConversationUrl(activeId);
  }, [
    activeId,
    hydrated,
    missingConversationId,
    syncActiveConversationUrl,
    syncWorkspaceUrl,
  ]);

  useEffect(() => {
    if (pending || !focusQuestionOnSettle.current) return;
    focusQuestionOnSettle.current = false;
    focusChatSettlementTarget(inputRef.current);
  }, [pending]);

  useEffect(() => {
    if (!failure) {
      return;
    }
    const retryButton = failureRegionRef.current?.querySelector<HTMLElement>(
      "button[type='button']"
    );
    focusChatSettlementTarget(retryButton ?? failureRegionRef.current);
  }, [failure]);

  const active = resolveActiveConversation(activeId, conversations, hydrated);

  useEffect(() => {
    if (
      handoffFocusApplied.current ||
      mode !== "workspace" ||
      !initialConversationId ||
      !hydrated ||
      missingConversationId
    ) {
      return;
    }
    if (!active?.turns.length) {
      return;
    }
    handoffFocusApplied.current = true;
    document.querySelector<HTMLElement>(".chat-transcript")?.focus();
  }, [
    active?.turns.length,
    hydrated,
    initialConversationId,
    missingConversationId,
    mode,
  ]);

  const showEmptyState =
    !active?.turns.length && !pending && !failure && !missingConversationId;
  const charCountNearLimit = message.length >= 900;

  function rememberOutcome(question: string, response: KnowledgeChatResponse) {
    setFailure(null);
    setMessage(retainsSubmittedQuestion(response) ? question : "");
    setRetryQuestion(isOperationalStatus(response.status) ? question : "");
  }

  function editQuestion(question: string) {
    setFailure(null);
    setMessage(question);
    inputRef.current?.focus();
  }

  function saveResponse(
    question: string,
    response: KnowledgeChatResponse,
    replaceOperationalTurn: boolean
  ) {
    const stored = loadConversations();
    const ownedId = active?.id;
    const owned = ownedId
      ? stored.find((item) => item.id === ownedId)
      : undefined;
    if (ownedId && !owned) {
      return;
    }
    const conversation =
      owned ?? active ?? createConversation(response, question);
    const now = new Date().toISOString();
    const priorTurns = replaceOperationalTurn
      ? conversation.turns.slice(0, -2)
      : conversation.turns;
    const updated: LocalConversation = {
      ...conversation,
      expiresAt: new Date(Date.parse(now) + RETENTION_MS).toISOString(),
      turns: [
        ...priorTurns,
        {
          id: `${response.request_id}:user`,
          role: "user",
          text: question,
          createdAt: now,
        },
        {
          id: response.request_id,
          role: "assistant",
          text: response.answer,
          response,
          createdAt: now,
        },
      ],
      updatedAt: now,
    };
    const next = [
      updated,
      ...stored.filter((item) => item.id !== updated.id),
    ].slice(0, 5);
    saveConversations(next);
    setConversations(next);
    const selectionStillOwnsRequest =
      !ownedId ||
      activeIdRef.current === ownedId ||
      activeIdRef.current === "__latest__";
    if (!selectionStillOwnsRequest) {
      return;
    }
    activeIdRef.current = updated.id;
    setActiveId(updated.id);
    setMissingConversationId(null);
  }

  function requestStillCurrent(serial: number): boolean {
    return ownerAlive.current && serial === requestSerial.current;
  }

  async function ask(question: string) {
    if (!question || pending || !requestsEnabled) {
      return;
    }
    const serial = requestSerial.current + 1;
    requestSerial.current = serial;
    const replaceOperationalTurn = shouldReplaceOperationalTurn(
      active,
      question
    );
    const controller = new AbortController();
    requestAbort.current.add(controller);
    setPending(true);
    setFailure(null);
    try {
      const result = await knowledgeGraphChatV1KnowledgeGraphChatPost(
        {
          message: question,
          history: conversationHistory(
            replaceOperationalTurn && active
              ? { ...active, turns: active.turns.slice(0, -2) }
              : active
          ),
        },
        { signal: controller.signal }
      );
      if (!requestStillCurrent(serial) || controller.signal.aborted) {
        return;
      }
      const accepted = acceptAskAtlasPayload(result.data);
      if (!accepted.ok) {
        throw new AskAtlasAnswerContractError(
          accepted.reason === "not_chat_response"
            ? "malformed"
            : accepted.reason
        );
      }
      saveResponse(question, accepted.response, replaceOperationalTurn);
      rememberOutcome(question, accepted.response);
    } catch (error) {
      if (
        !requestStillCurrent(serial) ||
        controller.signal.aborted ||
        isAbortError(error)
      ) {
        return;
      }
      if (error instanceof AtlasApiError) {
        const accepted = acceptAskAtlasPayload(error.responseBody);
        if (accepted.ok) {
          saveResponse(question, accepted.response, replaceOperationalTurn);
          rememberOutcome(question, accepted.response);
          return;
        }
        if (accepted.reason !== "not_chat_response") {
          const contractError = new AskAtlasAnswerContractError(
            accepted.reason
          );
          setRetryQuestion(question);
          setFailure(clientFailure(contractError));
          return;
        }
      }
      const nextFailure = clientFailure(error);
      setRetryQuestion(nextFailure.retry ? question : "");
      setFailure(nextFailure);
    } finally {
      requestAbort.current.delete(controller);
      if (requestStillCurrent(serial)) {
        focusQuestionOnSettle.current = true;
        setPending(false);
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(message.trim());
  }

  function deleteOne(id: string) {
    const next = removeConversation(id);
    setConversations(next);
    if (activeIdRef.current !== id) {
      return;
    }
    abandonOwnedRequest(requestSerial, requestAbort);
    setPending(false);
    const nextId = next[0]?.id ?? "__new__";
    activeIdRef.current = nextId;
    setActiveId(nextId);
    setMissingConversationId(null);
    setFailure(null);
    setRetryQuestion("");
  }

  function clearAllConversations() {
    clearConversations();
    setConversations([]);
    setMobileHistoryOpen(false);
    startNewChat(false);
  }

  function selectConversation(id: string) {
    if (id !== activeIdRef.current) {
      abandonOwnedRequest(requestSerial, requestAbort);
      setPending(false);
    }
    activeIdRef.current = id;
    setActiveId(id);
    setMissingConversationId(null);
    setFailure(null);
    setRetryQuestion("");
  }

  const workspaceHandoffConversationId =
    active?.id && active.turns.length > 0 ? active.id : undefined;

  return {
    active,
    activeId,
    ask,
    charCountNearLimit,
    clearAllConversations,
    conversations,
    deleteOne,
    editQuestion,
    failure,
    failureRegionRef,
    hasSavedConversations: conversations.length > 0,
    hydrated,
    inputRef,
    message,
    missingConversationId,
    mobileHistoryOpen,
    mobileHistoryToggleRef,
    mode,
    pending,
    requestsEnabled,
    retryQuestion,
    selectConversation,
    setMessage,
    setMobileHistoryOpen,
    showEmptyState,
    startNewChat,
    submit,
    workspaceHandoffConversationId,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Drop a response that no longer belongs to the selected conversation. */
function abandonOwnedRequest(
  requestSerial: { current: number },
  requestAbort: { current: Set<AbortController> }
): void {
  requestSerial.current += 1;
  for (const controller of requestAbort.current) {
    controller.abort();
  }
  requestAbort.current.clear();
}

/** Move focus only while the user is still in this chat. A docked page keeps its control. */
function focusChatSettlementTarget(target: HTMLElement | null | undefined) {
  if (!target?.isConnected) {
    return;
  }
  const active = document.activeElement;
  const interactionRoot =
    target.closest<HTMLElement>("#ux-reset-ask-atlas") ??
    target.closest<HTMLElement>(".evidence-chat") ??
    target.closest<HTMLElement>(".chat-panel");
  const interactionLeftChat =
    active instanceof HTMLElement &&
    active !== document.body &&
    !interactionRoot?.contains(active);
  if (interactionLeftChat) {
    return;
  }
  target.focus();
}
