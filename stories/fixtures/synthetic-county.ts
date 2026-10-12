/**
 * Fixed lower-48 county used by Storybook fixtures.
 * Adams County, Colorado is FIPS 08001. Alaska (02) and Hawaii (15) are out of scope.
 */
export const syntheticCounty = {
  fips: "08001",
  name: "Adams County",
  stateCode: "CO",
  stateFips: "08",
  stateName: "Colorado",
} as const;

export const syntheticReleaseId = "alpha-2026";
export const syntheticPeriod = "2023-01-01";

const LOWER_48_AND_DC = new Set([
  "01",
  "04",
  "05",
  "06",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "50",
  "51",
  "53",
  "54",
  "55",
  "56",
]);

export function isLower48OrDcFips(fips: string): boolean {
  return LOWER_48_AND_DC.has(fips.slice(0, 2));
}
