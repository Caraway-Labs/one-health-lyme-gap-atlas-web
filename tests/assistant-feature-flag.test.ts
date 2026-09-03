import { describe, expect, it } from "vitest";

import { isAssistantDemoEnabled } from "@/features/assistant/feature-flag";

describe(isAssistantDemoEnabled, () => {
  it("enables the fixture only when explicitly opted in", () => {
    expect(isAssistantDemoEnabled("true")).toBeTruthy();
    expect(isAssistantDemoEnabled()).toBeFalsy();
    expect(isAssistantDemoEnabled("false")).toBeFalsy();
  });
});
