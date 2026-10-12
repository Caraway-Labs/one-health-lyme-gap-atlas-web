"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  AskAtlasInheritedContextProvider,
  useAskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import type { AskAtlasSurface } from "@/features/ux-reset/ask-atlas/inherited-context";
import { askAtlasEntryHref } from "@/features/ux-reset/ask-atlas/page-reference";
import {
  searchParamsWithCommittedExploreContext,
  useExploreCommittedNavigation,
} from "@/features/ux-reset/explore-committed-navigation";
import { uxResetDestinationFromPath } from "@/features/ux-reset/routes";

export type AskAtlasChrome = {
  launcher: ReactNode;
};

const EMPTY_ASK_ATLAS_CHROME: AskAtlasChrome = {
  launcher: null,
};

const AskAtlasChromeContext = createContext<AskAtlasChrome>(
  EMPTY_ASK_ATLAS_CHROME
);

export function useAskAtlasChrome(): AskAtlasChrome {
  return useContext(AskAtlasChromeContext);
}

function askAtlasSurfaceFromPath(pathname: string): AskAtlasSurface | null {
  const destination = uxResetDestinationFromPath(pathname);
  switch (destination) {
    case "action":
    case "compare":
    case "explore":
    case "investigate":
    case "review": {
      return destination;
    }
    case "assistant":
    case "feed":
    case "settings":
    case null: {
      return null;
    }
    default: {
      const exhaustive: never = destination;
      return exhaustive;
    }
  }
}

export function AskAtlasChromeProvider({ children }: { children: ReactNode }) {
  return (
    <AskAtlasInheritedContextProvider>
      <AskAtlasChromeSwitch>{children}</AskAtlasChromeSwitch>
    </AskAtlasInheritedContextProvider>
  );
}

function AskAtlasChromeSwitch({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const surface = askAtlasSurfaceFromPath(pathname);
  if (!surface) {
    return (
      <AskAtlasChromeContext.Provider value={EMPTY_ASK_ATLAS_CHROME}>
        {children}
      </AskAtlasChromeContext.Provider>
    );
  }
  return <AskAtlasSurfaceChrome>{children}</AskAtlasSurfaceChrome>;
}

function AskAtlasSurfaceChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const committedExploreNavigation = useExploreCommittedNavigation();
  const handoffParams = searchParamsWithCommittedExploreContext(
    pathname,
    searchParams,
    committedExploreNavigation
  );
  const context = useAskAtlasInheritedContext();
  const href = askAtlasEntryHref({
    context,
    pathname,
    searchParams: handoffParams,
  });
  const chrome = useMemo<AskAtlasChrome>(
    () => ({
      launcher: (
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          data-testid="ask-atlas-launcher"
          href={href}
        >
          Ask Atlas
        </Link>
      ),
    }),
    [href]
  );

  return (
    <AskAtlasChromeContext.Provider value={chrome}>
      {children}
    </AskAtlasChromeContext.Provider>
  );
}
