import { describe, expect, it } from "vitest";

import { resetRouteById } from "@/features/ux-reset/paths";
import {
  pickResetSharedSearchParams,
  resetShellNavigationHref,
} from "@/features/ux-reset/shared-navigation-query";

describe("UX Reset shared navigation query", () => {
  it("keeps the five shared keys and drops page-local parameters", () => {
    const picked = pickResetSharedSearchParams(
      "?county=08001&scope=state&tab=map&dataset=release-1&period=2024&view=table"
    );
    expect(picked.toString()).toBe(
      "scope=state&county=08001&dataset=release-1&period=2024"
    );
  });

  it("appends shared context when navigating to another /app destination", () => {
    const href = resetShellNavigationHref(
      resetRouteById("explore"),
      "?county=08001&scope=state&tab=evidence&compare=08013"
    );
    expect(href).toBe("/app/explore?scope=state&county=08001&compare=08013");
  });
});
