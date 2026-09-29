/**
 * Sample copy for the people-first public/clinician prototype.
 * No clinical direction, scores, or local-risk claims.
 */

export type PeopleEducationTopic = {
  body: string;
  id: string;
  title: string;
};

export const PEOPLE_EDUCATION_TOPICS: readonly PeopleEducationTopic[] = [
  {
    body: "Sample headings for how ticks are described in plain language. This prototype does not give personal prevention instructions.",
    id: "tick-basics",
    title: "Understanding ticks",
  },
  {
    body: "Sample outline for prevention topic groupings. Labels stand in for governed outreach material, not advice for your situation.",
    id: "prevention-topics",
    title: "Prevention topics",
  },
  {
    body: "Sample description of community-facing materials. No campaign is connected in this research build.",
    id: "trusted-outreach",
    title: "Trusted outreach patterns",
  },
];

export type LivingConcern = {
  body: string;
  heading: string;
};

export const PEOPLE_LIVING_CONCERNS: readonly LivingConcern[] = [
  {
    body: "Sample language for people who already live with Lyme or long-term symptoms. This page does not interpret your symptoms or suggest care steps.",
    heading: "Ongoing symptoms and follow-up questions",
  },
  {
    body: "Sample framing for how Atlas could link to governed FAQs and partner resources. Nothing here replaces a conversation with a clinician.",
    heading: "Finding credible next reads",
  },
  {
    body: "Sample note that surveillance maps and personal medical decisions are different questions. Local context on this prototype is fictional.",
    heading: "Separating community patterns from your care plan",
  },
];

export type PeopleLocalPlace = {
  id: string;
  kind: string;
  name: string;
  region: string;
  summary: string;
};

export const PEOPLE_SAMPLE_PLACE: PeopleLocalPlace = {
  id: "sample-county",
  kind: "Fictional county",
  name: "Sample County",
  region: "Sample State",
  summary:
    "Sample County is a fictional stand-in for place-shaped public context. It is not a real county finding and does not describe risk where you live.",
};

export type PeopleClinicianResource = {
  applicability: string;
  boundary: string;
  freshness: string;
  id: string;
  source: string;
  summary: string;
  title: string;
};

export const PEOPLE_CLINICIAN_RESOURCES: readonly PeopleClinicianResource[] = [
  {
    applicability:
      "Sample applicability label: intended for outpatient clinicians reviewing placeholder patient-education handouts.",
    boundary:
      "Listing only. These materials are sample cards for layout. They are not instructions for a specific patient and they are not surveillance results.",
    freshness:
      "Sample freshness: placeholder catalog reviewed for layout in 2026-Q1.",
    id: "patient-handouts",
    source: "Sample source: governed outreach stub (prototype only).",
    summary:
      "Sample card for where patient-facing PDFs could be listed with provenance visible up front.",
    title: "Patient-facing handout shelf",
  },
  {
    applicability:
      "Sample applicability label: for clinicians who need reporting contact placeholders, not live reporting workflow.",
    boundary:
      "Reporting links would appear here with jurisdiction notes. No reporting action is wired in this prototype.",
    freshness:
      "Sample freshness: contact list placeholder; not refreshed from a live directory.",
    id: "reporting-contacts",
    source: "Sample source: fictional public-health directory entry.",
    summary:
      "Sample layout for reporting resource discovery with source and applicability cues on the card.",
    title: "Reporting resource contacts",
  },
];

export function peopleClinicianResourceById(
  id: string
): PeopleClinicianResource | undefined {
  return PEOPLE_CLINICIAN_RESOURCES.find((resource) => resource.id === id);
}
