/**
 * Verified Montgomery County, Virginia example (FIPS 51121).
 * Static snapshot. The page does not request these values on each visit.
 *
 * Checked against https://api.onehealthatlas.org/v1/counties/51121
 * on 17 October 2026. Release governed-2026-10-15-january-climate-prod,
 * methodology semantic-2.0.0, loaded 2026-10-15T14:08:33.953000-07:00.
 *
 * case_count_floor_2023: 71
 * incidence_floor_2023: 71.45
 * population: 99373
 * state_unallocated_records_2023: 293
 * scapularis_status: Established
 * pacificus_status: No records
 * burgdorferi_status: Present
 * uninsured_percent: 5.3
 * uninsured_percentile: 0.1893
 * svi_percentile: 0.2873
 * rucc_2023: 3
 *
 * Human rows: CDC x5j9-wybp, year 2023, fips 51121, four Probable frequencies
 * 8, 29, 5, and 29.
 * Population source: CDC/ATSDR SVI, vintage 2022 (2018-2022 ACS).
 * Rate: 71 / 99373 * 100000 = 71.4479788, published as 71.45.
 */

export const FRONT_PORCH_EXAMPLE_RELEASE_ID =
  "governed-2026-10-15-january-climate-prod";

export const FRONT_PORCH_EXAMPLE_METHODOLOGY = "semantic-2.0.0";

export const FRONT_PORCH_EXAMPLE_COUNTY = {
  fips: "51121",
  name: "Montgomery County, Virginia",
} as const;

export const FRONT_PORCH_HUMAN_OBSERVATION = {
  links: [
    {
      href: "https://data.cdc.gov/resource/x5j9-wybp.json",
      label: "CDC Lyme surveillance data",
    },
    {
      href: "/docs/evidence-and-uncertainty",
      label: "How Atlas reads missing and limited values",
    },
  ],
  paragraphs: [
    "This is a cited snapshot of the published release. CDC's 2023 county-linked Lyme surveillance rows for Montgomery County are four probable rows, with frequencies 8, 29, 5, and 29.",
    "Atlas records their sum, 71 probable cases, as a published privacy-protected minimum, not a complete county total, because suppressed rows are omitted.",
    "Publication suppression and infections missed by surveillance are different limitations. The minimum does not estimate infections that surveillance did not capture.",
    "Records are assigned by county of residence. Residence can differ from where exposure occurred.",
    "Virginia has 293 state-unallocated 2023 records. Those records cannot be assigned to Montgomery County, and they are not added to the county count.",
    "The release's calculated minimum rate is 71.45 per 100,000, using the population value of 99,373. This is an Atlas-calculated minimum reported-case rate, not a complete incidence estimate.",
    "Do not compare this single-year finding with years before the 2022 surveillance definition change.",
  ],
} as const;

export const FRONT_PORCH_VECTOR_OBSERVATION = {
  links: [
    {
      href: "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
      label: "CDC tick surveillance data sets",
    },
  ],
  paragraphs: [
    "CDC ArboNET county tick status and tickborne pathogen status for this county are cumulative through December 31, 2025.",
    "Ixodes scapularis is classified Established: the published CDC county classification for this species. Borrelia burgdorferi is classified Present: the published classification that the pathogen was detected. Ixodes pacificus is No records.",
    "No records remains distinct from not detected. It means the published table has no county record for that species.",
    "These are cumulative classifications with no sampling denominator. They do not establish current tick abundance, infection prevalence, or countywide sampling coverage. They do not establish where individual human cases were exposed.",
  ],
} as const;

export const FRONT_PORCH_CONTEXT_OBSERVATION = {
  links: [
    {
      href: "https://www.atsdr.cdc.gov/placeandhealth/svi/data_documentation_download.html",
      label: "CDC/ATSDR Social Vulnerability Index",
    },
    {
      href: "https://ers.usda.gov/data-products/rural-urban-continuum-codes/documentation",
      label: "USDA rural-urban code documentation",
    },
  ],
  paragraphs: [
    "The uninsured percentage is 5.3%. The denominator is the civilian noninstitutionalized population. The source field is EP_UNINSUR in the CDC/ATSDR SVI 2022 product, which uses the 2018\u20132022 American Community Survey.",
    "The overall national SVI percentile rank is 0.2873. The uninsured national percentile rank is 0.1893. A percentile rank compares this county with other counties. It is not a percentage of people.",
    "The 2023 Rural-Urban Continuum Code is 3. USDA describes code 3 as a county in a metro area of fewer than 250,000 people. That population threshold describes the metro area, not the county population.",
    "These contextual measures do not establish actual healthcare utilization, Lyme underdiagnosis, underreporting, or individual disease risk.",
  ],
} as const;

export const FRONT_PORCH_RELEASE_DETAIL = [
  `Example snapshot for ${FRONT_PORCH_EXAMPLE_COUNTY.name}. Technical release id: ${FRONT_PORCH_EXAMPLE_RELEASE_ID}. The scoring explanation for this worked example uses methodology ${FRONT_PORCH_EXAMPLE_METHODOLOGY}. The county record was loaded on 15 October 2026, and these findings were checked on 17 October 2026.`,
  "Virginia has 293 state-unallocated 2023 records. They cannot be assigned to Montgomery County, and they are not part of the county count of 71.",
] as const;
