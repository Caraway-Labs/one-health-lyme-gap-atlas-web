import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ExplorerMapFollowUp } from "@/features/ux-reset/review/explorer-map-follow-up";

const EMPTY_FOLLOW_UP =
  "Select a county on the map or in the list to see suggested follow-up.";

function renderFollowUp(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe("Explorer map suggested follow-up", () => {
  afterEach(() => {
    cleanup();
  });

  it("asks for a county selection when none is selected", () => {
    renderFollowUp(<ExplorerMapFollowUp fips={null} releaseId={null} />);

    expect(
      screen.getByRole("heading", { name: "Suggested follow-up" })
    ).toBeVisible();
    expect(screen.getByText(EMPTY_FOLLOW_UP)).toBeVisible();
    expect(screen.queryByText(/Atlas will not pick one/)).toBeNull();
  });

  it("keeps the empty prompt off a selected county", () => {
    renderFollowUp(<ExplorerMapFollowUp fips="01003" releaseId={null} />);

    expect(screen.queryByText(EMPTY_FOLLOW_UP)).toBeNull();
    expect(
      screen.getByText(
        "Suggested follow-up waits until the governed release for this map is known."
      )
    ).toBeVisible();
  });
});
