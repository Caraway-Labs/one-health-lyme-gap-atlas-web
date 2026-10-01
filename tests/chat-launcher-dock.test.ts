import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearChatLauncherDockInsets,
  syncChatLauncherDockInsets,
} from "../src/lib/chat-launcher-dock";

describe("chat launcher dock insets", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    clearChatLauncherDockInsets();
  });

  afterEach(() => {
    clearChatLauncherDockInsets();
    document.body.innerHTML = "";
  });

  it("syncs inset geometry to CSS custom properties", () => {
    const inset = document.createElement("div");
    inset.dataset.slot = "sidebar-inset";
    inset.getBoundingClientRect = () =>
      ({
        left: 128,
        width: 960,
        top: 0,
        right: 1088,
        bottom: 800,
        height: 800,
        x: 128,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.append(inset);

    syncChatLauncherDockInsets();

    expect(
      document.documentElement.style.getPropertyValue("--chat-launcher-dock-left")
    ).toBe("128px");
    expect(
      document.documentElement.style.getPropertyValue("--chat-launcher-dock-width")
    ).toBe("960px");
  });

  it("clears custom properties when inset is absent", () => {
    document.documentElement.style.setProperty("--chat-launcher-dock-left", "1px");
    clearChatLauncherDockInsets();
    expect(
      document.documentElement.style.getPropertyValue("--chat-launcher-dock-left")
    ).toBe("");
  });
});
