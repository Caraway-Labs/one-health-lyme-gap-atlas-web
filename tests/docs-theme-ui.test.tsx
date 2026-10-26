import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocsThemeScope } from "@/components/docs-theme-scope";
import { DocsThemeSwitch } from "@/components/docs-theme-switch";
import { DOCS_THEME_STORAGE_KEY } from "@/lib/docs-theme";

function media(matches: boolean): MediaQueryList {
  return {
    addEventListener: () => {},
    addListener: () => {},
    dispatchEvent: () => false,
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    removeEventListener: () => {},
    removeListener: () => {},
  } as MediaQueryList;
}

function resetThemeDom(): void {
  cleanup();
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
  vi.unstubAllGlobals();
}

describe("docs theme UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetThemeDom();
  });

  describe(DocsThemeScope, () => {
    it("applies a stored theme and clears it on unmount", () => {
      vi.stubGlobal("matchMedia", () => media(false));
      localStorage.setItem(DOCS_THEME_STORAGE_KEY, "dark");
      const view = render(<DocsThemeScope />);
      expect(document.documentElement.classList.contains("dark")).toBeTruthy();
      view.unmount();
      expect(document.documentElement.className).toBe("");
    });

    it("follows the system when storage is blocked", () => {
      vi.stubGlobal("matchMedia", () => media(true));
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage blocked");
      });
      render(<DocsThemeScope />);
      expect(document.documentElement.classList.contains("dark")).toBeTruthy();
    });
  });

  describe(DocsThemeSwitch, () => {
    function renderSwitch(): void {
      vi.stubGlobal("matchMedia", () => media(false));
      render(
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey={DOCS_THEME_STORAGE_KEY}
        >
          <DocsThemeSwitch className="docs-theme-switch" />
        </ThemeProvider>
      );
    }

    it("marks the system choice until the reader picks one", () => {
      renderSwitch();
      expect({
        className: screen.getByRole("group", { name: "Theme" }).className,
        pressed: screen
          .getByRole("button", { name: "System" })
          .getAttribute("aria-pressed"),
      }).toStrictEqual({
        className: expect.stringContaining("docs-theme-switch"),
        pressed: "true",
      });
    });

    it("stores dark and light", () => {
      renderSwitch();
      fireEvent.click(screen.getByRole("button", { name: "Dark" }));
      const dark = {
        pressed: screen
          .getByRole("button", { name: "Dark" })
          .getAttribute("aria-pressed"),
        stored: localStorage.getItem(DOCS_THEME_STORAGE_KEY),
      };
      fireEvent.click(screen.getByRole("button", { name: "Light" }));
      expect({
        dark,
        light: {
          pressed: screen
            .getByRole("button", { name: "Light" })
            .getAttribute("aria-pressed"),
          stored: localStorage.getItem(DOCS_THEME_STORAGE_KEY),
        },
      }).toStrictEqual({
        dark: { pressed: "true", stored: "dark" },
        light: { pressed: "true", stored: "light" },
      });
    });
  });
});
