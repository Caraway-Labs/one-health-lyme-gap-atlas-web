import {
  UX_LAB_AUDIENCES,
  UX_LAB_PATH,
  UX_LAB_SAMPLE_NOTICE,
  type UxLabAudience,
  type UxLabSampleTopic,
  uxLabSampleTopicsForAudience,
} from "@/features/ux-lab/prototype-contract";

/**
 * Disposable copy for the Persona Gateway prototype.
 * Audience identity is the organizing principle. Sample text only.
 */

export const PERSONA_GATEWAY_PATH = `${UX_LAB_PATH}/persona-gateway` as const;

export const PERSONA_PUBLIC_SAMPLE_NOTICE =
  "Sample labels for prototype layout only. This is not personal advice and it is not a statement about your local area.";

export type PersonaAudienceDefinition = {
  boundary: string;
  boundaryTitle: string;
  cardSummary: string;
  checkPrompt: string;
  id: UxLabAudience;
  includes: readonly string[];
  intro: string;
  kicker: string;
  leavesOut: readonly string[];
  title: string;
};

export const PERSONA_AUDIENCES: Record<
  UxLabAudience,
  PersonaAudienceDefinition
> = {
  clinician: {
    boundary:
      "Listings describe where professional materials could live. They are not instructions for a specific patient, and they are not a care plan.",
    boundaryTitle: "Resources, not patient-specific medical advice",
    cardSummary:
      "Find sample professional resource listings. This path is separate from advice for an individual patient.",
    checkPrompt:
      "If you are looking up professional resources, stay in this lane. Family education and the public-health workspace are different audiences.",
    id: "clinician",
    includes: [
      "Sample cards for professional resource discovery",
      "Sample labels for where reporting resources could be listed",
      "A standing reminder that listings are not individual medical advice",
    ],
    intro:
      "Healthcare professionals land in a resource library. The cards are placeholders for discovery, not a clinical workflow.",
    kicker: "Healthcare professionals",
    leavesOut: [
      "Advice for an individual patient",
      "Family education as the main path",
      "The full public-health investigation workspace",
    ],
    title: "Healthcare Professionals",
  },
  "public-health": {
    boundary:
      "This lane shows sample evidence-summary labels and a reference to the Action Center. The live workspace is unchanged. Nothing here is a score or a classification.",
    boundaryTitle: "The advanced professional Atlas",
    cardSummary:
      "Open the professional Atlas: evidence-review labels and a reference to the investigation workspace.",
    checkPrompt:
      "If you need Atlas for public health work, stay in this lane. Family education and clinician resource lists are different audiences.",
    id: "public-health",
    includes: [
      "Sample evidence-review summaries with no scores",
      "A reference to the Action Center investigation workspace",
      "A direct view of Atlas's advanced professional value",
    ],
    intro:
      "Public health professionals enter the advanced Atlas. This lane is for evidence review and the professional workspace, not for family education.",
    kicker: "Public health professionals",
    leavesOut: [
      "Family education as the default view",
      "Patient-specific medical advice",
      "Any new score, classification, or local-risk claim",
    ],
    title: "Public Health Professionals",
  },
  public: {
    boundary:
      "Pages here use everyday words about ticks, Lyme disease, and local information. Professional review tools stay on the other audience paths.",
    boundaryTitle: "Plain language for you and your family",
    cardSummary:
      "Learn about ticks and Lyme disease in everyday language, and see how local information could be explained.",
    checkPrompt:
      "If you came to learn for yourself or your family, stay in this lane. Professional resources and the advanced Atlas are different audiences.",
    id: "public",
    includes: [
      "Tick awareness written for a general reader",
      "Prevention topic headings labeled as a sample layout",
      "A fictional sample place for local-information layout",
    ],
    intro:
      "You and your family get an education path. It explains ticks and Lyme disease in plain language and shows a sample of local information.",
    kicker: "Public",
    leavesOut: [
      "Professional evidence review",
      "Healthcare resource lists",
      "The investigation workspace",
    ],
    title: "You & Your Family",
  },
};

export function personaAudiencePath(audience: UxLabAudience): string {
  return `${PERSONA_GATEWAY_PATH}/${audience}`;
}

export function personaTopicPath(
  audience: UxLabAudience,
  topicId: string
): string {
  return `${PERSONA_GATEWAY_PATH}/${audience}/${topicId}`;
}

export function personaAudienceById(
  value: string
): PersonaAudienceDefinition | undefined {
  if (!isPersonaAudience(value)) {
    return undefined;
  }
  return PERSONA_AUDIENCES[value];
}

export function personaTopicsForAudience(
  audience: UxLabAudience
): readonly UxLabSampleTopic[] {
  return uxLabSampleTopicsForAudience(audience);
}

export function personaTopicById(
  audience: UxLabAudience,
  topicId: string
): UxLabSampleTopic | undefined {
  return personaTopicsForAudience(audience).find(
    (topic) => topic.id === topicId
  );
}

export function personaSampleNotice(audience: UxLabAudience): string {
  if (audience === "public") {
    return PERSONA_PUBLIC_SAMPLE_NOTICE;
  }
  return UX_LAB_SAMPLE_NOTICE;
}

export function otherPersonaAudiences(
  audience: UxLabAudience
): readonly PersonaAudienceDefinition[] {
  return UX_LAB_AUDIENCES.filter((id) => id !== audience).map(
    (id) => PERSONA_AUDIENCES[id]
  );
}

function isPersonaAudience(value: string): value is UxLabAudience {
  return (UX_LAB_AUDIENCES as readonly string[]).includes(value);
}
