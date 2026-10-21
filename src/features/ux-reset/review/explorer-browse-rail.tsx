"use client";

import { MapPin, Table2 } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import "./explorer-visual-first.css";

export const EXPLORER_RAIL_TABS = ["list", "county"] as const;
export type ExplorerRailTab = (typeof EXPLORER_RAIL_TABS)[number];

export function isExplorerRailTab(value: unknown): value is ExplorerRailTab {
  return EXPLORER_RAIL_TABS.some((tab) => tab === value);
}

/**
 * Which rail tab is showing. Choosing a county opens the County tab, clearing
 * it returns to the list, and returning focus from county evidence shows the
 * list so the focused row is on screen. The user can switch at any time.
 */
export function useExplorerRailTab({
  explicit,
  returnFocus,
  selectedFips,
}: {
  /**
   * True when the selection comes from the URL or a user choice. A county the
   * review picks on its own does not take the user off the list.
   */
  explicit: boolean;
  /** True while focus is being returned to a list row. */
  returnFocus: boolean;
  selectedFips: string;
}) {
  const [tab, setTab] = useState<ExplorerRailTab>(
    selectedFips && explicit ? "county" : "list"
  );
  const [trackedFips, setTrackedFips] = useState(selectedFips);
  const [trackedReturn, setTrackedReturn] = useState(returnFocus);
  let current = tab;
  if (trackedFips !== selectedFips) {
    setTrackedFips(selectedFips);
    if (!selectedFips) {
      current = "list";
      setTab(current);
    } else if (explicit) {
      current = "county";
      setTab(current);
    }
  }
  if (trackedReturn !== returnFocus) {
    setTrackedReturn(returnFocus);
    if (returnFocus && selectedFips) {
      current = "list";
      setTab(current);
    }
  }
  const showCounty = useCallback(() => {
    setTab("county");
  }, []);
  return { setTab, showCounty, tab: current };
}

export function ExplorerBrowseRail({
  county,
  list,
  listCount,
  onTabChange,
  tab,
}: {
  county: ReactNode;
  list: ReactNode;
  /** Number of rows in the list, shown on the List tab. */
  listCount: number | null;
  onTabChange: (tab: ExplorerRailTab) => void;
  tab: ExplorerRailTab;
}) {
  return (
    <Tabs
      className="ux-reset-explorer-rail"
      data-testid="explorer-rail"
      value={tab}
      onValueChange={(next) => {
        if (isExplorerRailTab(next)) {
          onTabChange(next);
        }
      }}
    >
      <TabsList
        aria-label="County list and selected county"
        className="ux-reset-explorer-rail-tabs"
        variant="line"
      >
        <TabsTrigger data-testid="explorer-rail-tab-list" value="list">
          <Table2 aria-hidden="true" />
          List
          {listCount === null ? null : (
            <span className="ux-reset-explorer-rail-count">{listCount}</span>
          )}
        </TabsTrigger>
        <TabsTrigger data-testid="explorer-rail-tab-county" value="county">
          <MapPin aria-hidden="true" />
          County
        </TabsTrigger>
      </TabsList>
      <TabsContent
        className="ux-reset-explorer-rail-panel ux-reset-explorer-list"
        data-testid="explorer-rail-panel-list"
        keepMounted
        value="list"
      >
        {list}
      </TabsContent>
      <TabsContent
        className="ux-reset-explorer-rail-panel ux-reset-explorer-preview"
        data-testid="explorer-rail-panel-county"
        keepMounted
        value="county"
      >
        {county}
      </TabsContent>
    </Tabs>
  );
}

export function ExplorerCountyEmptyState() {
  return (
    <p
      className="ux-reset-explorer-county-empty"
      data-testid="explorer-preview-empty"
    >
      <MapPin aria-hidden="true" />
      <span>Select a county on the map or in the list.</span>
    </p>
  );
}
