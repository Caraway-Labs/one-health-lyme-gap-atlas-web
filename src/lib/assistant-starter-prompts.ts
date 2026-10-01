export type AssistantStarterPrompt = {
  id: string;
  /** Short label for the starter control; full question populates the composer. */
  label: string;
  question: string;
};

/**
 * Product-authored literature questions aligned with the governed PubMed / PMC
 * corpus. Wording must not imply Atlas geography/score queries or clinical use.
 */
export const ASSISTANT_STARTER_PROMPTS: readonly AssistantStarterPrompt[] = [
  {
    id: "surveillance_reporting",
    label: "Lyme surveillance reporting in studies",
    question:
      "What do peer-reviewed studies report about Lyme disease surveillance and reporting practices?",
  },
  {
    id: "vectors_hosts",
    label: "Tick vectors and reservoir hosts",
    question:
      "What does reviewed evidence describe about Ixodes tick vectors and reservoir hosts for Lyme disease?",
  },
  {
    id: "environmental_exposure",
    label: "Environmental exposure in literature",
    question:
      "How do studies in the literature describe environmental factors linked to tick exposure?",
  },
  {
    id: "diagnostics_surveillance",
    label: "Diagnostics in surveillance studies",
    question:
      "What diagnostic or laboratory approaches appear in tick-borne disease surveillance literature?",
  },
  {
    id: "prevention_outcomes",
    label: "Prevention outcomes in research",
    question:
      "What prevention or intervention outcomes are reported in peer-reviewed Lyme disease research?",
  },
] as const;
