import { describe, expect, it } from "vitest";

import type {
  GeographyUnavailable,
  ResourceEnvelopeGeography,
} from "@/generated/models";
import { GeographyV1GeographiesGeographyTypeGeographyIdGetResponse } from "@/generated/zod/atlas";

import {
  INVESTIGATE_GEOGRAPHY_UNPUBLISHED_LIMITATION,
  investigateGeographyUnavailableBody,
} from "./fixtures/investigate-api-fixtures";

const PUBLISHED_LABEL = "Example County";
const COUNTY_FIPS = "01001";
const STATE_FIPS = "01";

const publishedEnvelope: ResourceEnvelopeGeography = {
  data: {
    geography: { geography_id: COUNTY_FIPS, geography_type: "county" },
    label: PUBLISHED_LABEL,
    parent: { geography_id: STATE_FIPS, geography_type: "state" },
  },
};

const unpublishedBody: GeographyUnavailable = {
  availability: "UNAVAILABLE",
  data: null,
  geography: { geography_id: COUNTY_FIPS, geography_type: "county" },
  limitations: [
    "Canonical geography identity is not published yet. This is a publication boundary, not missing county evidence.",
  ],
  reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED",
};

type GeographyIdentityBody = ResourceEnvelopeGeography | GeographyUnavailable;

/**
 * Narrows the identity-route success union. Both checks are required:
 * `availability` distinguishes the unpublished arm, and `data === null`
 * keeps a published envelope from being treated as absent.
 */
function isGeographyUnavailable(
  body: GeographyIdentityBody
): body is GeographyUnavailable {
  return (
    "availability" in body &&
    body.availability === "UNAVAILABLE" &&
    body.data === null
  );
}

/**
 * Classifies a parsed identity body. The unpublished arm keeps the echoed
 * geography id, reason, and limitations, and does not invent a county label.
 */
function presentGeographyIdentity(body: GeographyIdentityBody):
  | {
      geographyId: string;
      kind: "published";
      label: string;
      parentId: string | null;
    }
  | {
      geographyId: string;
      kind: "unpublished";
      limitations: readonly string[];
      reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED";
    } {
  if (isGeographyUnavailable(body)) {
    return {
      geographyId: body.geography.geography_id,
      kind: "unpublished",
      limitations: body.limitations,
      reason: body.reason,
    };
  }
  return {
    geographyId: body.data.geography.geography_id,
    kind: "published",
    label: body.data.label,
    parentId: body.data.parent?.geography_id ?? null,
  };
}

describe("geography identity union", () => {
  it("accepts a GeographyUnavailable body and a published geography envelope", () => {
    const unpublished =
      GeographyV1GeographiesGeographyTypeGeographyIdGetResponse.safeParse(
        unpublishedBody
      );
    const published =
      GeographyV1GeographiesGeographyTypeGeographyIdGetResponse.safeParse(
        publishedEnvelope
      );

    expect({
      published: published.success ? published.data : null,
      unpublished: unpublished.success ? unpublished.data : null,
    }).toStrictEqual({
      published: publishedEnvelope,
      unpublished: unpublishedBody,
    });
  });

  it("presents an unpublished identity as not published yet", () => {
    const unpublished =
      GeographyV1GeographiesGeographyTypeGeographyIdGetResponse.safeParse(
        unpublishedBody
      );
    const published =
      GeographyV1GeographiesGeographyTypeGeographyIdGetResponse.safeParse(
        publishedEnvelope
      );
    if (!unpublished.success || !published.success) {
      throw new Error("Geography identity fixtures were rejected.");
    }

    expect({
      published: presentGeographyIdentity(published.data),
      unpublished: presentGeographyIdentity(unpublished.data),
      unpublishedHasLabel: Object.hasOwn(unpublished.data, "label"),
    }).toStrictEqual({
      published: {
        geographyId: COUNTY_FIPS,
        kind: "published",
        label: PUBLISHED_LABEL,
        parentId: STATE_FIPS,
      },
      unpublished: {
        geographyId: COUNTY_FIPS,
        kind: "unpublished",
        limitations: unpublishedBody.limitations,
        reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED",
      },
      unpublishedHasLabel: false,
    });
  });

  it("accepts the investigate mock's unpublished identity body", () => {
    const body = investigateGeographyUnavailableBody(COUNTY_FIPS);
    const parsed =
      GeographyV1GeographiesGeographyTypeGeographyIdGetResponse.safeParse(body);

    expect({
      data: body.data,
      hasLabel: Object.hasOwn(body, "label"),
      limitations: body.limitations,
      parsed: parsed.success ? parsed.data : null,
      unavailable: parsed.success && isGeographyUnavailable(parsed.data),
    }).toStrictEqual({
      data: null,
      hasLabel: false,
      limitations: [INVESTIGATE_GEOGRAPHY_UNPUBLISHED_LIMITATION],
      parsed: body,
      unavailable: true,
    });
  });

  it("rejects a body that mixes null data with a published geography", () => {
    const missingAvailability =
      GeographyV1GeographiesGeographyTypeGeographyIdGetResponse.safeParse({
        data: null,
      });
    const nullDataWithLabel =
      GeographyV1GeographiesGeographyTypeGeographyIdGetResponse.safeParse({
        data: null,
        geography: { geography_id: COUNTY_FIPS, geography_type: "county" },
        label: PUBLISHED_LABEL,
      });
    const unpublishedWithoutLimitation =
      GeographyV1GeographiesGeographyTypeGeographyIdGetResponse.safeParse({
        ...unpublishedBody,
        limitations: [],
      });

    expect(missingAvailability.success).toBeFalsy();
    expect(nullDataWithLabel.success).toBeFalsy();
    expect(unpublishedWithoutLimitation.success).toBeFalsy();
  });
});
