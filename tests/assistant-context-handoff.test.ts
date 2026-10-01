import { describe, expect, it } from "vitest";

import {
  assistantContextHandoffSearchParams,
  assistantWorkspaceHref,
  parseAssistantCountyUrlContext,
} from "@/lib/assistant-context-handoff";

function expectHrefQuery(href: string, expected: Record<string, string>) {
  const url = new URL(href, "http://localhost");
  for (const [key, value] of Object.entries(expected)) {
    expect(url.searchParams.get(key)).toBe(value);
  }
}

describe("assistant context handoff", () => {
  it("copies validated county and release from analytical routes", () => {
    const source = new URLSearchParams(
      "county=18097&dataset=alpha-2026-08-06&state=IN&eco=70"
    );
    expectHrefQuery(
      assistantWorkspaceHref("/geographic_explorer", source),
      {
        county: "18097",
        dataset: "alpha-2026-08-06",
      }
    );
    expect(
      assistantContextHandoffSearchParams("/investigate", source).toString()
    ).toBe("county=18097&dataset=alpha-2026-08-06");
  });

  it("preserves county context on the assistant workspace for deep links", () => {
    const source = new URLSearchParams("county=08001&conversation=local-1");
    expectHrefQuery(assistantWorkspaceHref("/assistant", source), {
      county: "08001",
    });
    expectHrefQuery(
      assistantWorkspaceHref("/assistant", source, {
        conversation: "local-1",
      }),
      {
        county: "08001",
        conversation: "local-1",
      }
    );
  });

  it("skips invalid county values instead of inventing a replacement", () => {
    const source = new URLSearchParams("county=not-a-fips&dataset=alpha");
    expect(
      assistantContextHandoffSearchParams("/", source).toString()
    ).toBe("dataset=alpha");
  });

  it("does not hand off analytical state from non-analytical routes", () => {
    const source = new URLSearchParams("county=08001");
    expect(assistantWorkspaceHref("/privacy", source)).toBe("/assistant");
  });

  it("parses assistant county URL context", () => {
    expect(
      parseAssistantCountyUrlContext(new URLSearchParams("county=08001"))
    ).toEqual({
      kind: "valid",
      countyFips: "08001",
      dataset: null,
    });
    expect(
      parseAssistantCountyUrlContext(new URLSearchParams("county=bad"))
    ).toEqual({
      kind: "invalid",
      raw: "bad",
    });
    expect(parseAssistantCountyUrlContext(new URLSearchParams())).toEqual({
      kind: "absent",
    });
  });
});
