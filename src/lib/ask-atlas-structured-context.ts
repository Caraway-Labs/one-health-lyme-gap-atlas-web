import type { AskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/inherited-context";
import type { StructuredContext } from "@/generated/models";
import {
  structuredAssistantRequestContextMeasureIdMax,
  structuredAssistantRequestContextYearMax,
  structuredAssistantRequestContextYearMin,
} from "@/generated/zod/structuredAssistantRequest.zod";
import { isCountyFips } from "@/lib/county-geography";

/**
 * Map validated page context onto `StructuredContext`.
 *
 * Only fields the structured and mixed requests already accept are copied.
 * A period is sent as `year` when the inherited id is itself a four-digit year.
 * A start date is not turned into a year. Release and source stay on the
 * visible inherited-context notice and are not sent as evidence.
 */
export function structuredContextFromInherited(
  context: AskAtlasInheritedContext | null
): StructuredContext | undefined {
  if (!context) {
    return undefined;
  }
  const measure = measureId(context);
  const geographyIds = geographyIdsFrom(context);
  const year = yearFrom(context);
  if (
    measure === undefined &&
    geographyIds === undefined &&
    year === undefined
  ) {
    return undefined;
  }
  return {
    ...(geographyIds
      ? { geography_ids: geographyIds, geography_type: "county" }
      : {}),
    ...(measure ? { measure_id: measure } : {}),
    ...(year === undefined ? {} : { year }),
  };
}

function measureId(context: AskAtlasInheritedContext): string | undefined {
  const field = context.fields.measure;
  if (field.state !== "validated") {
    return undefined;
  }
  const id = field.id.trim();
  if (
    id.length < 1 ||
    id.length > structuredAssistantRequestContextMeasureIdMax
  ) {
    return undefined;
  }
  return id;
}

function geographyIdsFrom(
  context: AskAtlasInheritedContext
): string[] | undefined {
  const field = context.fields.geography;
  if (field.state !== "validated") {
    return undefined;
  }
  if (isCountyFips(field.id)) {
    return [field.id];
  }
  const parts = field.id.split(",");
  if (parts.length === 2 && parts.every((part) => isCountyFips(part))) {
    return parts;
  }
  return undefined;
}

function yearFrom(context: AskAtlasInheritedContext): number | undefined {
  const field = context.fields.period;
  if (field.state !== "validated" || !/^\d{4}$/.test(field.id)) {
    return undefined;
  }
  const year = Number(field.id);
  if (
    year < structuredAssistantRequestContextYearMin ||
    year > structuredAssistantRequestContextYearMax
  ) {
    return undefined;
  }
  return year;
}
