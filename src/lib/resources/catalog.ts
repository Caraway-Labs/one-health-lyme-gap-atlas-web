/**
 * Public resource catalog for /resources.
 * Presentation imports these records and does not own the destinations.
 * Verification notes stay out of the rendered page.
 */

export const RESOURCES_PATH = "/resources" as const;

const SECTION_HASH = "#";

function anchor(id: string): string {
  return `${SECTION_HASH}${id}`;
}

export const RESOURCE_SECTION_IDS = {
  cdc: "cdc-guidance",
  regional: "regional-centers",
  state: "state-resources",
} as const;

export const RESOURCE_SECTION_HREFS = {
  cdc: anchor(RESOURCE_SECTION_IDS.cdc),
  regional: anchor(RESOURCE_SECTION_IDS.regional),
  state: anchor(RESOURCE_SECTION_IDS.state),
} as const;

export const RESOURCES_PAGE_TITLE = "Resources";
export const RESOURCES_PAGE_SUBTITLE =
  "Guidance, state programs, and regional expertise for tick-borne disease review.";

export type CdcResourceLink = {
  description: string;
  id: string;
  title: string;
  url: string;
};

export type CdcResourceTopic = {
  id: string;
  links: readonly CdcResourceLink[];
  title: string;
};

export const CDC_RESOURCE_TOPICS: readonly CdcResourceTopic[] = [
  {
    id: "surveillance-reporting",
    links: [
      {
        description: "Understand reporting criteria.",
        id: "lyme-case-definition-2022",
        title: "Lyme disease surveillance case definition",
        url: "https://ndc.services.cdc.gov/case-definitions/lyme-disease-2022/",
      },
      {
        description: "Interpret residence-based counts.",
        id: "county-case-data",
        title: "County case data and limitations",
        url: "https://www.cdc.gov/lyme/data-research/facts-stats/surveillance-data-1.html",
      },
      {
        description: "Understand changes across reporting years.",
        id: "surveillance-changes-2022",
        title: "2022 surveillance changes",
        url: "https://www.cdc.gov/mmwr/volumes/73/wr/mm7306a1.htm",
      },
    ],
    title: "Surveillance & reporting",
  },
  {
    id: "tick-pathogen-surveillance",
    links: [
      {
        description: "Review collection and surveillance methods.",
        id: "tick-surveillance-guidance",
        title: "Tick surveillance guidance",
        url: "https://www.cdc.gov/ticks/resources/TickSurveillance_Iscapularis-P.pdf",
      },
      {
        description:
          "Guidance and surveillance information for western states.",
        id: "western-blacklegged-tick-surveillance",
        title: "Western blacklegged tick surveillance",
        url: "https://www.cdc.gov/ticks/data-research/facts-stats/western-blacklegged-tick-surveillance.html",
      },
      {
        description: "Explore published distributions and records.",
        id: "tick-pathogen-data",
        title: "Tick and pathogen data",
        url: "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
      },
    ],
    title: "Tick & pathogen surveillance",
  },
  {
    id: "clinical-laboratory",
    links: [
      {
        description: "Review diagnostic testing information.",
        id: "clinical-testing-guidance",
        title: "Clinical testing guidance",
        url: "https://www.cdc.gov/lyme/diagnosis-testing/",
      },
      {
        description: "Find clinical reference materials.",
        id: "healthcare-professional-resources",
        title: "Resources for healthcare professionals",
        url: "https://www.cdc.gov/lyme/hcp/communication-resources/index.html",
      },
    ],
    title: "Clinical & laboratory resources",
  },
  {
    id: "prevention-education",
    links: [
      {
        description: "Find prevention recommendations.",
        id: "preventing-tick-bites",
        title: "Preventing tick bites",
        url: "https://www.cdc.gov/ticks/prevention/index.html",
      },
      {
        description: "Access resources for public outreach.",
        id: "lyme-educational-materials",
        title: "Educational materials",
        url: "https://www.cdc.gov/lyme/communication-resources/index.html",
      },
      {
        description: "Find materials about ticks and prevention.",
        id: "tick-communication-resources",
        title: "Tick communication resources",
        url: "https://www.cdc.gov/ticks/communication-resources/index.html",
      },
    ],
    title: "Prevention & education",
  },
];

export const SVI_INTERPRETATION_RESOURCE = {
  id: "svi-interpretation",
  title: "CDC/ATSDR Social Vulnerability Index interpretation",
  url: "https://www.atsdr.cdc.gov/place-health/php/svi/svi-frequently-asked-questions-faqs.html",
} as const;

export type StateResource = {
  code: string;
  destinationType: string;
  id: string;
  name: string;
  organization: string;
  url: string;
};

export const STATE_RESOURCES: readonly StateResource[] = [
  {
    code: "AL",
    destinationType: "State resource",
    id: "alabama",
    name: "Alabama",
    organization: "ADPH — Tick-borne Diseases",
    url: "https://www.alabamapublichealth.gov/tick/index.html",
  },
  {
    code: "AK",
    destinationType: "Tick surveillance",
    id: "alaska",
    name: "Alaska",
    organization: "Alaska Submit-A-Tick Program",
    url: "https://dec.alaska.gov/eh/vet/ticks/submit-a-tick",
  },
  {
    code: "AZ",
    destinationType: "State resource",
    id: "arizona",
    name: "Arizona",
    organization: "ADHS — Tick-Borne Diseases",
    url: "https://www.azdhs.gov/preparedness/epidemiology-disease-control/tick-borne/index.php",
  },
  {
    code: "AR",
    destinationType: "State resource and data",
    id: "arkansas",
    name: "Arkansas",
    organization: "Department of Health — Tickborne Disease",
    url: "https://healthy.arkansas.gov/programs-services/diseases-conditions/diseases-from-animals-insects/tickborne-disease/",
  },
  {
    code: "CA",
    destinationType: "State program",
    id: "california",
    name: "California",
    organization: "CDPH — Vector-Borne Disease Section",
    url: "https://www.cdph.ca.gov/Programs/CID/DCDC/Pages/VBDS.aspx",
  },
  {
    code: "CO",
    destinationType: "Tick submission portal",
    id: "colorado",
    name: "Colorado",
    organization: "CDPHE — Citizen Scientist Tick Submission",
    url: "https://cdphe.redcap.state.co.us/surveys/?s=3YA7W4C4DMNLWTPC",
  },
  {
    code: "CT",
    destinationType: "Tick surveillance",
    id: "connecticut",
    name: "Connecticut",
    organization: "CAES — Active Tick Surveillance Program",
    url: "https://portal.ct.gov/caes/tick-office/ats-tick-office/active-tick-surveillance-program/ct-atsp",
  },
  {
    code: "DE",
    destinationType: "Tick surveillance",
    id: "delaware",
    name: "Delaware",
    organization: "DNREC — Tick Program",
    url: "https://dnrec.delaware.gov/fish-wildlife/ticks/",
  },
  {
    code: "FL",
    destinationType: "State disease resource",
    id: "florida",
    name: "Florida",
    organization: "Department of Health — Lyme Disease",
    url: "https://www.floridahealth.gov/diseases-and-conditions/disease/lyme-disease/",
  },
  {
    code: "GA",
    destinationType: "Tick identification and disease resources",
    id: "georgia",
    name: "Georgia",
    organization: "DPH — Tick-borne Diseases and Tick ID Program",
    url: "https://dph.georgia.gov/epidemiology/zvbd/tbd",
  },
  {
    code: "HI",
    destinationType: "Broader state vector program",
    id: "hawaii",
    name: "Hawaii",
    organization: "Department of Health — Vector Control Branch",
    url: "https://health.hawaii.gov/vcb/",
  },
  {
    code: "ID",
    destinationType: "State education resource",
    id: "idaho",
    name: "Idaho",
    organization: "DHW — Mosquito and Tick Disease Prevention",
    url: "https://healthandwelfare.idaho.gov/dhw-voice/avoid-getting-bitten-mosquitoes-and-ticks-can-cause-serious-illness",
  },
  {
    code: "IL",
    destinationType: "University surveillance partner",
    id: "illinois",
    name: "Illinois",
    organization: "Illinois Natural History Survey — Medical Entomology Lab",
    url: "https://medical-entomology.inhs.illinois.edu/",
  },
  {
    code: "IN",
    destinationType: "State program and dashboard",
    id: "indiana",
    name: "Indiana",
    organization: "Department of Health — Vector-Borne and Zoonotic Disease",
    url: "https://secure.in.gov/health/idepd/zoonotic-and-vectorborne-epidemiology-entomology/",
  },
  {
    code: "IA",
    destinationType: "University surveillance and identification",
    id: "iowa",
    name: "Iowa",
    organization: "Iowa State University — Tick Surveillance",
    url: "https://faculty.sites.iastate.edu/smithr/tick-surveillance",
  },
  {
    code: "KS",
    destinationType: "State surveillance program",
    id: "kansas",
    name: "Kansas",
    organization: "KDHE — Vector-Borne & Arboviral Diseases",
    url: "https://www.kdhe.ks.gov/2031/Vector-Borne-Arboviral-Diseases",
  },
  {
    code: "KY",
    destinationType: "State resource",
    id: "kentucky",
    name: "Kentucky",
    organization: "Department for Public Health — Tickborne Diseases",
    url: "https://www.chfs.ky.gov/agencies/dph/dehp/idb/Pages/tick-borne.aspx",
  },
  {
    code: "LA",
    destinationType: "State resource and contact",
    id: "louisiana",
    name: "Louisiana",
    organization: "Department of Health — Tickborne Diseases",
    url: "https://ldh.la.gov/page/tickborne-diseases",
  },
  {
    code: "ME",
    destinationType: "State resource",
    id: "maine",
    name: "Maine",
    organization: "Maine CDC — Ticks",
    url: "https://www3.maine.gov/dhhs/mecdc/diseases-conditions/insect-borne-diseases/ticks",
  },
  {
    code: "MD",
    destinationType: "State resource and data",
    id: "maryland",
    name: "Maryland",
    organization: "Department of Health — Tickborne Diseases",
    url: "https://health.maryland.gov/phpa/oideor/czvbd/pages/tickborne_dz.aspx",
  },
  {
    code: "MA",
    destinationType: "State resource",
    id: "massachusetts",
    name: "Massachusetts",
    organization: "DPH — Tick-borne Diseases",
    url: "https://www.mass.gov/tick-borne-diseases",
  },
  {
    code: "MI",
    destinationType: "State tick tracking",
    id: "michigan",
    name: "Michigan",
    organization: "MDHHS — MiTracking: Ticks",
    url: "https://www.michigan.gov/mdhhs/safety-injury-prev/environmental-health/topics/mitracking/ticks",
  },
  {
    code: "MN",
    destinationType: "Tick monitoring and identification",
    id: "minnesota",
    name: "Minnesota",
    organization: "Department of Health — Tick Monitoring",
    url: "https://www.health.mn.gov/diseases/tickborne/monitoring.html",
  },
  {
    code: "MS",
    destinationType: "Broader state vector program",
    id: "mississippi",
    name: "Mississippi",
    organization: "MSDH — Entomology and Vector Control Program",
    url: "https://www.healthyms.com/msdhsite/_static/14%2C0%2C119.html",
  },
  {
    code: "MO",
    destinationType: "State resource and data",
    id: "missouri",
    name: "Missouri",
    organization: "DHSS — Tickborne Disease",
    url: "https://health.mo.gov/conditions-diseases/communicable-diseases/tickborne-disease",
  },
  {
    code: "MT",
    destinationType: "Tick reporting and surveillance",
    id: "montana",
    name: "Montana",
    organization: "DPHHS — Tickborne Illnesses",
    url: "https://dphhs.mt.gov/publichealth/cdepi/diseases/ticks/",
  },
  {
    code: "NE",
    destinationType: "Tick surveillance and reports",
    id: "nebraska",
    name: "Nebraska",
    organization: "DHHS — Tick-Borne Disease Data and Statistics",
    url: "https://dhhs.ne.gov/Pages/Tick-Borne-Disease-Data-and-Statistics.aspx",
  },
  {
    code: "NV",
    destinationType: "State disease resource",
    id: "nevada",
    name: "Nevada",
    organization: "Nevada Public Health — Lyme Disease",
    url: "https://nvose.org/diseases/lyme-disease/",
  },
  {
    code: "NH",
    destinationType: "State resource",
    id: "new-hampshire",
    name: "New Hampshire",
    organization: "DHHS — Tickborne Diseases",
    url: "https://www.dhhs.nh.gov/programs-services/disease-prevention/infectious-disease-control/tickborne-diseases",
  },
  {
    code: "NJ",
    destinationType: "State vector program",
    id: "new-jersey",
    name: "New Jersey",
    organization: "Department of Health — Fight the Bite, NJ!",
    url: "https://www.nj.gov/health/cd/topics/vectorborne.shtml",
  },
  {
    code: "NM",
    destinationType: "Broader state program",
    id: "new-mexico",
    name: "New Mexico",
    organization: "Department of Health — Zoonotic Disease Program",
    url: "https://www.nmhealth.org/about/erd/ideb/zdp/",
  },
  {
    code: "NY",
    destinationType: "State resource",
    id: "new-york",
    name: "New York",
    organization:
      "Department of Health — Lyme Disease and Other Diseases Carried by Ticks",
    url: "https://www.health.ny.gov/diseases/communicable/lyme/index",
  },
  {
    code: "NC",
    destinationType: "Professional guidance",
    id: "north-carolina",
    name: "North Carolina",
    organization: "DPH — Tick-Borne Illness Information for Health Departments",
    url: "https://epi.dph.ncdhhs.gov/cd/ticks/lhds.html",
  },
  {
    code: "ND",
    destinationType: "Tick surveillance and identification",
    id: "north-dakota",
    name: "North Dakota",
    organization: "HHS — Tick Surveillance",
    url: "https://www.hhs.nd.gov/health/diseases-conditions-and-immunization/tickborne/tick-surveillance",
  },
  {
    code: "OH",
    destinationType: "State surveillance update",
    id: "ohio",
    name: "Ohio",
    organization:
      "Department of Health — Vector-borne Disease Surveillance Update",
    url: "https://odh.ohio.gov/know-our-programs/zoonotic-vector-borne-diseases/news/vectorborne-disease-update",
  },
  {
    code: "OK",
    destinationType: "State resource",
    id: "oklahoma",
    name: "Oklahoma",
    organization: "Department of Health — Tickborne and Mosquitoborne Illness",
    url: "https://oklahoma.gov/health/health-education/acute-disease-service/tickborne-and-mosquitoborne-diseases.html",
  },
  {
    code: "OR",
    destinationType: "State resource and identification",
    id: "oregon",
    name: "Oregon",
    organization: "Oregon Health Authority — Ticks",
    url: "https://www.oregon.gov/oha/PH/DiseasesConditions/CommunicableDisease/Pages/Ticks.aspx",
  },
  {
    code: "PA",
    destinationType: "Tick surveillance program",
    id: "pennsylvania",
    name: "Pennsylvania",
    organization: "DEP — Tick Surveillance and Testing",
    url: "https://www.pa.gov/agencies/dep/programs-and-services/bureau-of-labs/vector-management/ticks",
  },
  {
    code: "RI",
    destinationType: "State resource and surveillance",
    id: "rhode-island",
    name: "Rhode Island",
    organization: "Department of Health — Tick Borne Diseases",
    url: "https://health.ri.gov/tick-borne-diseases",
  },
  {
    code: "SC",
    destinationType: "State resource and surveillance partnership",
    id: "south-carolina",
    name: "South Carolina",
    organization: "DPH — Ticks Can Spread Diseases",
    url: "https://dph.sc.gov/diseases-conditions/infectious-diseases/insects-and-vector-borne-diseases/ticks-can-spread-diseases",
  },
  {
    code: "SD",
    destinationType: "Tick survey and identification",
    id: "south-dakota",
    name: "South Dakota",
    organization: "Department of Health — Tick Identification and Tick Survey",
    url: "https://doh.sd.gov/topics/diseases-conditions/infectious-diseases/vector-borne-diseases/tick-borne-diseases/tick-id/",
  },
  {
    code: "TN",
    destinationType: "State surveillance program",
    id: "tennessee",
    name: "Tennessee",
    organization: "Department of Health — Vector-Borne Diseases",
    url: "https://www.tn.gov/content/tn/health/vector.html",
  },
  {
    code: "TX",
    destinationType: "Tick submission partnership",
    id: "texas",
    name: "Texas",
    organization: "DSHS — Tick Submission and Testing",
    url: "https://www.dshs.texas.gov/tick-borne-diseases/tick-submission-testing",
  },
  {
    code: "UT",
    destinationType: "Collaborative tick surveillance",
    id: "utah",
    name: "Utah",
    organization: "DHHS — One Health in Utah",
    url: "https://epi.utah.gov/onehealth/",
  },
  {
    code: "VT",
    destinationType: "Tick surveillance program",
    id: "vermont",
    name: "Vermont",
    organization: "Agency of Agriculture — Tick Surveillance",
    url: "https://agriculture.vermont.gov/public-health-agricultural-resource-management-division/plant-health-and-pest-management/ticks/tick",
  },
  {
    code: "VA",
    destinationType: "Tick surveillance project",
    id: "virginia",
    name: "Virginia",
    organization: "Department of Health — Virginia Tick Survey",
    url: "https://www.vdh.virginia.gov/ticks/tick-identification/virginia-tick-survey/",
  },
  {
    code: "WA",
    destinationType: "Tick identification, reporting and data",
    id: "washington",
    name: "Washington",
    organization: "Department of Health — Ticks",
    url: "https://doh.wa.gov/community-and-environment/pests/ticks",
  },
  {
    code: "WV",
    destinationType: "Tick surveillance and resources",
    id: "west-virginia",
    name: "West Virginia",
    organization: "OEPS — Tickborne Diseases",
    url: "https://oeps.wv.gov/tickborne-diseases",
  },
  {
    code: "WI",
    destinationType: "State tick hub",
    id: "wisconsin",
    name: "Wisconsin",
    organization: "DHS — Illnesses Spread by Ticks",
    url: "https://www.dhs.wisconsin.gov/tick/index.htm",
  },
  {
    code: "WY",
    destinationType: "Broader state program",
    id: "wyoming",
    name: "Wyoming",
    organization: "Department of Health — Infectious Disease Epidemiology",
    url: "https://health.wyo.gov/publichealth/infectious-disease-epidemiology-unit/",
  },
];

export type RegionalCenterType =
  | "Center of Excellence"
  | "Training & Evaluation";

export type RegionalCenter = {
  /** Named in the approved focus text. Absent when a service area was not supplied. */
  focus: string | null;
  id: string;
  name: string;
  purpose: string;
  type: RegionalCenterType;
  url: string;
};

export const REGIONAL_CENTERS: readonly RegionalCenter[] = [
  {
    focus: null,
    id: "gulf-south-vector",
    name: "Gulf South VECTOR",
    purpose: "Workforce training and tools.",
    type: "Training & Evaluation",
    url: "https://vectoroutreach.org/",
  },
  {
    focus: "Midwest",
    id: "midwest-center",
    name: "Midwest Center",
    purpose: "Research and entomology training.",
    type: "Center of Excellence",
    url: "https://mcevbd.wisc.edu/",
  },
  {
    focus: "Northeast",
    id: "nevbd",
    name: "NEVBD",
    purpose: "Professional training and tools.",
    type: "Training & Evaluation",
    url: "https://www.neregionalvectorcenter.com/",
  },
  {
    focus: "New England",
    id: "newvec",
    name: "NewVec",
    purpose: "Research and tick resources.",
    type: "Center of Excellence",
    url: "https://www.newvec.org/",
  },
  {
    focus: "Pacific Southwest",
    id: "pacvec",
    name: "PacVec",
    purpose: "Surveillance methods and research.",
    type: "Center of Excellence",
    url: "https://pacvec.us/",
  },
  {
    focus: "Rockies & High Plains",
    id: "rahpvec",
    name: "RaHPVEC",
    purpose: "Field training and surveillance.",
    type: "Training & Evaluation",
    url: "https://rahpvec.us/",
  },
  {
    focus: "Southeast",
    id: "southeastern-center",
    name: "Southeastern Center",
    purpose: "Vector research and prevention.",
    type: "Center of Excellence",
    url: "https://sercoevbd-flgateway.org/",
  },
  {
    focus: null,
    id: "tropical-islands",
    name: "Tropical Islands Training & Evaluation Center",
    purpose: "Regional training and evaluation.",
    type: "Training & Evaluation",
    url: "https://prvectorcontrol.org/",
  },
  {
    focus: null,
    id: "vectored-network",
    name: "VectorED Network",
    purpose: "Training and program resources.",
    type: "Training & Evaluation",
    url: "https://www.vectorednetwork.org/",
  },
];

const STATE_RESOURCES_BY_CODE = new Map(
  STATE_RESOURCES.map((state) => [state.code, state])
);

export function stateResourceByCode(
  code: string | null | undefined
): StateResource | null {
  if (!code) {
    return null;
  }
  return STATE_RESOURCES_BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

/** One postal code, or null when the parameter is missing or not one of the 50 states. */
export function selectedStateFromQuery(
  value: string | null | undefined
): StateResource | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null;
  }
  return stateResourceByCode(value);
}

export function resourcesPageHref(
  stateCode: string | null | undefined
): string {
  const state = stateResourceByCode(stateCode);
  if (!state) {
    return RESOURCES_PATH;
  }
  return `${RESOURCES_PATH}?state=${state.code}${RESOURCE_SECTION_HREFS.state}`;
}

export function statesInAlphabeticalOrder(): readonly StateResource[] {
  return STATE_RESOURCES.toSorted((left, right) =>
    left.name.localeCompare(right.name)
  );
}
