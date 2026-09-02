import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams("state=CO") as never,
}));

import { SiteNav } from "../src/components/site-nav";

describe("Site navigation", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("opens and closes the data dictionary through the shared dialog", () => {
    render(<SiteNav />);

    fireEvent.click(screen.getByRole("button", { name: "Data dictionary" }));
    expect(screen.getByRole("dialog").textContent).toContain("Data dictionary");
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exposes variant routes through the keyboard-operable shared menu", () => {
    render(<SiteNav />);

    const trigger = screen.getByRole("button", { name: "Variants" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(
      screen
        .getByRole("menuitem", { name: "County review starting point" })
        .getAttribute("href")
    ).toBe("/variant_1");
    expect(
      screen
        .getByRole("menuitem", { name: "Wide evidence workspace" })
        .getAttribute("href")
    ).toBe("/variant_6");
    expect(
      screen.getByRole("link", { name: "Atlas" }).getAttribute("href")
    ).toBe("/?state=CO#atlas");
  });

  it("retains the conditional Evidence Chat route", () => {
    vi.stubEnv("NEXT_PUBLIC_KG_CHAT_ENABLED", "true");
    render(<SiteNav />);

    expect(
      screen.getByRole("link", { name: "Evidence chat" }).getAttribute("href")
    ).toBe("/knowledge-graph");
  });
});
