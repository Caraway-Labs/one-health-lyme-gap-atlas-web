"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { serializeCompareFipsList } from "@/features/ux-reset/context-params";
import {
  RESET_COMPARE_PATH,
  RESET_EXPLORE_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
} from "@/features/ux-reset/routes";

/**
 * Release, period, and county that belong to the displayed selection.
 * `compare` is set by Compare so shell links follow the visible pair.
 */
export type ExploreCommittedNavigation = {
  county: string | null;
  compare?: readonly string[];
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
  const compareProvided = Boolean(next && Object.hasOwn(next, "compare"));
  const clearCounty = next !== null && next.county === null;
  const compareKey = compareProvided
    ? serializeCompareFipsList(next?.compare ?? [])
    : null;
  useLayoutEffect(() => {
    const compare =
      compareKey === null
        ? undefined
        : compareKey.length > 0
          ? compareKey.split(",")
          : [];
    // A null county is explicit: committed shell links must not keep a stale one
    // while release and period are still unknown.
    const shouldPublish = Boolean(
      county || dataset || period || compareProvided || clearCounty
    );
    setNavigation(
      shouldPublish
        ? {
            county,
            compare,
            dataset,
            period,
          }
        : null
    );
  }, [
    clearCounty,
    compareKey,
    compareProvided,
    county,
    dataset,
    period,
    setNavigation,
  ]);
  useLayoutEffect(() => () => setNavigation(null), [setNavigation]);
}

function normalizePath(pathname: string): string {
  return pathname.split(/[?#]/, 1)[0] || "/";
}

const COMMITTED_SHELL_PATHS = new Set<string>([
  RESET_EXPLORE_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
]);

/**
 * Shell links on Explore, Investigate, and Review use the committed release,
 * period, and county. Compare shell links use the visible county pair and the
 * resolved release once that release is on screen. A requested dataset stays
 * in the URL until then.
 * The requested URL can still name an in-flight selection.
 */
export function searchParamsWithCommittedExploreContext(
  pathname: string,
  searchParams: SearchParamSource,
  committed: ExploreCommittedNavigation | null
): Pick<URLSearchParams, "get" | "getAll" | "has"> {
  const path = normalizePath(pathname);
  const onCommittedShell = COMMITTED_SHELL_PATHS.has(path);
  const comparePair =
    path === RESET_COMPARE_PATH ? committed?.compare : undefined;
  if (!(onCommittedShell || comparePair !== undefined) || !committed) {
    return searchParams;
  }
  const params = new URLSearchParams(searchParams.toString());
  if (onCommittedShell) {
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
  }
  if (path === RESET_COMPARE_PATH && committed.dataset) {
    params.set("dataset", committed.dataset);
  }
  if (comparePair !== undefined) {
    if (comparePair.length === 0) {
      params.delete("compare");
    } else {
      params.set("compare", serializeCompareFipsList(comparePair));
    }
  }
  // An empty pair drops `compare` only. Compare keeps the originating county.
  if (committed.compare?.length === 0) {
    params.delete("compare");
  }
  return params;
}
