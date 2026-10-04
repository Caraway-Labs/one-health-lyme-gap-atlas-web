"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { RESET_EXPLORE_PATH } from "@/features/ux-reset/routes";

/** Release, period, and county that belong to the displayed Explore selection. */
export type ExploreCommittedNavigation = {
  county: string | null;
  dataset: string | null;
  period: string | null;
};

type SearchParamSource = Pick<
  URLSearchParams,
  "get" | "getAll" | "has" | "toString"
>;

type SetExploreCommittedNavigation = (
  value: ExploreCommittedNavigation | null
) => void;

const ExploreCommittedNavigationValueContext =
  createContext<ExploreCommittedNavigation | null>(null);

const ExploreCommittedNavigationSetContext =
  createContext<SetExploreCommittedNavigation>(() => {});

export function ExploreCommittedNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [value, setValue] = useState<ExploreCommittedNavigation | null>(null);
  const setNavigation = useMemo<SetExploreCommittedNavigation>(
    () => setValue,
    []
  );
  return (
    <ExploreCommittedNavigationSetContext.Provider value={setNavigation}>
      <ExploreCommittedNavigationValueContext.Provider value={value}>
        {children}
      </ExploreCommittedNavigationValueContext.Provider>
    </ExploreCommittedNavigationSetContext.Provider>
  );
}

export function useExploreCommittedNavigation(): ExploreCommittedNavigation | null {
  return useContext(ExploreCommittedNavigationValueContext);
}

/**
 * Publish the displayed Explore identity for shell links. Other routes keep
 * their own URL context.
 */
export function usePublishExploreCommittedNavigation(
  next: ExploreCommittedNavigation | null
): void {
  const setNavigation = useContext(ExploreCommittedNavigationSetContext);
  const county = next?.county ?? null;
  const dataset = next?.dataset ?? null;
  const period = next?.period ?? null;
  useLayoutEffect(() => {
    setNavigation(
      county || dataset || period ? { county, dataset, period } : null
    );
  }, [county, dataset, period, setNavigation]);
  useLayoutEffect(() => () => setNavigation(null), [setNavigation]);
}

function normalizePath(pathname: string): string {
  return pathname.split(/[?#]/, 1)[0] || "/";
}

/**
 * Shell links on Explore use the committed release, period, and county.
 * The requested URL can still name an in-flight or rejected selection.
 */
export function searchParamsWithCommittedExploreContext(
  pathname: string,
  searchParams: SearchParamSource,
  committed: ExploreCommittedNavigation | null
): Pick<URLSearchParams, "get" | "getAll" | "has"> {
  if (normalizePath(pathname) !== RESET_EXPLORE_PATH || !committed) {
    return searchParams;
  }
  const params = new URLSearchParams(searchParams.toString());
  if (committed.dataset) {
    params.set("dataset", committed.dataset);
  } else {
    params.delete("dataset");
  }
  if (committed.period) {
    params.set("period", committed.period);
  } else {
    params.delete("period");
  }
  if (committed.county) {
    params.set("county", committed.county);
  } else {
    params.delete("county");
  }
  return params;
}
