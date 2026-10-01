import { describe, expect, it } from "vitest";

import {
  atlasAssistantLauncherAccessibleName,
  shouldShowAssistantInPrimaryNavigation,
  shouldShowAtlasAssistantLauncher,
} from "@/lib/assistant-entry-points";
import { navigationItemsForGroup } from "@/lib/navigation";

describe("Atlas Assistant entry points", () => {
  it("hides the sidebar link while literature chat is enabled on explore routes", () => {
    expect(
      shouldShowAssistantInPrimaryNavigation("/geographic_explorer", true)
    ).toBeFalsy();
    expect(
      shouldShowAtlasAssistantLauncher("/geographic_explorer", true)
    ).toBeTruthy();
    expect(
      navigationItemsForGroup("research", {
        showAssistantInPrimaryNavigation: false,
      }).map((item) => item.id)
    ).toStrictEqual([]);
  });

  it("shows the sidebar link on the workspace and hides the launcher there", () => {
    expect(
      shouldShowAssistantInPrimaryNavigation("/assistant", true)
    ).toBeTruthy();
    expect(shouldShowAtlasAssistantLauncher("/assistant", true)).toBeFalsy();
    expect(
      navigationItemsForGroup("research", {
        showAssistantInPrimaryNavigation: true,
      }).map((item) => item.id)
    ).toStrictEqual(["assistant"]);
  });

  it("uses sidebar Coming Soon when literature chat is disabled", () => {
    expect(shouldShowAssistantInPrimaryNavigation("/", false)).toBeTruthy();
    expect(shouldShowAtlasAssistantLauncher("/", false)).toBeFalsy();
  });

  it("labels the launcher with early access when literature chat is enabled", () => {
    expect(atlasAssistantLauncherAccessibleName(true)).toBe(
      "Atlas Assistant, early access"
    );
  });
});
