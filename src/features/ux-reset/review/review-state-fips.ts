/**
 * Census state FIPS prefixes for map framing only.
 * This is geographic identity, not a review rule or candidate rank.
 */
export const STATE_FIPS_PREFIX = {
  AK: "02",
  AL: "01",
  AR: "05",
  AZ: "04",
  CA: "06",
  CO: "08",
  CT: "09",
  DC: "11",
  DE: "10",
  FL: "12",
  GA: "13",
  HI: "15",
  IA: "19",
  ID: "16",
  IL: "17",
  IN: "18",
  KS: "20",
  KY: "21",
  LA: "22",
  MA: "25",
  MD: "24",
  ME: "23",
  MI: "26",
  MN: "27",
  MO: "29",
  MS: "28",
  MT: "30",
  NC: "37",
  ND: "38",
  NE: "31",
  NH: "33",
  NJ: "34",
  NM: "35",
  NV: "32",
  NY: "36",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VA: "51",
  VT: "50",
  WA: "53",
  WI: "55",
  WV: "54",
  WY: "56",
} as const;

export type ReviewStatePostal = keyof typeof STATE_FIPS_PREFIX;

/** In the FIPS map for other atlas geography, and not a Review scope. */
const OUTSIDE_LOWER_48_REVIEW = new Set<ReviewStatePostal>(["AK", "HI"]);

export function stateFipsPrefix(scopeCode: string): string | null {
  if (!Object.hasOwn(STATE_FIPS_PREFIX, scopeCode)) {
    return null;
  }
  return STATE_FIPS_PREFIX[scopeCode as ReviewStatePostal];
}

export type Lower48ReviewPostal = Exclude<ReviewStatePostal, "AK" | "HI">;

/** Geographic names for the lower 48 and DC. Alaska and Hawaii are not Review states. */
const LOWER_48_REVIEW_STATE_NAMES = {
  AL: "Alabama",
  AR: "Arkansas",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  MT: "Montana",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming",
} as const satisfies Record<Lower48ReviewPostal, string>;

/** Lower 48 and DC. The same map as `stateFipsPrefix`, without Alaska and Hawaii. */
export function isLower48ReviewScope(scopeCode: string): boolean {
  return (
    Object.hasOwn(STATE_FIPS_PREFIX, scopeCode) &&
    !OUTSIDE_LOWER_48_REVIEW.has(scopeCode as ReviewStatePostal)
  );
}

const LOWER_48_COUNTY_FIPS_PREFIXES = new Set(
  (Object.entries(STATE_FIPS_PREFIX) as [ReviewStatePostal, string][])
    .filter(([postal]) => isLower48ReviewScope(postal))
    .map(([, prefix]) => prefix)
);

/** Five-digit county FIPS in the lower 48 or the District of Columbia. */
export function isLower48CountyFips(fips: string): boolean {
  return (
    /^\d{5}$/.test(fips) && LOWER_48_COUNTY_FIPS_PREFIXES.has(fips.slice(0, 2))
  );
}

export function lower48ReviewPostalCodes(): ReviewStatePostal[] {
  return (Object.keys(STATE_FIPS_PREFIX) as ReviewStatePostal[])
    .filter((code) => isLower48ReviewScope(code))
    .toSorted();
}

export function lower48ReviewStateName(code: string): string | null {
  if (!isLower48ReviewScope(code)) {
    return null;
  }
  return LOWER_48_REVIEW_STATE_NAMES[code as Lower48ReviewPostal];
}

/** Postal code for a two-digit state FIPS prefix, when the prefix is known. */
export function postalCodeForStateFips(
  fipsPrefix: string
): ReviewStatePostal | null {
  const match = (Object.keys(STATE_FIPS_PREFIX) as ReviewStatePostal[]).find(
    (postal) => STATE_FIPS_PREFIX[postal] === fipsPrefix
  );
  return match ?? null;
}
