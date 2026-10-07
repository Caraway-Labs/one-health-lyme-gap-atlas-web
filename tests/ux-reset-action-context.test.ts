import { describe, expect, it } from "vitest";

import {
  actionPlanPosture,
  actionRequestedPeriodState,
} from "@/features/ux-reset/action/action-context";

const year2023 = [{ period_end: "2023-12-31", period_start: "2023-01-01" }];

describe("Action evidence context", () => {
  it("marks a requested period stale only when it misses the observations", () => {
    expect({
      inside: actionRequestedPeriodState({
        loaded: true,
        observations: year2023,
        requestedPeriod: "2023-06-15",
      }),
      matchedStart: actionRequestedPeriodState({
        loaded: true,
        observations: year2023,
        requestedPeriod: "2023-01-01",
      }),
      none: actionRequestedPeriodState({
        loaded: true,
        observations: year2023,
        requestedPeriod: null,
      }),
      outside: actionRequestedPeriodState({
        loaded: true,
        observations: year2023,
        requestedPeriod: "1999-01-01",
      }),
      unloaded: actionRequestedPeriodState({
        loaded: false,
        observations: [],
        requestedPeriod: "1999-01-01",
      }),
      empty: actionRequestedPeriodState({
        loaded: true,
        observations: [],
        requestedPeriod: "2023-01-01",
      }),
    }).toStrictEqual({
      inside: "matched",
      matchedStart: "matched",
      none: "unspecified",
      outside: "stale",
      unloaded: "unspecified",
      empty: "unspecified",
    });
  });

  it("treats surveillance as unavailable and any other plan as unsupported", () => {
    expect({
      blank: actionPlanPosture([""]),
      brief: actionPlanPosture(["brief"]),
      duplicate: actionPlanPosture(["surveillance", "brief"]),
      none: actionPlanPosture([]),
      surveillance: actionPlanPosture(["surveillance"]),
    }).toStrictEqual({
      blank: { kind: "none" },
      brief: { kind: "unsupported", plan: "brief" },
      duplicate: { kind: "unsupported", plan: "surveillance,brief" },
      none: { kind: "none" },
      surveillance: { kind: "surveillance_unavailable" },
    });
  });
});
