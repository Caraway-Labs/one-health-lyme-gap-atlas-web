import { beforeEach, describe, expect, it } from "vitest";

import {
  absentInheritedField,
  finalizeInheritedContext,
  validatedInheritedField,
  type AskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/inherited-context";
import {
  askAtlasEntryHref,
  askAtlasPageReferenceHref,
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

function retargetPageReference(
  href: string,
  mutate: (payload: {
    dataset: string | null;
    fields: {
      geography: { id: string; label: string; state: string };
      release: { id: string; label: string; state: string };
      source: { id: string; label: string; state: string };
    };
  }) => void
): URL {
  const entry = new URL(href, "http://localhost");
  const encoded = entry.searchParams.get("page_ref");
  if (!encoded) {
    throw new Error("page reference missing");
  }
  const payload = JSON.parse(encoded) as {
    dataset: string | null;
    fields: {
      geography: { id: string; label: string; state: string };
      release: { id: string; label: string; state: string };
      source: { id: string; label: string; state: string };
    };
  };
  mutate(payload);
  entry.searchParams.set("page_ref", JSON.stringify(payload));
  if (payload.dataset) {
    entry.searchParams.set("dataset", payload.dataset);
  }
  return entry;
}

describe("Ask Atlas page reference", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

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
        "/explore?scope=CO&county=08001&dataset=alpha-2026&period=2023-01-01",
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
      pathname: "/compare",
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
        "/compare?scope=CO&county=08001&compare=08001%2C08013&dataset=alpha-2026&period=2023-01-01",
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
        "/askatlas",
        new URLSearchParams("county=08001&dataset=alpha-2026")
      ).kind,
      invalid: readAskAtlasPageReference(
        "/askatlas",
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

  it("does not validate a label that the source page did not accept", () => {
    const href = askAtlasEntryHref({
      context: exploreContext(),
      pathname: "/app/explore",
      searchParams: new URLSearchParams(
        "scope=CO&county=08001&dataset=alpha-2026"
      ),
    });
    const geography = retargetPageReference(href, (payload) => {
      payload.fields.geography.label = "Boulder, Colorado (08013)";
    });
    const source = retargetPageReference(href, (payload) => {
      payload.fields.source.label = "County surveillance score";
    });
    const geographyState = readAskAtlasPageReference(
      geography.pathname,
      geography.searchParams
    );
    const sourceState = readAskAtlasPageReference(
      source.pathname,
      source.searchParams
    );
    expect({
      geography: geographyState.kind,
      geographyLabel:
        geographyState.kind === "validated"
          ? geographyState.reference.context.fields.geography
          : null,
      source: sourceState.kind,
      sourceLabel:
        sourceState.kind === "validated"
          ? sourceState.reference.context.fields.source
          : null,
    }).toStrictEqual({
      geography: "unverified",
      geographyLabel: null,
      source: "unverified",
      sourceLabel: null,
    });
  });

  it("does not validate a release whose id and label were both replaced", () => {
    const href = askAtlasEntryHref({
      context: exploreContext(),
      pathname: "/app/explore",
      searchParams: new URLSearchParams(
        "scope=CO&county=08001&dataset=alpha-2026"
      ),
    });
    const forged = retargetPageReference(href, (payload) => {
      payload.dataset = "forged-release";
      payload.fields.release = {
        id: "forged-release",
        label: "forged-release",
        state: "validated",
      };
    });
    const state = readAskAtlasPageReference(
      forged.pathname,
      forged.searchParams
    );
    expect({
      kind: state.kind,
      release:
        state.kind === "validated"
          ? state.reference.context.fields.release
          : null,
    }).toStrictEqual({
      kind: "unverified",
      release: null,
    });
  });

  it("keeps a removed field validated against the accepted snapshot", () => {
    const href = askAtlasEntryHref({
      context: exploreContext(),
      pathname: "/app/explore",
      searchParams: new URLSearchParams(
        "scope=CO&county=08001&dataset=alpha-2026"
      ),
    });
    const entry = new URL(href, "http://localhost");
    const accepted = readAskAtlasPageReference(
      entry.pathname,
      entry.searchParams
    );
    if (accepted.kind !== "validated") {
      throw new Error("accepted reference missing");
    }
    const removeHref = accepted.removeHrefs.geography;
    if (!removeHref) {
      throw new Error("geography removal missing");
    }
    const reducedUrl = new URL(removeHref, "http://localhost");
    const reduced = readAskAtlasPageReference(
      reducedUrl.pathname,
      reducedUrl.searchParams
    );
    const release =
      reduced.kind === "validated"
        ? reduced.reference.context.fields.release
        : null;
    expect({
      geography:
        reduced.kind === "validated"
          ? reduced.reference.context.fields.geography.state
          : reduced.kind,
      release: release?.state === "validated" ? release.label : null,
    }).toStrictEqual({
      geography: "absent",
      release: "alpha-2026",
    });
  });

  it("does not validate a reference this browser never accepted", () => {
    const reference = pageReferenceFromContext(
      exploreContext(),
      new URLSearchParams("scope=CO&county=08001&dataset=alpha-2026")
    );
    if (!reference) {
      throw new Error("reference missing");
    }
    const href = askAtlasPageReferenceHref(
      "/askatlas",
      new URLSearchParams("county=08001&dataset=alpha-2026"),
      reference
    );
    const entry = new URL(href, "http://localhost");
    const state = readAskAtlasPageReference(entry.pathname, entry.searchParams);
    expect(state.kind).toBe("unverified");
  });
});
