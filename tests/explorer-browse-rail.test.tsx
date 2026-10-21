import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  ExplorerBrowseRail,
  ExplorerCountyEmptyState,
  ExplorerRailTabMemoryProvider,
  isExplorerRailTab,
  useExplorerRailTab,
} from "@/features/ux-reset/review/explorer-browse-rail";

type HarnessProps = {
  explicit: boolean;
  returnFocus: boolean;
  selectedFips: string;
};

function Harness({ explicit, returnFocus, selectedFips }: HarnessProps) {
  const { tab, setTab } = useExplorerRailTab({
    explicit,
    returnFocus,
    selectedFips,
  });
  return (
    <ExplorerBrowseRail
      county={<p>County detail</p>}
      list={<p>County list</p>}
      listCount={selectedFips ? 12 : null}
      tab={tab}
      onTabChange={setTab}
    />
  );
}

function selectedTab() {
  return screen
    .getAllByRole("tab")
    .find((tab) => tab.getAttribute("aria-selected") === "true")?.textContent;
}

describe("explorer browse rail", () => {
  afterEach(() => {
    cleanup();
  });

  it("recognizes only the two rail tabs", () => {
    expect(isExplorerRailTab("list")).toBeTruthy();
    expect(isExplorerRailTab("county")).toBeTruthy();
    expect(isExplorerRailTab("evidence")).toBeFalsy();
    expect(isExplorerRailTab(null)).toBeFalsy();
  });

  it("starts on the list with no selection and hides the list count when unknown", () => {
    render(<Harness explicit={false} returnFocus={false} selectedFips="" />);

    expect(selectedTab()).toBe("List");
    expect(screen.queryByText("12")).toBeNull();
  });

  it("starts on the County tab for an explicit selection and shows the count", () => {
    render(<Harness explicit returnFocus={false} selectedFips="01011" />);

    expect(selectedTab()).toBe("County");
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("keeps the user on the list when the review picked the county itself", () => {
    render(
      <Harness explicit={false} returnFocus={false} selectedFips="01011" />
    );

    expect(selectedTab()).toBe("List12");
  });

  it("starts on the list while focus returns to a row", () => {
    render(<Harness explicit returnFocus selectedFips="01011" />);

    expect(selectedTab()).toBe("List12");
  });

  it("lets the user switch tabs and keeps both panels mounted", async () => {
    const user = userEvent.setup();
    render(
      <Harness explicit={false} returnFocus={false} selectedFips="01011" />
    );

    await user.click(screen.getByTestId("explorer-rail-tab-county"));

    expect(selectedTab()).toBe("County");
    expect(
      screen.getByTestId("explorer-rail-panel-list").hasAttribute("hidden")
    ).toBeTruthy();
    expect(screen.getByText("County list")).toBeTruthy();
  });

  it("opens the County tab when a county is chosen and returns to the list when cleared", () => {
    const { rerender } = render(
      <Harness explicit returnFocus={false} selectedFips="" />
    );
    expect(selectedTab()).toBe("List");

    rerender(<Harness explicit returnFocus={false} selectedFips="01011" />);
    expect(selectedTab()).toBe("County");

    rerender(<Harness explicit returnFocus={false} selectedFips="" />);
    expect(selectedTab()).toBe("List");
  });

  it("does not leave the list when a county is picked without an explicit choice", () => {
    const { rerender } = render(
      <Harness explicit={false} returnFocus={false} selectedFips="" />
    );

    rerender(
      <Harness explicit={false} returnFocus={false} selectedFips="01011" />
    );

    expect(selectedTab()).toBe("List12");
  });

  it("shows the list when focus starts returning to a row", () => {
    const { rerender } = render(
      <Harness explicit returnFocus={false} selectedFips="01011" />
    );
    expect(selectedTab()).toBe("County");

    rerender(<Harness explicit returnFocus selectedFips="01011" />);

    expect(selectedTab()).toBe("List12");
  });

  it("restores the remembered tab on remount, but prefers the list while focus returns", () => {
    function Page({
      mounted,
      returnFocus,
    }: {
      mounted: boolean;
      returnFocus: boolean;
    }) {
      return (
        <ExplorerRailTabMemoryProvider>
          {mounted ? (
            <Harness explicit returnFocus={returnFocus} selectedFips="01011" />
          ) : (
            <p>loading</p>
          )}
        </ExplorerRailTabMemoryProvider>
      );
    }
    const { rerender } = render(<Page mounted returnFocus={false} />);
    expect(selectedTab()).toBe("County");

    rerender(<Page mounted={false} returnFocus={false} />);
    rerender(<Page mounted returnFocus={false} />);
    expect(selectedTab()).toBe("County");

    rerender(<Page mounted={false} returnFocus />);
    rerender(<Page mounted returnFocus />);
    expect(selectedTab()).toBe("List12");
  });

  it("renders the empty county prompt", () => {
    render(<ExplorerCountyEmptyState />);

    expect(screen.getByTestId("explorer-preview-empty").textContent).toBe(
      "Select a county on the map or in the list."
    );
  });
});
