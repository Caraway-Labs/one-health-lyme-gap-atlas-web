import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/variant_3",
}));

import { AppShell } from "@/components/app-shell";

describe("Atlas application shell", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("renders the metadata-driven primary navigation around route content", () => {
    render(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    expect(
      screen
        .getByRole("link", { name: "Evidence workspace" })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Geographic Explorer" })
        .getAttribute("href")
    ).toBe("/geographic_explorer");
    expect(document.querySelector(".app-content")?.textContent).toContain(
      "Route content"
    );
    expect(
      screen.getByRole("button", { name: "Data dictionary" })
    ).toBeTruthy();
  });

  it("collapses the persistent sidebar without losing its accessible names", () => {
    render(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse navigation" })
    );

    expect(screen.getByText("Route content")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Expand navigation" })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Evidence workspace" })
    ).toBeTruthy();
  });

  it("treats the mobile navigation as a keyboard-operable modal drawer", () => {
    render(
      <AppShell>
        <p>Route content</p>
      </AppShell>
    );

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Close navigation"
    );
    expect(
      document.querySelector(".app-inset")?.hasAttribute("inert")
    ).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
