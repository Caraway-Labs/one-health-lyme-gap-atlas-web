import { describe, expect, it } from "vitest";

import {
  applyDocsThemeClass,
  clearDocsThemeClass,
  DOCS_THEME_STORAGE_KEY,
  docsThemeBootScript,
  resolveDocsTheme,
} from "@/lib/docs-theme";

describe("docs theme", () => {
  it("follows the system unless light or dark is stored", () => {
    expect({
      dark: resolveDocsTheme("dark", false),
      empty: resolveDocsTheme(null, true),
      light: resolveDocsTheme("light", true),
      other: resolveDocsTheme("sepia", false),
      systemDark: resolveDocsTheme("system", true),
      systemLight: resolveDocsTheme("system", false),
    }).toStrictEqual({
      dark: "dark",
      empty: "dark",
      light: "light",
      other: "light",
      systemDark: "dark",
      systemLight: "light",
    });
  });

  it("adds and clears only the docs theme class", () => {
    const root = document.createElement("html");
    root.className = "font-variable";
    root.style.colorScheme = "dark";
    applyDocsThemeClass(root, "dark");
    expect(root.className).toBe("font-variable dark");
    applyDocsThemeClass(root, "light");
    expect(root.className).toBe("font-variable light");
    clearDocsThemeClass(root);
    expect({
      className: root.className,
      colorScheme: root.style.colorScheme,
    }).toStrictEqual({
      className: "font-variable",
      colorScheme: "",
    });
  });

  it("boots only on docs routes from the docs storage key", () => {
    const script = docsThemeBootScript();
    expect(script).toContain(JSON.stringify(DOCS_THEME_STORAGE_KEY));
    expect(script).toContain('path!=="/docs"');
    expect(script).toContain("prefers-color-scheme: dark");
    expect(script).not.toContain("colorScheme");
  });
});
