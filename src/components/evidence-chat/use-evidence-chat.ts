"use client";

import type { FormEvent, RefObject } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type {
  KnowledgeChatResponse,
  StructuredContext,
} from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  askOutcomeForFailure,
  askOutcomeForGovernedTurn,
  askOutcomeForLiteratureStatus,
  askSurfaceForLayout,
} from "@/lib/ask-atlas-analytics";
import {
  acceptAskAtlasPayload,
  AskAtlasAnswerContractError,
} from "@/lib/ask-atlas-answer-contract";
import { postAskAtlas } from "@/lib/ask-atlas-assistant-adapter";
import type { AskAtlasGovernedTurn } from "@/lib/ask-atlas-assistant-payload";
import {
  ASK_ATLAS_SOURCE_MODES,
  isEnabledAskAtlasSourceMode,
  type AskAtlasSourceMode,
} from "@/lib/ask-atlas-source-mode";
import {
  readAssistantConversationId,
  resolveActiveConversation,
  resolveConversationSelection,
  synchronizeAssistantConversationUrl,
} from "@/lib/assistant-conversation-url";
import { trackAskAnswered, trackAskSubmitted } from "@/lib/atlas-analytics";
import type { LocalConversation } from "@/lib/knowledge-chat-storage";
import {
  CHAT_STORAGE_EVENT,
  clearConversations,
  conversationHistory,
  createConversation,
  createLocalConversation,
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

/**
 * Browser deadline for one Ask Atlas request.
 * The answer service gives up at 28s. This waits longer so that deadline can
 * still return a typed outcome before the browser aborts a stalled request.
 * It is a fixed client limit, not a public environment setting.
 */
export const ASK_ATLAS_CLIENT_DEADLINE_MS = 35_000;

/** Hold the searching announcement until a wait is long enough to read. */
export const ASK_ATLAS_PENDING_STATUS_DELAY_MS = 300;

export interface EvidenceChatConversationModel {
  active: LocalConversation | undefined;
  activeId: string;
  ask: (question: string) => Promise<void>;
  charCountNearLimit: boolean;
  clearAllConversations: () => void;
  composerHasUnsentText: () => boolean;
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
  pendingStatusVisible: boolean;
  requestsEnabled: boolean;
  retryQuestion: string;
  selectConversation: (id: string) => void;
  setMessage: (value: string) => void;
  setMobileHistoryOpen: (open: boolean) => void;
  setSourceMode: (mode: AskAtlasSourceMode) => void;
  showEmptyState: boolean;
  sourceMode: AskAtlasSourceMode;
  sourceModeSelection: boolean;
  sourceModes: readonly AskAtlasSourceMode[];
  startNewChat: (focusComposer?: boolean) => void;
  submit: (event: FormEvent) => void;
  workspaceHandoffConversationId: string | undefined;
}

export function useEvidenceChat({
  mode = "workspace",
  initialConversationId,
  requestsEnabled = true,
  sourceModeSelection = false,
  structuredContext,
}: {
  mode?: AssistantChatLayoutMode;
  initialConversationId?: string;
  requestsEnabled?: boolean;
  sourceModeSelection?: boolean;
  structuredContext?: StructuredContext;
}): EvidenceChatConversationModel {
  const syncWorkspaceUrl = mode === "workspace";
  const askSurface = askSurfaceForLayout(mode);
  const requestSerial = useRef(0);
  const ownerAlive = useRef(true);
  const requestAbort = useRef<Set<AbortController>>(new Set());
  const requestDeadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineSettledSerial = useRef<number | null>(null);
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
  const submittedDraftRef = useRef("");
  const [pending, setPending] = useState(false);
  const [pendingStatusVisible, setPendingStatusVisible] = useState(false);
  const [failure, setFailure] = useState<ClientFailure | null>(null);
  const [retryQuestion, setRetryQuestion] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const failureRegionRef = useRef<HTMLDivElement>(null);
  const focusQuestionOnSettle = useRef(false);
  const handoffFocusApplied = useRef(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const mobileHistoryToggleRef = useRef<HTMLButtonElement>(null);
  const [sourceMode, setSourceModeState] =
    useState<AskAtlasSourceMode>("Literature");
  const sourceModeRef = useRef(sourceMode);
  const structuredContextRef = useRef(structuredContext);
  useLayoutEffect(() => {
    sourceModeRef.current = sourceMode;
    structuredContextRef.current = structuredContext;
  }, [sourceMode, structuredContext]);

  const setSourceMode = useCallback(
    (next: AskAtlasSourceMode) => {
      if (!sourceModeSelection || !isEnabledAskAtlasSourceMode(next)) {
        return;
      }
      setSourceModeState(next);
    },
    [sourceModeSelection]
  );

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
    return () => {
      ownerAlive.current = false;
      abandonOwnedRequest(
        requestSerial,
        requestAbort,
        requestDeadline,
        pendingStatusTimer
      );
    };
  }, []);

  const startNewChat = useCallback(
    (focusComposer = true) => {
      abandonOwnedRequest(
        requestSerial,
        requestAbort,
        requestDeadline,
        pendingStatusTimer
      );
      setPendingStatusVisible(false);
      setPending(false);
      activeIdRef.current = "__new__";
      setActiveId("__new__");
      setMissingConversationId(null);
      setFailure(null);
      setRetryQuestion("");
      setMessage("");
      submittedDraftRef.current = "";
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
        abandonOwnedRequest(
          requestSerial,
          requestAbort,
          requestDeadline,
          pendingStatusTimer
        );
        setPendingStatusVisible(false);
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

  function settleAcceptedResponse(
    question: string,
    acceptedResponse: KnowledgeChatResponse,
    replaceOperationalTurn: boolean
  ) {
    saveResponse(question, acceptedResponse, replaceOperationalTurn);
    rememberOutcome(question, acceptedResponse);
  }

  function settleGovernedResponse(
    question: string,
    turn: AskAtlasGovernedTurn,
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
      owned ?? active ?? createLocalConversation(crypto.randomUUID(), question);
    const now = new Date().toISOString();
    const priorTurns = replaceOperationalTurn
      ? conversation.turns.slice(0, -2)
      : conversation.turns;
    const turnId = turn.requestId ?? crypto.randomUUID();
    const outcome =
      turn.kind === "structured"
        ? turn.response.answer.outcome
        : turn.response.outcome;
    const sources =
      turn.kind === "structured"
        ? (turn.response.answer.actual_sources_used ?? [])
        : turn.response.actual_sources_used;
    const updated: LocalConversation = {
      ...conversation,
      expiresAt: new Date(Date.parse(now) + RETENTION_MS).toISOString(),
      turns: [
        ...priorTurns,
        {
          createdAt: now,
          id: `${turnId}:user`,
          role: "user",
          text: question,
        },
        {
          assistantPayload: turn,
          createdAt: now,
          id: turnId,
          role: "assistant",
          text: outcome,
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
    setFailure(null);
    setRetryQuestion("");
    setMessage(sources.length === 0 && outcome !== "ANSWERED" ? question : "");
  }

  async function ask(question: string) {
    if (!question || pending || !requestsEnabled) {
      return;
    }
    const serial = requestSerial.current + 1;
    requestSerial.current = serial;
    deadlineSettledSerial.current = null;
    submittedDraftRef.current = question;
    const replaceOperationalTurn = shouldReplaceOperationalTurn(
      active,
      question
    );
    const controller = new AbortController();
    requestAbort.current.add(controller);
    clearRequestDeadline(requestDeadline);
    const deadline = setTimeout(() => {
      if (requestDeadline.current === deadline) {
        requestDeadline.current = null;
      }
      if (!requestStillCurrent(serial)) {
        return;
      }
      // Abort carries TimeoutError so a late settlement stays on the abort
      // path. User-initiated aborts use the default AbortError and do not
      // settle here, because they already moved the serial.
      const timeoutError = new DOMException(
        "The assistant did not answer before the request timed out.",
        "TimeoutError"
      );
      deadlineSettledSerial.current = serial;
      controller.abort(timeoutError);
      setRetryQuestion(question);
      setFailure(clientFailure(timeoutError));
      trackAskAnswered(askSurface, "timeout");
      focusQuestionOnSettle.current = true;
      setPendingStatusVisible(false);
      setPending(false);
    }, ASK_ATLAS_CLIENT_DEADLINE_MS);
    requestDeadline.current = deadline;
    clearOwnedTimer(pendingStatusTimer);
    const statusTimer = setTimeout(() => {
      if (pendingStatusTimer.current === statusTimer) {
        pendingStatusTimer.current = null;
      }
      if (requestStillCurrent(serial)) {
        setPendingStatusVisible(true);
      }
    }, ASK_ATLAS_PENDING_STATUS_DELAY_MS);
    pendingStatusTimer.current = statusTimer;
    setPending(true);
    setFailure(null);
    trackAskSubmitted(askSurface);
    try {
      const selectedMode = sourceModeSelection
        ? sourceModeRef.current
        : "Literature";
      const result = await postAskAtlas({
        context:
          selectedMode === "Literature"
            ? undefined
            : structuredContextRef.current,
        history: conversationHistory(
          replaceOperationalTurn && active
            ? { ...active, turns: active.turns.slice(0, -2) }
            : active
        ),
        mode: selectedMode,
        question,
        signal: controller.signal,
      });
      if (!requestStillCurrent(serial) || controller.signal.aborted) {
        return;
      }
      if (result.kind === "literature") {
        trackAskAnswered(
          askSurface,
          askOutcomeForLiteratureStatus(result.response.status)
        );
        settleAcceptedResponse(
          question,
          result.response,
          replaceOperationalTurn
        );
        return;
      }
      trackAskAnswered(askSurface, askOutcomeForGovernedTurn(result));
      settleGovernedResponse(question, result, replaceOperationalTurn);
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
          // Legacy 502/503 responses can still carry the same typed body.
          trackAskAnswered(
            askSurface,
            askOutcomeForLiteratureStatus(accepted.response.status)
          );
          settleAcceptedResponse(
            question,
            accepted.response,
            replaceOperationalTurn
          );
          return;
        }
        if (accepted.reason !== "not_chat_response") {
          const contractError = new AskAtlasAnswerContractError(
            accepted.reason
          );
          setRetryQuestion(question);
          setFailure(clientFailure(contractError));
          trackAskAnswered(askSurface, "failed");
          return;
        }
      }
      const nextFailure = clientFailure(error);
      trackAskAnswered(askSurface, askOutcomeForFailure(nextFailure.state));
      setRetryQuestion(nextFailure.retry ? question : "");
      setFailure(nextFailure);
    } finally {
      if (requestDeadline.current === deadline) {
        clearRequestDeadline(requestDeadline);
      }
      if (pendingStatusTimer.current === statusTimer) {
        clearOwnedTimer(pendingStatusTimer);
      }
      requestAbort.current.delete(controller);
      if (requestStillCurrent(serial)) {
        if (deadlineSettledSerial.current !== serial) {
          focusQuestionOnSettle.current = true;
        }
        setPendingStatusVisible(false);
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
    abandonOwnedRequest(
      requestSerial,
      requestAbort,
      requestDeadline,
      pendingStatusTimer
    );
    setPendingStatusVisible(false);
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
      abandonOwnedRequest(
        requestSerial,
        requestAbort,
        requestDeadline,
        pendingStatusTimer
      );
      setPendingStatusVisible(false);
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
    composerHasUnsentText: () =>
      message.trim().length > 0 && message.trim() !== submittedDraftRef.current,
    missingConversationId,
    mobileHistoryOpen,
    mobileHistoryToggleRef,
    mode,
    pending,
    pendingStatusVisible,
    requestsEnabled,
    retryQuestion,
    selectConversation,
    setMessage,
    setMobileHistoryOpen,
    setSourceMode,
    showEmptyState,
    sourceMode: sourceModeSelection ? sourceMode : "Literature",
    sourceModeSelection,
    sourceModes: ASK_ATLAS_SOURCE_MODES,
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
  requestAbort: { current: Set<AbortController> },
  requestDeadline: { current: ReturnType<typeof setTimeout> | null },
  pendingStatusTimer: { current: ReturnType<typeof setTimeout> | null }
): void {
  requestSerial.current += 1;
  for (const controller of requestAbort.current) {
    controller.abort();
  }
  requestAbort.current.clear();
  clearRequestDeadline(requestDeadline);
  clearOwnedTimer(pendingStatusTimer);
}

function clearRequestDeadline(requestDeadline: {
  current: ReturnType<typeof setTimeout> | null;
}): void {
  clearOwnedTimer(requestDeadline);
}

function clearOwnedTimer(timer: {
  current: ReturnType<typeof setTimeout> | null;
}): void {
  if (timer.current === null) {
    return;
  }
  clearTimeout(timer.current);
  timer.current = null;
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
