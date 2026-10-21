/**
 * Source of truth for the public Data Provenance page.
 *
 * Update the version and last-updated date when substantive public-facing copy changes.
 * Filter counts are derived from `datasets` so the catalog can grow without a fixed total.
 */

export const dataProvenanceFilters = [
  { id: "all", label: "All" },
  { id: "human-surveillance", label: "Human surveillance" },
  { id: "ticks-and-pathogens", label: "Ticks and pathogens" },
  { id: "community-context", label: "Community context" },
  { id: "environment", label: "Environment" },
  { id: "geography", label: "Geography" },
  { id: "research-literature", label: "Research literature" },
  { id: "bulletin", label: "Public-health bulletins" },
] as const;

export type DataProvenanceFilterId =
  (typeof dataProvenanceFilters)[number]["id"];

export type DataProvenanceEvidenceType = Exclude<DataProvenanceFilterId, "all">;

export type DataProvenanceDataset = {
  anchorId: string;
  cadence: string;
  coverage: string;
  edition: string;
  evidenceType: DataProvenanceEvidenceType;
  id: string;
  ingest: string;
  keepInMind: string;
  name: string;
  publisher: string;
  sourceLabel: string;
  sourceUrl: string;
  uses: string;
};

/**
 * Public `/v1/sources` dataset ids that this page already explains.
 * A new id in the recorded sources fixture must be added here and as a dataset.
 */
export const dataProvenanceReleaseDatasetIds: Readonly<Record<string, string>> =
  {
    "annual-nlcd-c1v2-2025-reviewed-demo-cohort": "context_nlcd_2025",
    "atsdr-svi-2022-county-layer": "context_svi",
    "cdc-ixodes-county-status-2025": "tick",
    "cdc-ixodes-pathogen-status-2025": "pathogen",
    "rural-urban-continuum-codes-2023": "context_rucc",
    "x5j9-wybp": "human",
  };

function dataset(entry: DataProvenanceDataset): DataProvenanceDataset {
  return entry;
}

export const dataProvenanceContent = {
  version: "1.0.0",
  lastUpdated: "2026-10-21",
  hero: {
    eyebrow: "Data provenance",
    title: "Where Atlas evidence comes from",
    lead: "One Health Atlas brings together public evidence about Lyme disease that normally lives in separate systems: human case surveillance, tick and pathogen surveillance, community context, and environmental conditions. Every dataset comes from an authoritative public publisher, and every value in Atlas keeps its source, edition, and limitations attached.",
    note: "Use this page to see exactly which datasets Atlas uses, how evidence moves from the publisher into Atlas, and how to interpret what you see.",
  },
  glance: {
    title: "At a glance",
    facts: [
      {
        term: "Sources",
        definition:
          "Twenty public sources from seven publishers, including the CDC, the National Institutes of Health, NOAA, USDA, the U.S. Census Bureau, and the World Health Organization.",
      },
      {
        term: "County coverage",
        definition:
          "Each Atlas release covers 3,144 U.S. counties and county equivalents.",
      },
      {
        term: "One release for everyone",
        definition:
          "Atlas Explorer, county profiles, the public API, and the MCP server all read the same versioned release, so everyone sees the same evidence.",
      },
      {
        term: "Public-health bulletins",
        definition:
          "Ten news and bulletin sources from CDC, NIH, and WHO are checked daily for the Atlas Intelligence Feed, and every item links back to its publisher.",
      },
      {
        term: "Traceable values",
        definition:
          "Every value carries its source, edition, time period, and limitations wherever it appears.",
      },
    ],
  },
  stepsIntro: {
    eyebrow: "Our process",
    title: "From publisher to Atlas in five steps",
    description:
      "Evidence follows the same path every time, so any value can be traced back to the publication it came from.",
  },
  steps: [
    {
      title: "Acquire",
      text: "Atlas retrieves each dataset directly from its publisher's official site or service and records the exact edition used, so every value can be traced to a specific publication.",
    },
    {
      title: "Validate",
      text: "Automated quality checks confirm county identifiers, required fields, and value states before anything moves forward. Data that fails a blocking check does not reach a release.",
    },
    {
      title: "Standardize",
      text: "Records are matched to U.S. county codes. Gridded climate and land-cover data are summarized to county boundaries from the U.S. Census Bureau, and the share of each county the source actually covers stays with the result.",
    },
    {
      title: "Release",
      text: "Validated evidence is published together as a single versioned release, so results stay consistent and reproducible across Atlas.",
    },
    {
      title: "Explore",
      text: "Wherever a value appears in Atlas, in the map, county profiles, comparisons, or the API, its source, time period, and limitations are one step away.",
    },
  ],
  catalog: {
    eyebrow: "Our sources",
    title: "Every source Atlas uses",
    description:
      "Filter by evidence type, or browse all twenty. Each card links to the original publisher.",
  },
  filters: dataProvenanceFilters,
  bulletinNote:
    "News and bulletins report what publishers announce. Each item keeps its original source and date, and bulletins are separate from the county evidence release.",
  attribution:
    "Tick and pathogen surveillance data are provided by the CDC ArboNET Tick Module, Division of Vector-Borne Diseases.",
  datasets: [
    dataset({
      anchorId: "source-human",
      cadence: "Annual",
      coverage: "U.S. counties (county of residence)",
      edition: "2023 surveillance year",
      evidenceType: "human-surveillance",
      id: "human",
      ingest: "CDC open data service (data.cdc.gov)",
      keepInMind:
        "Counts reflect where people live, not where they were infected. County figures are minimum values from CDC's privacy-protected publication, not complete incidence estimates.",
      name: "Lyme disease surveillance",
      publisher: "Centers for Disease Control and Prevention (CDC)",
      sourceLabel: "Centers for Disease Control and Prevention (CDC)",
      sourceUrl: "https://data.cdc.gov/d/x5j9-wybp",
      uses: "Reported human Lyme disease cases by county of residence, the foundation for county case counts, incidence, and human surveillance status in Atlas.",
    }),
    dataset({
      anchorId: "source-tick",
      cadence: "Periodic CDC updates; status is cumulative",
      coverage: "Contiguous U.S. counties",
      edition: "Records through December 31, 2025",
      evidenceType: "ticks-and-pathogens",
      id: "tick",
      ingest: "CDC public data file",
      keepInMind:
        '"No records" means no published surveillance record, not that ticks are absent. Status describes presence, not tick abundance.',
      name: "Blacklegged tick county status",
      publisher: "CDC, ArboNET Tick Module, Division of Vector-Borne Diseases",
      sourceLabel:
        "CDC, ArboNET Tick Module, Division of Vector-Borne Diseases",
      sourceUrl:
        "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
      uses: "County classifications for the blacklegged tick (Ixodes scapularis) and western blacklegged tick (Ixodes pacificus) as established, reported, or no records.",
    }),
    dataset({
      anchorId: "source-pathogen",
      cadence: "Periodic CDC updates; status is cumulative",
      coverage: "U.S. counties",
      edition: "Records through December 31, 2025",
      evidenceType: "ticks-and-pathogens",
      id: "pathogen",
      ingest: "CDC public data file",
      keepInMind:
        '"No records" is not evidence the pathogen is absent. Status shows presence, not how common infection is in ticks.',
      name: "Tickborne pathogen county status",
      publisher: "CDC, ArboNET Tick Module, Division of Vector-Borne Diseases",
      sourceLabel:
        "CDC, ArboNET Tick Module, Division of Vector-Borne Diseases",
      sourceUrl:
        "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
      uses: "Whether the Lyme disease bacterium, Borrelia burgdorferi, has been identified in host-seeking blacklegged ticks in each county.",
    }),
    dataset({
      anchorId: "source-context_svi",
      cadence: "New editions published periodically",
      coverage: "U.S. counties",
      edition: "SVI 2022 (American Community Survey 2018–2022)",
      evidenceType: "community-context",
      id: "context_svi",
      ingest: "CDC/ATSDR public map service",
      keepInMind:
        "Community measures describe context. They are not individual risk factors or causes of disease.",
      name: "Social Vulnerability Index",
      publisher:
        "CDC / Agency for Toxic Substances and Disease Registry (ATSDR)",
      sourceLabel:
        "CDC / Agency for Toxic Substances and Disease Registry (ATSDR)",
      sourceUrl:
        "https://www.atsdr.cdc.gov/placeandhealth/svi/data_documentation_download.html",
      uses: "County population, overall social vulnerability, and uninsured rates, plus the county names and boundaries Atlas uses on the map.",
    }),
    dataset({
      anchorId: "source-context_rucc",
      cadence: "Periodic, following the decennial census",
      coverage: "U.S. counties",
      edition: "2023 codes",
      evidenceType: "community-context",
      id: "context_rucc",
      ingest: "USDA ERS public data file",
      keepInMind: "Codes from different editions are not directly comparable.",
      name: "Rural-Urban Continuum Codes",
      publisher:
        "U.S. Department of Agriculture, Economic Research Service (USDA ERS)",
      sourceLabel:
        "U.S. Department of Agriculture, Economic Research Service (USDA ERS)",
      sourceUrl:
        "https://www.ers.usda.gov/data-products/rural-urban-continuum-codes/",
      uses: "A county rurality classification that helps compare counties with similar settlement patterns.",
    }),
    dataset({
      anchorId: "source-noaa_nclimgrid_daily_202501",
      cadence: "NOAA publishes monthly",
      coverage: "Contiguous U.S. counties",
      edition: "January 2025, daily",
      evidenceType: "environment",
      id: "noaa_nclimgrid_daily_202501",
      ingest: "NOAA public gridded data, summarized to county boundaries",
      keepInMind:
        "Weather is descriptive context. Atlas does not use it to predict disease or establish cause.",
      name: "nClimGrid-Daily county weather",
      publisher:
        "National Oceanic and Atmospheric Administration (NOAA), National Centers for Environmental Information",
      sourceLabel:
        "National Oceanic and Atmospheric Administration (NOAA), National Centers for Environmental Information",
      sourceUrl:
        "https://www.ncei.noaa.gov/products/land-based-station/nclimgrid-daily",
      uses: "Daily precipitation and minimum, maximum, and average temperature summarized to each county, giving descriptive weather context.",
    }),
    dataset({
      anchorId: "source-context_nlcd_2025",
      cadence: "Annual",
      coverage:
        "Arlington County, Virginia, and Connecticut's Capitol Planning Region",
      edition: "Annual NLCD 2025",
      evidenceType: "environment",
      id: "context_nlcd_2025",
      ingest: "MRLC official data package, summarized to county boundaries",
      keepInMind:
        "Counties without land-cover values have not been summarized yet. A blank is not zero.",
      name: "Annual National Land Cover Database",
      publisher:
        "Multi-Resolution Land Characteristics (MRLC) Consortium (U.S. Geological Survey and partner agencies)",
      sourceLabel:
        "Multi-Resolution Land Characteristics (MRLC) Consortium (U.S. Geological Survey and partner agencies)",
      sourceUrl: "https://www.mrlc.gov/data/project/annual-nlcd",
      uses: "Seven land-cover measures (forest, developed land, agriculture, wetlands, open water, impervious surface, and land-cover change) for reviewed counties.",
    }),
    dataset({
      anchorId: "source-census_tiger_2025",
      cadence: "Annual",
      coverage: "U.S. counties and county equivalents",
      edition: "2025",
      evidenceType: "geography",
      id: "census_tiger_2025",
      ingest: "Census Bureau public boundary files",
      keepInMind:
        "Boundaries follow the 2025 edition, including Connecticut's planning regions.",
      name: "TIGER/Line county boundaries",
      publisher: "U.S. Census Bureau",
      sourceLabel: "U.S. Census Bureau",
      sourceUrl:
        "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
      uses: "2025 county and county-equivalent boundaries used to summarize gridded weather and land-cover data to counties.",
    }),
    dataset({
      anchorId: "source-pubmed",
      cadence: "Daily",
      coverage: "Biomedical literature",
      edition: "Continuously updated index",
      evidenceType: "research-literature",
      id: "pubmed",
      ingest: "NLM search services, with every paper reviewed before use",
      keepInMind:
        "Literature supports research questions. It is separate from the county evidence release.",
      name: "PubMed",
      publisher:
        "National Library of Medicine (NLM), National Institutes of Health",
      sourceLabel:
        "National Library of Medicine (NLM), National Institutes of Health",
      sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/",
      uses: "Finding peer-reviewed research on Lyme disease, Borrelia, and other tickborne diseases for the Ask Atlas research library.",
    }),
    dataset({
      anchorId: "source-pmc_oa",
      cadence: "Daily",
      coverage: "Openly licensed full-text articles",
      edition: "Continuously updated",
      evidenceType: "research-literature",
      id: "pmc_oa",
      ingest: "NLM open-access services, approved paper by paper",
      keepInMind:
        "Ask Atlas cites the passages it uses so you can go straight to the original article.",
      name: "PubMed Central Open Access Subset",
      publisher:
        "National Library of Medicine (NLM), National Institutes of Health",
      sourceLabel:
        "National Library of Medicine (NLM), National Institutes of Health",
      sourceUrl: "https://pmc.ncbi.nlm.nih.gov/tools/openftlist/",
      uses: "Full text of openly licensed articles, reviewed and broken into cited passages that Ask Atlas uses to ground its answers.",
    }),
    dataset({
      anchorId: "source-cdc-mmwr",
      cadence: "Weekly, with early releases as needed",
      coverage: "National (U.S.)",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "cdc-mmwr",
      ingest: "Publisher RSS feed, checked daily",
      keepInMind:
        "MMWR is CDC's primary channel for timely, authoritative public-health findings.",
      name: "Morbidity and Mortality Weekly Report (MMWR)",
      publisher: "Centers for Disease Control and Prevention (CDC)",
      sourceLabel: "Centers for Disease Control and Prevention (CDC)",
      sourceUrl: "https://tools.cdc.gov/api/v2/resources/media/342778.rss",
      uses: "New CDC surveillance reports, outbreak investigations, and public-health findings for the Atlas Intelligence Feed.",
    }),
    dataset({
      anchorId: "source-cdc-eid-ahead-of-print",
      cadence: "Continuously as articles are accepted",
      coverage: "Global",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "cdc-eid-ahead-of-print",
      ingest: "Publisher RSS feed, checked daily",
      keepInMind:
        "Ahead-of-print articles are final peer-reviewed research released before the monthly issue.",
      name: "Emerging Infectious Diseases — Ahead of Print",
      publisher: "CDC, Emerging Infectious Diseases journal",
      sourceLabel: "CDC, Emerging Infectious Diseases journal",
      sourceUrl: "https://wwwnc.cdc.gov/eid/rss/ahead-of-print.xml",
      uses: "Peer-reviewed infectious-disease research posted ahead of each journal issue, for the Atlas Intelligence Feed.",
    }),
    dataset({
      anchorId: "source-cdc-eid-expedited",
      cadence: "As expedited articles are published",
      coverage: "Global",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "cdc-eid-expedited",
      ingest: "Publisher RSS feed, checked daily",
      keepInMind:
        "Expedited articles cover time-sensitive findings the journal publishes quickly.",
      name: "Emerging Infectious Diseases — Expedited",
      publisher: "CDC, Emerging Infectious Diseases journal",
      sourceLabel: "CDC, Emerging Infectious Diseases journal",
      sourceUrl: "https://wwwnc.cdc.gov/eid/rss/expedited.xml",
      uses: "Fast-tracked research on urgent and emerging infectious-disease topics, for the Atlas Intelligence Feed.",
    }),
    dataset({
      anchorId: "source-cdc-outbreaks",
      cadence: "As outbreaks are announced and updated",
      coverage: "National (U.S.)",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "cdc-outbreaks",
      ingest: "Publisher RSS feed, checked daily",
      keepInMind:
        "Outbreak notices describe CDC investigations; they are separate from Atlas county evidence.",
      name: "CDC Outbreaks",
      publisher: "Centers for Disease Control and Prevention (CDC)",
      sourceLabel: "Centers for Disease Control and Prevention (CDC)",
      sourceUrl: "https://tools.cdc.gov/api/v2/resources/media/281321.rss",
      uses: "CDC outbreak notices and investigation updates, for the Atlas Intelligence Feed.",
    }),
    dataset({
      anchorId: "source-cdc-newsroom",
      cadence: "As released",
      coverage: "National (U.S.)",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "cdc-newsroom",
      ingest: "Publisher RSS feed, checked daily",
      keepInMind:
        "Newsroom items are agency announcements; each links to CDC's full release.",
      name: "CDC Newsroom",
      publisher: "Centers for Disease Control and Prevention (CDC)",
      sourceLabel: "Centers for Disease Control and Prevention (CDC)",
      sourceUrl: "https://tools.cdc.gov/api/v2/resources/media/132608.rss",
      uses: "Official CDC announcements, statements, and media releases, for the Atlas Intelligence Feed.",
    }),
    dataset({
      anchorId: "source-cdc-vital-signs",
      cadence: "Periodic",
      coverage: "National (U.S.)",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "cdc-vital-signs",
      ingest: "Publisher RSS feed, checked daily",
      keepInMind:
        "Vital Signs reports pair key data with recommended public-health actions.",
      name: "CDC Vital Signs",
      publisher: "Centers for Disease Control and Prevention (CDC)",
      sourceLabel: "Centers for Disease Control and Prevention (CDC)",
      sourceUrl: "https://tools.cdc.gov/api/v2/resources/media/275866.rss",
      uses: "CDC's summaries of major public-health issues and the actions that address them, for the Atlas Intelligence Feed.",
    }),
    dataset({
      anchorId: "source-nih-news-releases",
      cadence: "As released",
      coverage: "National (U.S.)",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "nih-news-releases",
      ingest: "Publisher RSS feed, checked daily",
      keepInMind:
        "News releases summarize research; each links to NIH's full announcement.",
      name: "NIH News Releases",
      publisher: "National Institutes of Health (NIH)",
      sourceLabel: "National Institutes of Health (NIH)",
      sourceUrl: "https://www.nih.gov/news-releases/feed.xml",
      uses: "Biomedical research news and announcements from across NIH, for the Atlas Intelligence Feed.",
    }),
    dataset({
      anchorId: "source-niaid-news",
      cadence: "As released",
      coverage: "National (U.S.)",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "niaid-news",
      ingest: "Publisher news page, checked daily",
      keepInMind:
        "NIAID leads NIH research on Lyme disease and other tickborne infections.",
      name: "NIAID News",
      publisher:
        "National Institute of Allergy and Infectious Diseases (NIAID), NIH",
      sourceLabel:
        "National Institute of Allergy and Infectious Diseases (NIAID), NIH",
      sourceUrl: "https://www.niaid.nih.gov/news-events",
      uses: "News on infectious-disease, immunology, and tickborne-disease research from NIAID, for the Atlas Intelligence Feed.",
    }),
    dataset({
      anchorId: "source-who-newsroom",
      cadence: "As released",
      coverage: "Global",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "who-newsroom",
      ingest: "Publisher RSS feed, checked daily",
      keepInMind: "WHO news adds international context to U.S. evidence.",
      name: "WHO Newsroom",
      publisher: "World Health Organization (WHO)",
      sourceLabel: "World Health Organization (WHO)",
      sourceUrl: "https://www.who.int/rss-feeds/news-english.xml",
      uses: "International public-health announcements and news from WHO, for the Atlas Intelligence Feed.",
    }),
    dataset({
      anchorId: "source-who-disease-outbreaks",
      cadence: "As events are reported",
      coverage: "Global",
      edition: "Latest publications",
      evidenceType: "bulletin",
      id: "who-disease-outbreaks",
      ingest: "Publisher news page, checked daily",
      keepInMind:
        "Disease Outbreak News is WHO's official channel for confirmed outbreak notices.",
      name: "WHO Disease Outbreak News",
      publisher: "World Health Organization (WHO)",
      sourceLabel: "World Health Organization (WHO)",
      sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news",
      uses: "Official WHO notices about acute public-health events and outbreaks worldwide, for the Atlas Intelligence Feed.",
    }),
  ] satisfies readonly DataProvenanceDataset[],
  readingIntro: {
    eyebrow: "Interpreting evidence",
    title: "How to read what you see",
  },
  readingCards: [
    {
      title: "A zero is a zero. A blank is not.",
      text: "When a publisher reports zero, Atlas shows zero. Missing, suppressed, or unavailable values are labeled as such and never filled in.",
    },
    {
      title: "No record is not absence.",
      text: 'Tick and pathogen "no records" means nobody has published a record for that county. It does not mean ticks or pathogens are absent.',
    },
    {
      title: "Residence is not exposure.",
      text: "Human cases are reported by where a person lives, which may not be where the infection happened.",
    },
    {
      title: "Context is not cause.",
      text: "Community, weather, and land-cover measures help describe a county. They do not explain or predict disease on their own.",
    },
    {
      title: "Editions answer different questions.",
      text: "Each dataset has its own edition and time period. Atlas shows them side by side and never treats different years as the same moment.",
    },
    {
      title: "Scores point to review, not risk.",
      text: "The Surveillance Gap Score highlights where surveillance evidence may deserve a closer look. It is not a measure of disease risk or a diagnosis.",
    },
  ],
  limitsIntro: {
    title: "Understanding the limits",
    intro: "Atlas is only as complete as the public evidence behind it.",
  },
  limits: [
    "Surveillance data can be delayed, incomplete, or reported differently across states and jurisdictions.",
    "When a publisher withholds a value to protect privacy, Atlas does not reconstruct it.",
    "Atlas does not diagnose illness, estimate individual risk, or forecast outbreaks.",
    "Some context layers cover a limited set of counties today. Each dataset card shows its current coverage.",
  ],
  learnMore: {
    title: "Learn more",
    links: [
      {
        href: "/docs/sources-and-canonical-evidence",
        label: "Sources and canonical evidence",
      },
      {
        href: "/docs/evidence-and-uncertainty",
        label: "Evidence, provenance, and uncertainty",
      },
      {
        href: "/docs/releases-and-methodology",
        label: "Releases and methodology",
      },
      {
        href: "/docs/develop/provenance",
        label: "Provenance fields in the API",
      },
      {
        href: "/ai-ethics",
        label: "AI Ethics",
      },
    ],
  },
  feedback: {
    before:
      "If you have a question about a dataset, or you see something that looks wrong, use ",
    emphasis: "Feedback",
    after: " at the bottom of this page. We review every report.",
  },
} as const;

export function dataProvenanceEvidenceLabel(
  evidenceType: DataProvenanceEvidenceType
): string {
  const filter = dataProvenanceFilters.find((item) => item.id === evidenceType);
  if (!filter) {
    return evidenceType;
  }
  return filter.label;
}

export function dataProvenanceFilterCount(
  filterId: DataProvenanceFilterId,
  datasets: readonly {
    evidenceType: DataProvenanceEvidenceType;
  }[] = dataProvenanceContent.datasets
): number {
  if (filterId === "all") {
    return datasets.length;
  }
  return datasets.filter((item) => item.evidenceType === filterId).length;
}

export function dataProvenanceVisibleCountLabel(
  visible: number,
  total: number = dataProvenanceContent.datasets.length
): string {
  return `Showing ${visible} of ${total} sources`;
}
