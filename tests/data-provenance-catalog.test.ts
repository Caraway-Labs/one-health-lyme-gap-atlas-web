import { describe, expect, it } from "vitest";

import {
  dataProvenanceHref,
  dataProvenanceSourceAnchor,
  sourceIdFromProvenanceHash,
} from "@/features/ux-reset/data-provenance/links";

describe("data provenance links", () => {
  it("keeps source deep links on the public page", () => {
    expect({
      anchor: dataProvenanceSourceAnchor("human"),
      blank: dataProvenanceHref("  "),
      bulletin: dataProvenanceHref("cdc-mmwr"),
      decoded: sourceIdFromProvenanceHash("#source-cdc%20lyme"),
      emptyHash: sourceIdFromProvenanceHash("#source-"),
      human: dataProvenanceHref("human"),
      missing: sourceIdFromProvenanceHash("#methods"),
      nullId: dataProvenanceHref(null),
    }).toStrictEqual({
      anchor: "source-human",
      blank: "/data-provenance",
      bulletin: "/data-provenance#source-cdc-mmwr",
      decoded: "cdc lyme",
      emptyHash: null,
      human: "/data-provenance#source-human",
      missing: null,
      nullId: "/data-provenance",
    });
  });
});
