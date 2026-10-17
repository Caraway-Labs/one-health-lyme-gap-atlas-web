/**
 * Montgomery County, Virginia (FIPS 51121) Front Porch illustration outline.
 *
 * Generated from governed CDC/ATSDR SVI 2022 display geometry (EPSG:4326)
 * served by GET /v1/atlas/geometry. Do not hand-edit this path or substitute
 * a Census or TIGER/Line analysis boundary.
 *
 * Regenerate: npm run generate:front-porch-county
 */
export const MONTGOMERY_COUNTY_FIPS = "51121" as const;

export const MONTGOMERY_COUNTY_OUTLINE = "M149.3 213.3 L341.4 98.0 L383.0 120.4 L385.6 148.6 L430.5 210.8 L438.4 310.2 L368.4 338.4 L326.2 385.5 L282.6 385.5 L280.6 402.0 L257.5 386.3 L230.5 419.4 L214.0 393.8 L196.8 416.1 L182.3 364.0 L196.2 370.6 L194.8 354.1 L173.1 329.3 L219.9 291.2 L213.3 278.8 L205.4 294.5 L206.1 276.3 L183.0 259.7 L215.3 236.5 L169.1 252.3 L149.3 213.3Z M213.3 294.5 L214.0 293.7 L213.3 294.5 L213.3 294.5Z";

export const MONTGOMERY_COUNTY_OUTLINE_PROVENANCE = {
  "apiBaseUrl": "https://api.onehealthatlas.org",
  "countyFips": "51121",
  "countyName": "Montgomery County, Virginia",
  "datasetLabel": "CDC/ATSDR Social Vulnerability Index",
  "datasetVintage": "2022 (2018-2022 ACS)",
  "displayGeometryPath": "/v1/atlas/geometry",
  "featureSha256": "1d6241ac2f1132bc38ce4fea34adcbf9a14720f06a4ac7502a91d9d989f2edee",
  "geometryEtag": "\"8049a783fb8f3ab3570bc94faca3dadc893d5f3e05c751ed4d372748c2a7dcf1\"",
  "geometryUrl": "https://api.onehealthatlas.org/v1/atlas/geometry?dataset_version=governed-2026-10-15-january-climate-prod",
  "projection": "Spherical Mercator (EPSG:3857) with the Earth-radius scale omitted, Y flipped into SVG, uniformly contained in the existing 600x480 illustration slot, rounded to 0.1 user units (maximum error 0.05 per axis). MapLibre uses the same projection; the remaining difference is camera fit, not a second boundary or further generalization.",
  "regenerate": "npm run generate:front-porch-county",
  "releaseId": "governed-2026-10-15-january-climate-prod",
  "ringPointCounts": [
    [
      26
    ],
    [
      4
    ]
  ],
  "sourceCrs": "EPSG:4326"
} as const;
