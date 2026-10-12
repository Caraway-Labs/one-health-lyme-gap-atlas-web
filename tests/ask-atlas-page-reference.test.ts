import { describe, expect, it } from "vitest";

import {
  absentInheritedField,
  finalizeInheritedContext,
  validatedInheritedField,
  type AskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/inherited-context";
import {
  askAtlasEntryHref,
  askAtlasPageReferenceWithoutField,
  askAtlasReturnHref,
  pageReferenceFromContext,
  readAskAtlasPageReference,
} from "@/features/ux-reset/ask-atlas/page-reference";

function exploreContext(): AskAtlasInheritedContext {
  const context = finalizeInheritedContext({
    fields: {
      geography: validatedInheritedField("08001", "Adams, Colorado (08001)"),
      measure: validatedInheritedField("reported-cases", "Reported cases"),
      period: validatedInheritedField("2023-01-01", "2023"),
      release: validatedInheritedField("alpha-2026", "alpha-2026"),
      source: validatedInheritedField("reported-cases", "Reported cases"),
    },
    surface: "explore",
  });
  if (!context) {
    throw new Error("Explore context did not validate.");
  }
  return context;
}

function compareContext(): AskAtlasInheritedContext {
  const context = finalizeInheritedContext({
    fields: {
      geography: validatedInheritedField(
        "08001,08013",
        "Adams, Colorado compared with Boulder, Colorado"
      ),
      measure: absentInheritedField(),
      period: validatedInheritedField("2023-01-01", "2023"),
      release: validatedInheritedField("alpha-2026", "alpha-2026"),
      source: absentInheritedField(),
    },
    surface: "compare",
  });
  if (!context) {
    throw new Error("Compare context did not validate.");
  }
  return context;
}

describe("Ask Atlas page reference", () => {
  it("carries an Explorer county into a returnable page reference", () => {
    const source = new URLSearchParams(
      "scope=CO&county=08001&dataset=alpha-2026&period=2023-01-01&metric=reported-cases&map_scope=CO"
    );
    const href = askAtlasEntryHref({
      context: exploreContext(),
      pathname: "/app/explore",
      searchParams: source,
    });
    const entry = new URL(href, "http://localhost");
    const state = readAskAtlasPageReference(entry.pathname, entry.searchParams);
    expect(state.kind).toBe("validated");
    if (state.kind !== "validated") {
      return;
    }
    expect({
      county: entry.searchParams.get("county"),
      dataset: entry.searchParams.get("dataset"),
      periodOnAskUrl: entry.searchParams.get("period"),
      requestFields: entry.searchParams.has("message"),
      returnHref: state.returnHref,
      surface: state.reference.context.surface,
    }).toStrictEqual({
      county: "08001",
      dataset: "alpha-2026",
      periodOnAskUrl: null,
      requestFields: false,
      returnHref:
        "/app/explore?scope=CO&county=08001&dataset=alpha-2026&period=2023-01-01&metric=reported-cases&map_scope=CO",
      surface: "explore",
    });
    expect(state.reference.context.fields.geography).toMatchObject({
      id: "08001",
      label: "Adams, Colorado (08001)",
      state: "validated",
    });
  });

  it("carries a Compare pair without treating it as a comparison request", () => {
    const source = new URLSearchParams(
      "scope=CO&compare=08001,08013&county=08001&dataset=alpha-2026&period=1999-01-01"
    );
    const reference = pageReferenceFromContext(compareContext(), source);
    const href = askAtlasEntryHref({
      context: compareContext(),
      pathname: "/app/compare",
      searchParams: source,
    });
    const entry = new URL(href, "http://localhost");
    const state = readAskAtlasPageReference(entry.pathname, entry.searchParams);
    expect({
      askCompare: entry.searchParams.get("compare"),
      askPeriod: entry.searchParams.get("period"),
      kind: state.kind,
      returnHref: state.kind === "validated" ? state.returnHref : null,
      sourceCompare: reference?.returnTo.compare ?? null,
      sourcePeriod: reference?.returnTo.period ?? null,
    }).toStrictEqual({
      askCompare: null,
      askPeriod: null,
      kind: "validated",
      returnHref:
        "/app/compare?scope=CO&county=08001&compare=08001%2C08013&dataset=alpha-2026&period=2023-01-01",
      sourceCompare: ["08001", "08013"],
      sourcePeriod: "2023-01-01",
    });
  });

  it("does not treat an unverified address as a page reference", () => {
    const href = askAtlasEntryHref({
      context: exploreContext(),
      pathname: "/app/explore",
      searchParams: new URLSearchParams(
        "scope=CO&county=08001&dataset=alpha-2026&map_scope=CO"
      ),
    });
    const entry = new URL(href, "http://localhost");
    entry.searchParams.set("dataset", "other-release");
    expect({
      bare: readAskAtlasPageReference(
        "/app/assistant",
        new URLSearchParams("county=08001&dataset=alpha-2026")
      ).kind,
      invalid: readAskAtlasPageReference(
        "/app/assistant",
        new URLSearchParams("page_ref=not-json&county=08001")
      ).kind,
      mismatched: readAskAtlasPageReference(entry.pathname, entry.searchParams)
        .kind,
    }).toStrictEqual({
      bare: "absent",
      invalid: "unverified",
      mismatched: "unverified",
    });
  });

  it("clears one field and the whole reference without inventing evidence", () => {
    const reference = pageReferenceFromContext(
      exploreContext(),
      new URLSearchParams("scope=CO&county=08001&map_scope=CO")
    );
    if (!reference) {
      throw new Error("reference missing");
    }
    const withoutGeography = askAtlasPageReferenceWithoutField(
      reference,
      "geography"
    );
    expect(withoutGeography?.returnTo.county).toBeNull();
    expect(withoutGeography?.context.fields.geography.state).toBe("absent");
    if (!withoutGeography) {
      throw new Error("geography removal dropped the reference");
    }
    expect(askAtlasReturnHref(withoutGeography)).not.toContain("county=");
    let remaining: typeof reference | null = reference;
    for (const key of [
      "geography",
      "measure",
      "period",
      "release",
      "source",
    ] as const) {
      if (remaining) {
        remaining = askAtlasPageReferenceWithoutField(remaining, key);
      }
    }
    expect(remaining).toBeNull();
  });
});
