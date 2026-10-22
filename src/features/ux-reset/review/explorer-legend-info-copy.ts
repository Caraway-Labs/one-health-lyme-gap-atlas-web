import {
  GAP_REVIEW_SCORE_MENU_LABEL,
  type ExplorerMapLayerId,
  type ExplorerMapLegendEntry,
  type ExplorerMapPaint,
} from "@/features/ux-reset/review/explorer-map-layers";

/**
 * Approved Explorer legend INFO copy for issue 793.
 * The current evidence-completeness explanation stays until the corrected
 * availability contract ships. Do not show that future explanation here.
 */

export const LEGEND_INFO_HEADING = {
  colors: "What the colors mean",
  county: "Selected county",
  shows: "What this map shows",
  sources: "Data sources and years",
} as const;

const APPROVED_INCIDENCE_YEAR = "2023";
const APPROVED_SVI_YEAR = "2022";

export type ExplorerLegendAboutText =
  | string
  | {
      emphasis: "em" | "strong";
      text: string;
    };

export type ExplorerLegendAboutBlock =
  | {
      kind: "bullets";
      items: readonly {
        lead: string;
        text: readonly ExplorerLegendAboutText[];
      }[];
    }
  | {
      kind: "numbered";
      items: readonly (readonly ExplorerLegendAboutText[])[];
    }
  | {
      kind: "paragraphs";
      paragraphs: readonly (readonly ExplorerLegendAboutText[])[];
    }
  | {
      headers: readonly string[];
      kind: "table";
      rows: readonly (readonly string[])[];
    };

export type ExplorerLegendAboutSection = {
  blocks: readonly ExplorerLegendAboutBlock[];
  heading: string;
};

export const GAP_REVIEW_INFO_ROWS = [
  {
    action: "Continue routine review.",
    category: "Lower review",
    maxExclusive: 20,
    minInclusive: 0,
    score: "0 to <20",
  },
  {
    action: "Monitor the pattern.",
    category: "Elevated",
    maxExclusive: 35,
    minInclusive: 20,
    score: "20 to <35",
  },
  {
    action: "Verify with local information.",
    category: "Elevated",
    maxExclusive: 50,
    minInclusive: 35,
    score: "35 to <50",
  },
  {
    action: "Conduct targeted follow-up.",
    category: "Moderate",
    maxExclusive: 65,
    minInclusive: 50,
    score: "50 to <65",
  },
  {
    action: "Coordinate a local assessment.",
    category: "Moderate",
    maxExclusive: 75,
    minInclusive: 65,
    score: "65 to <75",
  },
  {
    action: "Prioritize targeted follow-up.",
    category: "Highest",
    maxExclusive: null,
    minInclusive: 75,
    score: "75\u2013100",
  },
] as const;

export const GAP_NO_SCORE_INFO = {
  action: "Insufficient data to calculate a score.",
  category: "No score available",
  score: "No score",
} as const;

const RURALITY_INFO_ROWS = [
  ["1", "In a metropolitan area with at least 1 million people"],
  ["2", "In a metropolitan area with 250,000 to fewer than 1 million people"],
  ["3", "In a metropolitan area with fewer than 250,000 people"],
  [
    "4",
    "Outside a metropolitan area; urban population of at least 20,000; adjacent to a metropolitan area",
  ],
  [
    "5",
    "Outside a metropolitan area; urban population of at least 20,000; not adjacent to a metropolitan area",
  ],
  [
    "6",
    "Outside a metropolitan area; urban population of 5,000 to 20,000; adjacent to a metropolitan area",
  ],
  [
    "7",
    "Outside a metropolitan area; urban population of 5,000 to 20,000; not adjacent to a metropolitan area",
  ],
  [
    "8",
    "Urban population of fewer than 5,000; adjacent to a metropolitan area",
  ],
  [
    "9",
    "Urban population of fewer than 5,000; not adjacent to a metropolitan area",
  ],
] as const;

const TICK_STATUS_COPY = {
  established:
    "Records meet the surveillance criteria for an established population.",
  noRecords:
    "The source dataset has no county records. Ticks may still be present.",
  reported:
    "Ticks have been documented, but records do not meet the criteria for an established population.",
} as const;

const PATHOGEN_STATUS_COPY = {
  noRecords:
    "The source dataset has no county detection records. This may reflect limited sampling or reporting.",
  present: "The bacterium has been detected.",
} as const;

const VALUE_STATE_COPY: Readonly<Record<string, string>> = {
  "Missing (not zero and not a low value)": "Data missing",
  "No county-linked record (not zero and not confirmed absence)":
    "No record linked to this county",
  "No published value": "No published value available",
  "No records (not zero and not confirmed absence)": "No records",
  "Suppressed (not zero)": "Value withheld in the published data",
  "Unavailable (not zero)": "Data unavailable",
};

export function gapLegendCopyForMinimum(minimum: number): {
  action: string;
  category: string;
} | null {
  const row = GAP_REVIEW_INFO_ROWS.find(
    (entry) => entry.minInclusive === minimum
  );
  if (!row) {
    return null;
  }
  return { action: row.action, category: row.category };
}

/**
 * Use a year that the source period actually states. A missing year stays
 * omitted so the popup does not show the approved example year as fact.
 */
export function factualSourceYear(
  period: string,
  approvedYear: string
): string | null {
  const vintage = /Vintage\s+(?<year>\d{4})\b/.exec(period);
  if (vintage?.groups?.year) {
    return vintage.groups.year;
  }
  const years = [
    ...new Set(
      [...period.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => match[0])
    ),
  ];
  if (years.length === 0) {
    return null;
  }
  if (years.includes(approvedYear)) {
    return approvedYear;
  }
  if (years.length === 1) {
    return years[0] ?? null;
  }
  return years.at(-1) ?? null;
}

export function plainLegendPeriod(period: string): string {
  const trimmed = period.trim();
  if (trimmed.length === 0) {
    return "";
  }
  return trimmed
    .replaceAll(
      /Release (?<identifier>[^.]+)\./g,
      "Data release: $<identifier>."
    )
    .replaceAll("Source vintage unavailable.", "Data year unavailable.")
    .replaceAll("Source vintage unavailable", "Data year unavailable")
    .replaceAll("vintage unavailable", "data year unavailable");
}

export function quantityColorSentence(
  layerId: ExplorerMapLayerId
): string | null {
  if (layerId === "incidence_floor") {
    return "Darker green means higher reported incidence. Gray indicates unavailable data. A reported zero remains separate from missing data.";
  }
  if (layerId === "svi") {
    return "Higher values and darker orange indicate greater social vulnerability relative to other U.S. counties. The value is a county ranking, not the percentage of residents who are vulnerable. Gray indicates unavailable data.";
  }
  if (layerId === "uninsured") {
    return "Darker burgundy means a higher uninsured percentage. Gray indicates unavailable data; 0% means a reported uninsured percentage of zero.";
  }
  return null;
}

export function approvedSegmentTooltip(
  layerId: ExplorerMapLayerId,
  entry: ExplorerMapLegendEntry
): string | null {
  const label = entry.label.trim();
  const mapped = VALUE_STATE_COPY[label];
  if (mapped) {
    return mapped;
  }
  if (layerId === "tick_status") {
    if (label.startsWith("Reported")) {
      return `Reported. ${TICK_STATUS_COPY.reported}`;
    }
    if (label.startsWith("Established")) {
      return `Established. ${TICK_STATUS_COPY.established}`;
    }
    if (label.startsWith("No records")) {
      return `No records. ${TICK_STATUS_COPY.noRecords}`;
    }
  }
  if (layerId === "pathogen_status") {
    if (label === "Present" || label.startsWith("Present ")) {
      return `Present. ${PATHOGEN_STATUS_COPY.present}`;
    }
    if (label.startsWith("No records")) {
      return `No records. ${PATHOGEN_STATUS_COPY.noRecords}`;
    }
  }
  if (layerId === "rurality") {
    const code = /^(?<code>[1-9])\./.exec(label)?.groups?.code;
    const classification = RURALITY_INFO_ROWS.find(
      (row) => row[0] === code
    )?.[1];
    if (classification) {
      return classification;
    }
    if (label === "No data") {
      return "Gray means a classification is unavailable.";
    }
  }
  if (layerId === "completeness" && entry.role === "class") {
    return `${label}% of the six conditions are met.`;
  }
  return null;
}

function paragraphs(
  ...items: readonly (readonly ExplorerLegendAboutText[])[]
): ExplorerLegendAboutBlock {
  return { kind: "paragraphs", paragraphs: items };
}

function text(value: string): readonly ExplorerLegendAboutText[] {
  return [value];
}

function section(
  heading: string,
  blocks: readonly ExplorerLegendAboutBlock[]
): ExplorerLegendAboutSection {
  return { blocks, heading };
}

function sourceSection(
  paint: ExplorerMapPaint
): ExplorerLegendAboutSection | null {
  const period = plainLegendPeriod(paint.period);
  if (!period) {
    return null;
  }
  return section(LEGEND_INFO_HEADING.sources, [paragraphs(text(period))]);
}

function countySection(
  paint: ExplorerMapPaint
): ExplorerLegendAboutSection | null {
  const selection = paint.selection?.trim();
  if (!selection) {
    return null;
  }
  return section(LEGEND_INFO_HEADING.county, [paragraphs(text(selection))]);
}

function endpointCaption(label: string): string {
  const head = label.split(" (")[0]?.trim();
  return head || label;
}

/**
 * Observed low and high for layers whose legend endpoints come from the
 * counties in view. Fixed color scales (SVI 0–1, uninsured 0–100) must not
 * use this sentence: those endpoints are scale bounds, not published extrema.
 */
function publishedRangeSentence(paint: ExplorerMapPaint): string | null {
  const low = paint.entries.find((entry) => entry.role === "endpoint-low");
  const high = paint.entries.find((entry) => entry.role === "endpoint-high");
  if (!low) {
    return null;
  }
  const unit = paint.unit?.trim();
  const unitSuffix = unit ? ` ${unit}` : "";
  const lowNumber = endpointCaption(low.label);
  if (!high) {
    return `Published value in this view: ${lowNumber}${unitSuffix}.`;
  }
  return `Published values in this view run from ${lowNumber} to ${endpointCaption(high.label)}${unitSuffix}.`;
}

function incidenceSections(
  paint: ExplorerMapPaint
): ExplorerLegendAboutSection[] {
  const year = factualSourceYear(paint.period, APPROVED_INCIDENCE_YEAR);
  const published = year ? `published ${year}` : "published";
  const range = publishedRangeSentence(paint);
  const colorParagraphs = [
    text(
      "Gray indicates unavailable data. A reported zero remains separate from missing data."
    ),
    ...(range ? [text(range)] : []),
  ];
  return [
    section(LEGEND_INFO_HEADING.shows, [
      paragraphs(
        text(
          `Shows the minimum number of reported Lyme disease cases per 100,000 residents in the ${published} county data. Darker green means higher reported incidence.`
        ),
        text(
          "The published values are lower bounds; the reported totals may be higher. Cases are assigned by county of residence, which may differ from where exposure occurred."
        )
      ),
    ]),
    ...optional(sourceSection(paint)),
    section(LEGEND_INFO_HEADING.colors, [paragraphs(...colorParagraphs)]),
    ...optional(countySection(paint)),
  ];
}

function sviSections(paint: ExplorerMapPaint): ExplorerLegendAboutSection[] {
  const year = factualSourceYear(paint.period, APPROVED_SVI_YEAR);
  const indexName = year
    ? `the ${year} CDC/ATSDR Social Vulnerability Index`
    : "the CDC/ATSDR Social Vulnerability Index";
  return [
    section(LEGEND_INFO_HEADING.shows, [
      paragraphs(
        text(
          `Shows each county\u2019s ranking in ${indexName}, which combines social and economic factors that can affect a community\u2019s ability to respond to public-health challenges.`
        )
      ),
    ]),
    ...optional(sourceSection(paint)),
    section(LEGEND_INFO_HEADING.colors, [
      paragraphs(
        text(
          "Values range from 0 to 1. Higher values and darker orange indicate greater social vulnerability relative to other U.S. counties."
        ),
        text(
          "The value is a county ranking, not the percentage of residents who are vulnerable. Gray indicates unavailable data."
        )
      ),
    ]),
    ...optional(countySection(paint)),
  ];
}

function uninsuredSections(
  paint: ExplorerMapPaint
): ExplorerLegendAboutSection[] {
  return [
    section(LEGEND_INFO_HEADING.shows, [
      paragraphs(
        text(
          "Shows the percentage of the civilian, noninstitutionalized population without health insurance. Darker burgundy means a higher uninsured percentage."
        ),
        text(
          "This provides context for potential financial barriers to seeking care. It does not show whether residents can obtain care or whether Lyme disease cases are being missed."
        )
      ),
    ]),
    ...optional(sourceSection(paint)),
    section(LEGEND_INFO_HEADING.colors, [
      paragraphs(
        text(
          "Gray indicates unavailable data; 0% means a reported uninsured percentage of zero."
        )
      ),
    ]),
    ...optional(countySection(paint)),
  ];
}

function tickSections(paint: ExplorerMapPaint): ExplorerLegendAboutSection[] {
  return [
    section(LEGEND_INFO_HEADING.shows, [
      paragraphs(
        text(
          "Shows whether blacklegged ticks have been documented in each county."
        )
      ),
    ]),
    ...optional(sourceSection(paint)),
    section(LEGEND_INFO_HEADING.colors, [
      {
        items: [
          { lead: "Reported", text: text(TICK_STATUS_COPY.reported) },
          { lead: "Established", text: text(TICK_STATUS_COPY.established) },
          { lead: "No records", text: text(TICK_STATUS_COPY.noRecords) },
        ],
        kind: "bullets",
      },
      paragraphs(
        text(
          "These categories describe documented tick status, not tick abundance or the likelihood of a tick bite."
        )
      ),
    ]),
    ...optional(countySection(paint)),
  ];
}

function pathogenSections(
  paint: ExplorerMapPaint
): ExplorerLegendAboutSection[] {
  return [
    section(LEGEND_INFO_HEADING.shows, [
      paragraphs([
        "Shows whether ",
        { emphasis: "em", text: "Borrelia burgdorferi" },
        ", the bacterium that causes Lyme disease, has been documented in ticks from the county.",
      ]),
    ]),
    ...optional(sourceSection(paint)),
    section(LEGEND_INFO_HEADING.colors, [
      {
        items: [
          { lead: "Present", text: text(PATHOGEN_STATUS_COPY.present) },
          { lead: "No records", text: text(PATHOGEN_STATUS_COPY.noRecords) },
        ],
        kind: "bullets",
      },
      paragraphs(
        text(
          "A documented detection does not indicate what proportion of ticks are infected."
        )
      ),
    ]),
    ...optional(countySection(paint)),
  ];
}

function ruralitySections(
  paint: ExplorerMapPaint
): ExplorerLegendAboutSection[] {
  return [
    section(LEGEND_INFO_HEADING.shows, [
      paragraphs(
        text(
          "Shows county classifications based on population size and proximity to metropolitan areas, using USDA Rural\u2013Urban Continuum Codes."
        ),
        text(
          "Lighter purple represents metropolitan categories. Darker purple represents increasingly rural categories. Each color corresponds to a category, rather than an equal step in rurality."
        )
      ),
    ]),
    ...optional(sourceSection(paint)),
    section(LEGEND_INFO_HEADING.colors, [
      {
        headers: ["Code", "County classification"],
        kind: "table",
        rows: RURALITY_INFO_ROWS,
      },
      paragraphs(text("Gray means a classification is unavailable.")),
    ]),
    ...optional(countySection(paint)),
  ];
}

function completenessSections(
  paint: ExplorerMapPaint
): ExplorerLegendAboutSection[] {
  const published = paint.entries
    .filter((entry) => entry.role === "class")
    .map((entry) => entry.label);
  const colorBlocks: ExplorerLegendAboutBlock[] = [];
  if (published.length > 0) {
    colorBlocks.push(
      paragraphs(
        text(`Published percentages in this view: ${published.join(", ")}.`)
      )
    );
  }
  return [
    section(LEGEND_INFO_HEADING.shows, [
      paragraphs(
        text(
          "Shows how many of six conditions are met in the county\u2019s published data:"
        )
      ),
      {
        items: [
          text("A minimum reported Lyme case count is available."),
          text("Blacklegged ticks are classified as Reported or Established."),
          [
            { emphasis: "em", text: "B. burgdorferi" },
            " is classified as Present.",
          ],
          text("Social vulnerability data are available."),
          text("Uninsured population data are available."),
          text("A rural\u2013urban classification is available."),
        ],
        kind: "numbered",
      },
      paragraphs(
        text(
          "Each condition contributes equally. The percentage is the number met divided by six, rounded to a whole number."
        ),
        [
          {
            emphasis: "strong",
            text: "This measure combines data availability with positive tick and pathogen findings.",
          },
          " A lower percentage can therefore reflect missing data, undocumented tick or pathogen presence, or both. A value of 100% does not mean surveillance is comprehensive.",
        ]
      ),
    ]),
    ...optional(sourceSection(paint)),
    ...(colorBlocks.length > 0
      ? [section(LEGEND_INFO_HEADING.colors, colorBlocks)]
      : []),
    ...optional(countySection(paint)),
  ];
}

function gapSections(paint: ExplorerMapPaint): ExplorerLegendAboutSection[] {
  return [
    section(LEGEND_INFO_HEADING.shows, [
      paragraphs(
        text(
          "Helps prioritize counties for closer surveillance review by combining reported Lyme disease, tick and pathogen data, and community characteristics."
        ),
        text(
          "Higher scores indicate higher review priority based on these data. They do not confirm missed cases or measure individual Lyme disease risk."
        ),
        text("Gray means there are insufficient data to calculate a score.")
      ),
    ]),
    ...optional(sourceSection(paint)),
    section(LEGEND_INFO_HEADING.colors, [
      {
        headers: ["Score", "Review category", "Suggested follow-up"],
        kind: "table",
        rows: [
          ...GAP_REVIEW_INFO_ROWS.map(
            (row) => [row.score, row.category, row.action] as const
          ),
          [
            GAP_NO_SCORE_INFO.score,
            GAP_NO_SCORE_INFO.category,
            GAP_NO_SCORE_INFO.action,
          ],
        ],
      },
    ]),
    ...optional(countySection(paint)),
  ];
}

function optional(
  value: ExplorerLegendAboutSection | null
): ExplorerLegendAboutSection[] {
  return value ? [value] : [];
}

function statusSections(paint: ExplorerMapPaint): ExplorerLegendAboutSection[] {
  const note = paint.note.trim();
  return [
    ...(note
      ? [section(LEGEND_INFO_HEADING.shows, [paragraphs(text(note))])]
      : []),
    ...optional(sourceSection(paint)),
  ];
}

/**
 * The what-if legend reuses the gap-score paint with its own title and note.
 * That popup explains the scenario, not the governed gap-score categories.
 */
function overriddenGapSections(
  paint: ExplorerMapPaint
): ExplorerLegendAboutSection[] {
  return [...statusSections(paint), ...optional(countySection(paint))];
}

export function explorerLegendAboutSections(
  paint: ExplorerMapPaint
): readonly ExplorerLegendAboutSection[] {
  if (paint.kind === "loading" || paint.kind === "unavailable") {
    return statusSections(paint);
  }
  switch (paint.layerId) {
    case "completeness": {
      return completenessSections(paint);
    }
    case "gap_score": {
      return paint.title === GAP_REVIEW_SCORE_MENU_LABEL
        ? gapSections(paint)
        : overriddenGapSections(paint);
    }
    case "incidence_floor": {
      return incidenceSections(paint);
    }
    case "pathogen_status": {
      return pathogenSections(paint);
    }
    case "rurality": {
      return ruralitySections(paint);
    }
    case "svi": {
      return sviSections(paint);
    }
    case "tick_status": {
      return tickSections(paint);
    }
    case "uninsured": {
      return uninsuredSections(paint);
    }
    default: {
      const exhaustive: never = paint.layerId;
      return exhaustive;
    }
  }
}

export function explorerLegendAboutPlainText(
  sections: readonly ExplorerLegendAboutSection[]
): string {
  const parts: string[] = [];
  for (const about of sections) {
    parts.push(about.heading);
    for (const block of about.blocks) {
      parts.push(blockPlainText(block));
    }
  }
  return parts.join("\n");
}

function inlinePlainText(parts: readonly ExplorerLegendAboutText[]): string {
  return parts
    .map((part) => (typeof part === "string" ? part : part.text))
    .join("");
}

function blockPlainText(block: ExplorerLegendAboutBlock): string {
  switch (block.kind) {
    case "bullets": {
      return block.items
        .map((item) => `${item.lead}: ${inlinePlainText(item.text)}`)
        .join("\n");
    }
    case "numbered": {
      return block.items.map((item) => inlinePlainText(item)).join("\n");
    }
    case "paragraphs": {
      return block.paragraphs.map((item) => inlinePlainText(item)).join("\n");
    }
    case "table": {
      return block.rows.map((row) => row.join(" | ")).join("\n");
    }
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}
