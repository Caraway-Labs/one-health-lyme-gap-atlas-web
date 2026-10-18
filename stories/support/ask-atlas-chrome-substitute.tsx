"use client";

import type { ReactNode } from "react";

/**
 * Storybook stand-in for workspace Ask Atlas chrome.
 * The header shortcut is not part of the shell. This substitute also skips
 * the inherited-context provider so catalog frames stay free of page context.
 */
export function AskAtlasChromeProvider({ children }: { children: ReactNode }) {
  return children;
}
