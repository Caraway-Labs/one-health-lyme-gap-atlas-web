"use client";

import type { ReactNode } from "react";

import { AskAtlasInheritedContextProvider } from "@/features/ux-reset/ask-atlas/ask-atlas-context";

/**
 * Workspace shell boundary for Ask Atlas page context.
 * The header shortcut that used to live here is retired (issue 685).
 * Sidebar and in-content Ask Atlas actions stay on their own components.
 */
export function AskAtlasChromeProvider({ children }: { children: ReactNode }) {
  return (
    <AskAtlasInheritedContextProvider>
      {children}
    </AskAtlasInheritedContextProvider>
  );
}
