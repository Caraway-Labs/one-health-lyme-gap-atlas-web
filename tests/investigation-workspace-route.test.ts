import { describe, expect, it } from "vitest";

import { investigationWorkspaceHref } from "@/lib/investigation-workspace-route";

describe("Investigation Workspace legacy route", () => {
  it("keeps an empty legacy entry on the canonical path", () => {
    expect(investigationWorkspaceHref({})).toBe("/investigate");
  });

  it("preserves supported analytical query state", () => {
    expect(
      investigationWorkspaceHref({
        breakpoint: "15",
        county: "08001",
        dataset: "alpha-2026-08-06",
        eco: "70",
        evidence: "ecological",
        missing: "80",
        q: "Adams County",
        state: "CO",
      })
    ).toBe(
      "/investigate?breakpoint=15&county=08001&dataset=alpha-2026-08-06&eco=70&evidence=ecological&missing=80&q=Adams+County&state=CO"
    );
  });

  it("keeps repeated values when a legacy request sends them", () => {
    expect(investigationWorkspaceHref({ county: ["08001", "06037"] })).toBe(
      "/investigate?county=08001&county=06037"
    );
  });
});
