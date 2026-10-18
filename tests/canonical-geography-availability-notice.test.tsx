import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanonicalGeographyAvailabilityNotice } from "@/features/ux-reset/geography/canonical-geography-availability-notice";
import * as atlasClient from "@/generated/atlas";
import { AtlasApiError } from "@/lib/api-mutator";

function renderNotice() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        retryDelay: (attempt) => 1000 * 2 ** attempt,
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <CanonicalGeographyAvailabilityNotice fips="01001" />
    </QueryClientProvider>
  );
}

describe("canonical geography availability query", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows a 429 without an early retry", async () => {
    vi.useFakeTimers();
    const availability = vi
      .spyOn(atlasClient, "canonicalGeographyAvailability")
      .mockRejectedValue(
        new AtlasApiError(
          "rate limited",
          "/v1/geographies/county/01001/availability",
          429,
          null,
          60
        )
      );
    renderNotice();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(availability).toHaveBeenCalledOnce();
    expect(
      screen.getByTestId("canonical-geography-availability")
    ).toHaveAttribute("data-status", "rate_limited");
    expect(screen.getByText(/rate limited/)).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(availability).toHaveBeenCalledOnce();
  });

  it("does not retry a missing county", async () => {
    vi.useFakeTimers();
    const availability = vi
      .spyOn(atlasClient, "canonicalGeographyAvailability")
      .mockRejectedValue(
        new AtlasApiError(
          "missing",
          "/v1/geographies/county/01001/availability",
          404,
          null
        )
      );
    renderNotice();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByTestId("canonical-geography-availability")
    ).toHaveAttribute("data-status", "not_found");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(availability).toHaveBeenCalledOnce();
  });

  it("does not retry a response that fails the contract", async () => {
    vi.useFakeTimers();
    const availability = vi
      .spyOn(atlasClient, "canonicalGeographyAvailability")
      .mockResolvedValue({
        data: {
          availability: "UNAVAILABLE",
          data: null,
          limitations: [],
          reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED",
          release_id: "",
        },
        headers: new Headers(),
        status: 200,
      });
    renderNotice();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByTestId("canonical-geography-availability")
    ).toHaveAttribute("data-status", "error");
    expect(
      screen.getByText(/did not match the governed contract/)
    ).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(availability).toHaveBeenCalledOnce();
  });
});
