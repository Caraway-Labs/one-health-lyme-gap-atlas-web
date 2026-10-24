import type { KnowledgeChatResponse } from "@/generated/models";

import { limitedFewerClaimsResponse } from "./ask-atlas-outcome-matrix";

export {
  limitedFewerClaimsResponse as reducedClaimResponse,
  REDUCED_CLAIM_ANSWER,
} from "./ask-atlas-outcome-matrix";

/** A citation whose claim is not in the returned claims. */
export function orphanCitationResponse(): KnowledgeChatResponse {
  const response = limitedFewerClaimsResponse();
  return {
    ...response,
    citations: [
      ...(response.citations ?? []),
      {
        citation_id: "cit-orphan",
        claim_ids: ["claim-not-returned"],
        passage_ids: ["passage-not-returned"],
        pmid: "38000002",
        pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/38000002/",
        title: "Synthetic paper with no matching claim",
      },
    ],
  };
}
