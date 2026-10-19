export type ApiPlaygroundField = {
  label: string;
  name: string;
  required: boolean;
};

export type ApiPlaygroundExample = {
  id: string;
  label: string;
  values: Readonly<Record<string, string>>;
};

export type ApiPlaygroundOperation = {
  examples: readonly ApiPlaygroundExample[];
  id: string;
  label: string;
  method: "GET";
  pathFields: readonly ApiPlaygroundField[];
  pathTemplate: string;
  queryFields: readonly ApiPlaygroundField[];
};

const newYorkObservation = {
  geography_id: "36061",
  geography_type: "county",
  measure_id: "case_count_floor_2023",
  year: "2023",
} as const;

export const API_PLAYGROUND_OPERATIONS: readonly ApiPlaygroundOperation[] = [
  {
    examples: [
      {
        id: "ny-county-case-floor",
        label: "New York County case floor",
        values: newYorkObservation,
      },
      {
        id: "unsupported-geography-type",
        label: "Unsupported geography type",
        values: { ...newYorkObservation, geography_type: "tract" },
      },
    ],
    id: "observations",
    label: "GET /v1/observations",
    method: "GET",
    pathFields: [],
    pathTemplate: "/v1/observations",
    queryFields: [
      { label: "Measure id", name: "measure_id", required: true },
      { label: "Geography type", name: "geography_type", required: true },
      { label: "Geography id", name: "geography_id", required: true },
      { label: "Year", name: "year", required: false },
    ],
  },
  {
    examples: [
      {
        id: "case-count-floor",
        label: "Case count floor measure",
        values: { measure_id: "case_count_floor_2023" },
      },
    ],
    id: "measure",
    label: "GET /v1/measures/{measure_id}",
    method: "GET",
    pathFields: [{ label: "Measure id", name: "measure_id", required: true }],
    pathTemplate: "/v1/measures/{measure_id}",
    queryFields: [],
  },
  {
    examples: [
      {
        id: "human-source",
        label: "Human source",
        values: { source_id: "human" },
      },
    ],
    id: "source",
    label: "GET /v1/sources/{source_id}",
    method: "GET",
    pathFields: [{ label: "Source id", name: "source_id", required: true }],
    pathTemplate: "/v1/sources/{source_id}",
    queryFields: [],
  },
  {
    examples: [
      {
        id: "human-methodology",
        label: "Human case-floor methodology",
        values: { methodology_id: "human_confirmed_probable_case_floor_v1" },
      },
    ],
    id: "methodology",
    label: "GET /v1/methodologies/{methodology_id}",
    method: "GET",
    pathFields: [
      { label: "Methodology id", name: "methodology_id", required: true },
    ],
    pathTemplate: "/v1/methodologies/{methodology_id}",
    queryFields: [],
  },
  {
    examples: [
      {
        id: "current-metadata",
        label: "Current metadata",
        values: {},
      },
    ],
    id: "metadata",
    label: "GET /v1/atlas/metadata",
    method: "GET",
    pathFields: [],
    pathTemplate: "/v1/atlas/metadata",
    queryFields: [],
  },
  {
    examples: [
      {
        id: "ny-county",
        label: "New York County",
        values: { fips: "36061" },
      },
    ],
    id: "county",
    label: "GET /v1/counties/{fips}",
    method: "GET",
    pathFields: [{ label: "County FIPS", name: "fips", required: true }],
    pathTemplate: "/v1/counties/{fips}",
    queryFields: [],
  },
  {
    examples: [
      {
        id: "new-york-review",
        label: "New York review",
        values: { state: "NY" },
      },
    ],
    id: "state-review",
    label: "GET /v1/states/{state}/review",
    method: "GET",
    pathFields: [{ label: "State", name: "state", required: true }],
    pathTemplate: "/v1/states/{state}/review",
    queryFields: [],
  },
];

export function playgroundProxyPath(
  operation: ApiPlaygroundOperation,
  values: Readonly<Record<string, string>>
): string {
  let path = operation.pathTemplate;
  for (const field of operation.pathFields) {
    path = path.replaceAll(
      `{${field.name}}`,
      encodeURIComponent(values[field.name] ?? "")
    );
  }
  const params = new URLSearchParams();
  for (const field of operation.queryFields) {
    const value = values[field.name] ?? "";
    if (value.length > 0) params.append(field.name, value);
  }
  const query = params.toString();
  return `/api/proxy${path}${query.length > 0 ? `?${query}` : ""}`;
}
