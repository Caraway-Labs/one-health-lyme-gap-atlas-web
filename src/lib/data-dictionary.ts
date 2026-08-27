export const DATA_DICTIONARY = [
  { term: "Follow-up priority score", definition: "A transparent, county-level prompt for surveillance follow-up. It is not a diagnosis, disease-risk estimate, or measure of individual safety." },
  { term: "Published human surveillance signal", definition: "The county-level human record available in the governed release. A lower or unavailable record is not the same as zero cases." },
  { term: "Tick and pathogen evidence", definition: "Published records about tick establishment and Borrelia burgdorferi that provide ecological context for a county review." },
  { term: "Community context", definition: "Social vulnerability, insurance access, and rurality indicators that can affect how surveillance data is observed and used." },
  { term: "County-linked record", definition: "A published record that can be associated with a specific county. Records reported only at another geography are not treated as county records." },
  { term: "FIPS", definition: "The five-digit Federal Information Processing Standard code used to identify a county or county-equivalent." },
  { term: "RUCC", definition: "The 2023 Rural-Urban Continuum Code. A value of 1 is most metropolitan and 9 is most rural." },
] as const;
