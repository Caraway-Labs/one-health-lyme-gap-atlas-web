import { describe, expect, it } from "vitest";

import { chatLauncherPlacementForPath } from "../src/lib/chat-launcher-placement";

describe(chatLauncherPlacementForPath, () => {
  it("uses county-workspace placement on exploration routes", () => {
    expect(chatLauncherPlacementForPath("/geographic_explorer")).toBe(
      "county-workspace"
    );
    expect(chatLauncherPlacementForPath("/investigate")).toBe(
      "county-workspace"
    );
  });

  it("uses default placement on other analytical routes", () => {
    expect(chatLauncherPlacementForPath("/")).toBe("default");
    expect(chatLauncherPlacementForPath("/evidence_library")).toBe("default");
  });
});
