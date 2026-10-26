"use client";

import { useLayoutEffect } from "react";

import {
  applyDocsThemeClass,
  clearDocsThemeClass,
  DOCS_THEME_STORAGE_KEY,
  resolveDocsTheme,
} from "@/lib/docs-theme";

/**
 * Applies the docs theme before paint on client navigations into `/docs`,
 * and removes it when the docs layout unmounts so the rest of the site stays
 * light. The blocking boot script covers full page loads.
 */
export function DocsThemeScope() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(DOCS_THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }
    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    applyDocsThemeClass(root, resolveDocsTheme(stored, systemDark));
    return () => {
      clearDocsThemeClass(root);
    };
  }, []);

  return null;
}
