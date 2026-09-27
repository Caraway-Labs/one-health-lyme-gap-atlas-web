import { afterEach, describe, expect, it, vi } from "vitest";

import AssistantPage from "@/app/assistant/page";
import { ComingSoonPage } from "@/components/coming-soon-page";
import { EvidenceChat } from "@/components/evidence-chat";
import { feedbackRouteIdFromPathname } from "@/lib/feedback-context";

describe("canonical Atlas Assistant route", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("renders the literature workspace and forwards a local conversation selector", async () => {
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "true");
    const page = await AssistantPage({
      searchParams: Promise.resolve({ conversation: "saved-conversation" }),
    });
    expect(page.type).toBe("main");
    expect(page.props.children.type).toBe(EvidenceChat);
    expect(page.props.children.props.initialConversationId).toBe(
      "saved-conversation"
    );
    expect(feedbackRouteIdFromPathname("/assistant")).toBe("assistant");
  });

  it("uses one bounded Coming Soon state when early access is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "false");
    const page = await AssistantPage({ searchParams: Promise.resolve({}) });
    expect(page.type).toBe(ComingSoonPage);
    expect(page.props.title).toBe("Atlas Assistant");
  });
});
