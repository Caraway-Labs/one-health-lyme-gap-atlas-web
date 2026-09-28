import {
  UX_LAB_PATH,
  UX_LAB_SAMPLE_NOTICE,
} from "@/features/ux-lab/prototype-contract";

/**
 * Disposable copy for the One Atlas / Three Lanes prototype.
 * Lanes are peer destinations. Sample text only: no clinical direction,
 * scores, classifications, or local-risk claims.
 */

export const THREE_LANES_PATH = `${UX_LAB_PATH}/three-lanes` as const;

export const THREE_LANES_LEARN_NOTICE =
  "Sample labels for prototype layout only. This is not personal advice and it is not a statement about your local area.";

export const THREE_LANE_IDS = ["learn", "clinical", "intelligence"] as const;

export type ThreeLaneId = (typeof THREE_LANE_IDS)[number];

export type ThreeLaneDefinition = {
  id: ThreeLaneId;
  kicker: string;
  navLabel: string;
  summary: string;
};

export const THREE_LANES: Record<ThreeLaneId, ThreeLaneDefinition> = {
  clinical: {
    id: "clinical",
    kicker: "Resource discovery",
    navLabel: "Clinical Resources",
    summary:
      "A catalog of professional materials. Every listing carries a sample source label and a sample freshness label.",
  },
  intelligence: {
    id: "intelligence",
    kicker: "Professional workspace",
    navLabel: "Public Health & Intelligence",
    summary:
      "A denser evidence desk for public-health work, with a reference to the live investigation workspace.",
  },
  learn: {
    id: "learn",
    kicker: "Plain language",
    navLabel: "Learn",
    summary:
      "Everyday reading about ticks, Lyme disease, prevention topic headings, and a fictional local page.",
  },
};

export type ThreeLaneCrossLink = {
  href: string;
  label: string;
  lane: ThreeLaneId;
};

export type LearnSection = {
  body: string;
  heading: string;
};

export type LearnTopic = {
  id: string;
  kind: "learn";
  lede: string;
  related: readonly ThreeLaneCrossLink[];
  sections: readonly LearnSection[];
  shared: boolean;
  title: string;
};

export type ClinicalResource = {
  boundary: string;
  freshness: string;
  id: string;
  kind: "clinical";
  related: readonly ThreeLaneCrossLink[];
  shared: boolean;
  source: string;
  summary: string;
  title: string;
};

export type IntelligenceRow = {
  label: string;
  note: string;
};

export type IntelligenceEntry = {
  id: string;
  kind: "intelligence";
  related: readonly ThreeLaneCrossLink[];
  rows: readonly IntelligenceRow[];
  shared: boolean;
  summary: string;
  title: string;
};

export type ThreeLaneItem = ClinicalResource | IntelligenceEntry | LearnTopic;

export function threeLanePath(lane: ThreeLaneId): string {
  return `${THREE_LANES_PATH}/${lane}`;
}

export function threeLaneItemPath(lane: ThreeLaneId, itemId: string): string {
  return `${THREE_LANES_PATH}/${lane}/${itemId}`;
}

export function threeLaneById(value: string): ThreeLaneDefinition | undefined {
  if (!isThreeLaneId(value)) {
    return undefined;
  }
  return THREE_LANES[value];
}

export function threeLaneItems(lane: ThreeLaneId): readonly ThreeLaneItem[] {
  switch (lane) {
    case "clinical": {
      return CLINICAL_RESOURCES;
    }
    case "intelligence": {
      return INTELLIGENCE_ENTRIES;
    }
    case "learn": {
      return LEARN_TOPICS;
    }
    default: {
      const exhaustive: never = lane;
      return exhaustive;
    }
  }
}

export function threeLaneItem(
  lane: string,
  itemId: string
): ThreeLaneItem | undefined {
  const definition = threeLaneById(lane);
  if (!definition) {
    return undefined;
  }
  return threeLaneItems(definition.id).find((item) => item.id === itemId);
}

export function otherThreeLaneItems(
  lane: ThreeLaneId,
  itemId: string
): readonly ThreeLaneItem[] {
  return threeLaneItems(lane).filter((item) => item.id !== itemId);
}

export function threeLanesSampleNotice(lane: ThreeLaneId): string {
  if (lane === "learn") {
    return THREE_LANES_LEARN_NOTICE;
  }
  return UX_LAB_SAMPLE_NOTICE;
}

function relatedLink(
  lane: ThreeLaneId,
  itemId: string,
  label: string
): ThreeLaneCrossLink {
  return {
    href: threeLaneItemPath(lane, itemId),
    label,
    lane,
  };
}

const TICK_AWARENESS_SECTIONS: readonly LearnSection[] = [
  {
    body: "This sample page explains ticks and Lyme disease in everyday language for a general reader. It shows an education layout inside Atlas.",
    heading: "What this page is for",
  },
  {
    body: "Some ticks can carry germs. Lyme disease is an illness associated with certain ticks. This prototype names the topic so a public reader can see where that explanation would live.",
    heading: "Ticks and Lyme disease",
  },
  {
    body: "The same topic has a handout listing in Clinical Resources and a shared-materials row in Public Health & Intelligence. The words stay plain on this page.",
    heading: "Shared Atlas topic",
  },
];

export const LEARN_TOPICS: readonly LearnTopic[] = [
  {
    id: "tick-awareness",
    kind: "learn",
    lede: "A short reading page about ticks and Lyme disease for a general audience.",
    related: [
      relatedLink(
        "clinical",
        "tick-awareness-handout",
        "Tick awareness handout"
      ),
      relatedLink("intelligence", "shared-outreach", "Shared outreach"),
    ],
    sections: TICK_AWARENESS_SECTIONS,
    shared: true,
    title: "Tick awareness",
  },
  {
    id: "prevention-topics",
    kind: "learn",
    lede: "Sample headings for prevention content. The headings reserve space; they are a layout, and they stop there.",
    related: [
      relatedLink("clinical", "clinician-index", "Clinician resource index"),
    ],
    sections: [
      {
        body: "After time outdoors is a sample heading. The prototype reserves the heading and does not fill it with personal prevention steps.",
        heading: "After time outdoors",
      },
      {
        body: "Checking for ticks is a sample heading for a future plain-language section.",
        heading: "Checking for ticks",
      },
      {
        body: "Around home and pets is a sample heading. It shows how a public page could group topics.",
        heading: "Around home and pets",
      },
    ],
    shared: false,
    title: "Prevention topics",
  },
  {
    id: "sample-place",
    kind: "learn",
    lede: "Sample County is a fictional place used to show a local-information layout.",
    related: [
      relatedLink("intelligence", "evidence-summary", "Evidence summary"),
    ],
    sections: [
      {
        body: "Sample County is not a real county. The name stands in for a place-shaped page during product research.",
        heading: "A fictional place",
      },
      {
        body: "A local page could name the place, link to education topics, and point readers toward official public updates. This layout includes no numeric rating and no comparison with other places.",
        heading: "What a local page could hold",
      },
    ],
    shared: false,
    title: "Sample place",
  },
];

const CLINICAL_PATIENT_BOUNDARY =
  "This listing shows where a professional resource could be discovered. It is not instructions for a specific patient.";

export const CLINICAL_RESOURCES: readonly ClinicalResource[] = [
  {
    boundary: CLINICAL_PATIENT_BOUNDARY,
    freshness:
      "Sample freshness label: layout marked March 2026. Static prototype copy.",
    id: "tick-awareness-handout",
    kind: "clinical",
    related: [
      relatedLink("learn", "tick-awareness", "Tick awareness"),
      relatedLink("intelligence", "shared-outreach", "Shared outreach"),
    ],
    shared: true,
    source: "Sample source label: public-education publisher",
    summary:
      "Sample listing for a public-education handout. The same topic is written in plain language in Learn.",
    title: "Tick awareness handout",
  },
  {
    boundary: CLINICAL_PATIENT_BOUNDARY,
    freshness:
      "Sample freshness label: static prototype copy, with no publisher feed.",
    id: "clinician-index",
    kind: "clinical",
    related: [
      relatedLink("intelligence", "evidence-summary", "Evidence summary"),
      relatedLink("learn", "prevention-topics", "Prevention topics"),
    ],
    shared: false,
    source: "Sample source label: professional resource desk",
    summary:
      "Sample index of professional materials. Cards are placeholders for discovery.",
    title: "Clinician resource index",
  },
  {
    boundary: CLINICAL_PATIENT_BOUNDARY,
    freshness: "Sample freshness label: static prototype copy.",
    id: "reporting-links",
    kind: "clinical",
    related: [
      relatedLink("intelligence", "action-center", "Action Center reference"),
    ],
    shared: false,
    source: "Sample source label: reporting resource list",
    summary:
      "Sample labels for where reporting resources could be listed. No reporting workflow is connected.",
    title: "Reporting resource links",
  },
];

export const INTELLIGENCE_ENTRIES: readonly IntelligenceEntry[] = [
  {
    id: "evidence-summary",
    kind: "intelligence",
    related: [
      relatedLink("clinical", "clinician-index", "Clinician resource index"),
      relatedLink("learn", "sample-place", "Sample place"),
    ],
    rows: [
      {
        label: "Question framed",
        note: "Sample slot for the question a public-health reviewer is holding.",
      },
      {
        label: "Sources named",
        note: "Sample slot for citing the materials under review.",
      },
      {
        label: "Held back",
        note: "Scores, classifications, and local-risk statements stay out of this prototype.",
      },
    ],
    shared: false,
    summary:
      "Sample description of an evidence-review summary. No scores or classifications are included.",
    title: "Evidence summary",
  },
  {
    id: "action-center",
    kind: "intelligence",
    related: [
      relatedLink("clinical", "reporting-links", "Reporting resource links"),
    ],
    rows: [
      {
        label: "Workspace",
        note: "Action Center is the live investigation workspace. This page only points to it.",
      },
      {
        label: "Prototype boundary",
        note: "The live workspace is unchanged. This lane does not copy its tools.",
      },
    ],
    shared: false,
    summary: "Sample reference to the professional investigation workspace.",
    title: "Action Center reference",
  },
  {
    id: "shared-outreach",
    kind: "intelligence",
    related: [
      relatedLink("learn", "tick-awareness", "Tick awareness"),
      relatedLink(
        "clinical",
        "tick-awareness-handout",
        "Tick awareness handout"
      ),
    ],
    rows: [
      {
        label: "Learn presentation",
        note: "Plain-language tick awareness for a general reader.",
      },
      {
        label: "Clinical presentation",
        note: "Handout listing with sample source and freshness labels.",
      },
      {
        label: "Professional reuse",
        note: "Public-health teams can reach both presentations from this row.",
      },
    ],
    shared: true,
    summary:
      "The tick-awareness topic is shared. This row is the professional view of that same material.",
    title: "Shared outreach",
  },
];

export function isThreeLaneId(value: string): value is ThreeLaneId {
  return (THREE_LANE_IDS as readonly string[]).includes(value);
}
