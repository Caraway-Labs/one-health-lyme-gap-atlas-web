import type { KnowledgeChatResponse } from "@/generated/models";
import type { AskAtlasGovernedTurn } from "@/lib/ask-atlas-assistant-payload";
import type { AskOutcome, AskSurface } from "@/lib/atlas-analytics";

/** Drawer chat and the /askatlas workspace are the only two assistant surfaces. */
export function askSurfaceForLayout(mode: "drawer" | "workspace"): AskSurface {
  return mode === "workspace" ? "ask_atlas" : "evidence_chat";
}

export function askOutcomeForLiteratureStatus(
  status: KnowledgeChatResponse["status"]
): AskOutcome {
  switch (status) {
    case "answered": {
      return "answered";
    }
    case "no_evidence": {
      return "no_evidence";
    }
    case "safety_refusal": {
      return "refused";
    }
    default: {
      return "unavailable";
    }
  }
}

export function askOutcomeForGovernedTurn(
  turn: AskAtlasGovernedTurn
): AskOutcome {
  const outcome =
    turn.kind === "structured"
      ? turn.response.answer.outcome
      : turn.response.outcome;
  switch (outcome) {
    case "ANSWERED": {
      return "answered";
    }
    case "SAFETY_REFUSAL": {
      return "refused";
    }
    case "SOURCE_UNAVAILABLE": {
      return "unavailable";
    }
    default: {
      return "no_evidence";
    }
  }
}

export function askOutcomeForFailure(state: string): AskOutcome {
  if (state === "timeout") return "timeout";
  if (state === "rate_limited") return "rate_limited";
  return "failed";
}
