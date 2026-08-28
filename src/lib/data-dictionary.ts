export const DATA_DICTIONARY = [
  { term: "County Review Priority", definition: "A transparent way to order counties for follow-up review. It is not a diagnosis, disease-risk estimate, or measure of individual safety." },
  { term: "Published Lyme case data", definition: "The county-level Lyme case information available in this release. A low or unavailable count is not the same as zero cases." },
  { term: "Tick and pathogen evidence", definition: "Published records about tick establishment and Borrelia burgdorferi that provide ecological context for a county review." },
  { term: "Potential barriers to diagnosis and reporting", definition: "Social vulnerability, insurance access, and rurality indicators that may affect diagnosis, care, or reporting." },
  { term: "County-linked record", definition: "A published record that can be associated with a specific county. Records reported only at another geography are not treated as county records." },
  { term: "FIPS", definition: "The five-digit Federal Information Processing Standard code used to identify a county or county-equivalent." },
  { term: "RUCC", definition: "The 2023 Rural-Urban Continuum Code. A value of 1 is most metropolitan and 9 is most rural." },
] as const;
