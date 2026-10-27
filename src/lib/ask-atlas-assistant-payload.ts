import { z } from "zod";

import type {
  MixedAssistantResponse,
  StructuredAssistantResponse,
} from "@/generated/models";
import { MixedAssistantResponse as MixedAssistantResponseSchema } from "@/generated/zod/mixedAssistantResponse.zod";
import { StructuredAssistantResponse as StructuredAssistantResponseSchema } from "@/generated/zod/structuredAssistantResponse.zod";

export type AskAtlasGovernedTurn =
  | {
      kind: "structured";
      requestId: string | null;
      response: StructuredAssistantResponse;
    }
  | {
      kind: "mixed";
      requestId: string | null;
      response: MixedAssistantResponse;
    };

const storedGovernedTurnSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("structured"),
      requestId: z.string().nullable(),
      response: z.unknown(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("mixed"),
      requestId: z.string().nullable(),
      response: z.unknown(),
    })
    .strict(),
]);

export function parseStructuredAssistantResponse(
  value: unknown
): StructuredAssistantResponse | null {
  const parsed = StructuredAssistantResponseSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return parsed.data as StructuredAssistantResponse;
}

export function parseMixedAssistantResponse(
  value: unknown
): MixedAssistantResponse | null {
  const parsed = MixedAssistantResponseSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return parsed.data as MixedAssistantResponse;
}

export function parseStoredGovernedTurn(
  value: unknown
): AskAtlasGovernedTurn | null {
  const stored = storedGovernedTurnSchema.safeParse(value);
  if (!stored.success) {
    return null;
  }
  if (stored.data.kind === "structured") {
    const response = parseStructuredAssistantResponse(stored.data.response);
    if (!response) {
      return null;
    }
    return {
      kind: "structured",
      requestId: stored.data.requestId,
      response,
    };
  }
  const response = parseMixedAssistantResponse(stored.data.response);
  if (!response) {
    return null;
  }
  return {
    kind: "mixed",
    requestId: stored.data.requestId,
    response,
  };
}
