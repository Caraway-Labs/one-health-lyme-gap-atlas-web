import type { CountyScoreSummary } from "@/generated/models";

/**
 * Desired Atlas Explorer layers. Selectable layers are only those the scores
 * collection can encode without a new formula. County-detail fields that are
 * not on that collection stay visible and unavailable.
 */
export const EXPLORER_MAP_LAYERS = [
  {
    id: "gap_score",
    label: "Atlas gap score",
    needsScores: true,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "incidence_floor",
    label: "Lyme incidence floor",
    needsScores: false,
    selectable: false,
    unavailableReason:
      "No map collection supplies the published incidence floor for every county. County evidence still shows a county's own floor when that record exists.",
  },
  {
    id: "tick_status",
    label: "Blacklegged tick status",
    needsScores: true,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "pathogen_status",
    label: "B. burgdorferi status",
    needsScores: true,
    selectable: true,
    unavailableReason: null,
  },
  {
    id: "svi",
    label: "Social vulnerability",
    needsScores: false,
    selectable: false,
    unavailableReason:
      "Social vulnerability is on a county record, not on the scores collection used to color the map. This page does not assemble a nationwide layer from county-detail reads.",
  },
  {
    id: "uninsured",
    label: "Uninsured population",
    needsScores: false,
    selectable: false,
    unavailableReason:
      "Uninsured population is on a county record, not on the scores collection used to color the map. This page does not assemble a nationwide layer from county-detail reads.",
  },
  {
    id: "rurality",
    label: "Rurality",
    needsScores: false,
    selectable: false,
    unavailableReason:
      "Rurality is on a county record, not on the scores collection used to color the map. This page does not assemble a nationwide layer from county-detail reads.",
  },
  {
    id: "completeness",
    label: "Evidence completeness",
    needsScores: true,
    selectable: false,
    unavailableReason:
      "The scores collection publishes an evidence-completeness percent, and this map does not invent a color scale for it.",
  },
  {
    id: "boundaries",
    label: "County boundaries",
    needsScores: false,
    selectable: true,
    unavailableReason: null,
  },
] as const;

export type ExplorerMapLayerId = (typeof EXPLORER_MAP_LAYERS)[number]["id"];

export type ExplorerMapLayer = (typeof EXPLORER_MAP_LAYERS)[number];

const BOUNDARY_COLOR = "var(--explorer-boundary)";
const STATUS_COLORS = [
  "var(--map-ramp-2)",
  "var(--map-ramp-3)",
  "var(--map-ramp-4)",
  "var(--map-ramp-5)",
  "var(--map-ramp-6)",
  "var(--teal)",
] as const;

export type ExplorerMapLegendEntry = {
  color: string;
  label: string;
};

export type ExplorerMapPaint = {
  colorsByFips: ReadonlyMap<string, string>;
  entries: readonly ExplorerMapLegendEntry[];
  note: string;
  title: string;
};

export function explorerMapLayerById(
  value: string | null | undefined
): ExplorerMapLayer {
  return (
    EXPLORER_MAP_LAYERS.find((layer) => layer.id === value) ??
    EXPLORER_MAP_LAYERS[0]
  );
}

export function parseExplorerMapLayerId(
  value: string
): ExplorerMapLayerId | null {
  const layer = EXPLORER_MAP_LAYERS.find((entry) => entry.id === value);
  if (!layer?.selectable) {
    return null;
  }
  return layer.id;
}

function neutralStatus(value: string): boolean {
  return /no records|missing|unknown|unavailable|not supplied/i.test(value);
}

function statusLegend(
  counties: readonly CountyScoreSummary[],
  read: (county: CountyScoreSummary) => string
): { colors: Map<string, string>; entries: ExplorerMapLegendEntry[] } {
  const statuses = [
    ...new Set(counties.map((county) => read(county).trim() || "Unavailable")),
  ].toSorted((left, right) => left.localeCompare(right));
  const colors = new Map<string, string>();
  let ramp = 0;
  for (const status of statuses) {
    const color = neutralStatus(status)
      ? BOUNDARY_COLOR
      : STATUS_COLORS[ramp % STATUS_COLORS.length];
    if (!neutralStatus(status)) {
      ramp += 1;
    }
    colors.set(status, color);
  }
  return {
    colors,
    entries: statuses.map((status) => ({
      color: colors.get(status) ?? BOUNDARY_COLOR,
      label: neutralStatus(status) ? `${status} (not zero)` : status,
    })),
  };
}

/**
 * Colors for counties the geometry can draw. Score colors are copied from the
 * scores response. Status colors only distinguish published status strings.
 * A percent without a published color scale is not painted.
 */
export function paintExplorerMapLayer(input: {
  counties: readonly CountyScoreSummary[];
  layerId: ExplorerMapLayerId;
  scoresStatus: "error" | "loading" | "ready";
}): ExplorerMapPaint {
  const layer = explorerMapLayerById(input.layerId);
  if (!layer.selectable || layer.id === "boundaries") {
    return {
      colorsByFips: new Map(),
      entries: [{ color: BOUNDARY_COLOR, label: "County boundary" }],
      note: "County boundaries only. This map is not colored by Atlas gap score.",
      title: "County boundaries",
    };
  }
  if (input.scoresStatus === "loading") {
    return {
      colorsByFips: new Map(),
      entries: [],
      note: `Loading ${layer.label} from the published scores collection.`,
      title: layer.label,
    };
  }
  if (input.scoresStatus === "error" || input.counties.length === 0) {
    return {
      colorsByFips: new Map(),
      entries: [{ color: BOUNDARY_COLOR, label: "County boundary" }],
      note: `${layer.label} could not be loaded from the scores collection. The map shows county boundaries only.`,
      title: "County boundaries",
    };
  }

  if (layer.id === "gap_score") {
    const colorsByFips = new Map<string, string>();
    const entries = new Map<string, string>();
    for (const county of input.counties) {
      const color = county.color.trim();
      if (!color) {
        continue;
      }
      colorsByFips.set(county.fips, color);
      entries.set(county.priority.trim() || "Published score color", color);
    }
    return {
      colorsByFips,
      entries: [...entries.entries()].map(([label, color]) => ({
        color,
        label,
      })),
      note: "Colors are the published score colors. A missing color is not zero. The county list stays the review ranking.",
      title: "Atlas gap score",
    };
  }

  if (layer.id === "tick_status" || layer.id === "pathogen_status") {
    const read =
      layer.id === "tick_status"
        ? (county: CountyScoreSummary) => county.tick_status
        : (county: CountyScoreSummary) => county.burgdorferi_status;
    const legend = statusLegend(input.counties, read);
    const colorsByFips = new Map<string, string>();
    for (const county of input.counties) {
      const status = read(county).trim() || "Unavailable";
      colorsByFips.set(
        county.fips,
        legend.colors.get(status) ?? BOUNDARY_COLOR
      );
    }
    return {
      colorsByFips,
      entries: legend.entries,
      note: "Colors distinguish published status categories. They are not a severity ranking, and no records is not absence.",
      title: layer.label,
    };
  }

  return {
    colorsByFips: new Map(),
    entries: [{ color: BOUNDARY_COLOR, label: "County boundary" }],
    note: `${layer.label} has no published map color scale. The map shows county boundaries only.`,
    title: "County boundaries",
  };
}
