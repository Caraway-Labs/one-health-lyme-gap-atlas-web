"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { uxResetDestinationFromPath } from "@/features/ux-reset/routes";

type AskAtlasChrome = {
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

function surfaceAcceptsAskAtlas(pathname: string): boolean {
  const destination = uxResetDestinationFromPath(pathname);
  switch (destination) {
    case "action":
    case "compare":
    case "explore":
    case "investigate":
    case "review": {
      return true;
    }
    case "assistant":
    case "feed":
    case "settings":
    case null: {
      return false;
    }
    default: {
      const exhaustive: never = destination;
      return exhaustive;
    }
  }
}

export function AskAtlasChromeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const launcher = useMemo(
    () =>
      surfaceAcceptsAskAtlas(pathname) ? (
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          data-testid="ask-atlas-launcher"
          href="/askatlas"
        >
          Ask Atlas
        </Link>
      ) : null,
    [pathname]
  );
  const chrome = useMemo(() => ({ launcher }), [launcher]);

  return (
    <AskAtlasChromeContext.Provider value={chrome}>
      {children}
    </AskAtlasChromeContext.Provider>
  );
}
