export const DOCS_THEME_STORAGE_KEY = "atlas-docs-theme";

export type DocsColorScheme = "dark" | "light";

/**
 * Stored "system", a missing value, and any other string follow the OS.
 * Only the explicit light and dark choices override it.
 */
export function resolveDocsTheme(
  stored: string | null,
  systemDark: boolean
): DocsColorScheme {
  if (stored === "light" || stored === "dark") return stored;
  return systemDark ? "dark" : "light";
}

export function applyDocsThemeClass(
  root: HTMLElement,
  theme: DocsColorScheme
): void {
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

/** Remove the docs theme class so other routes keep the light app. */
export function clearDocsThemeClass(root: HTMLElement): void {
  root.classList.remove("light", "dark");
  root.style.colorScheme = "";
}

/**
 * Inline boot script for full page loads. It runs before paint and only when
 * the URL is `/docs`, so other routes keep the light document class.
 */
export function docsThemeBootScript(): string {
  return `(function(){try{var path=location.pathname;if(path!=="/docs"&&path.indexOf("/docs/")!==0)return;var stored=localStorage.getItem(${JSON.stringify(DOCS_THEME_STORAGE_KEY)});var theme=stored==="light"||stored==="dark"?stored:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var root=document.documentElement;root.classList.remove("light","dark");root.classList.add(theme);}catch(e){}})();`;
}
