import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiPlayground } from "@/features/docs/api-playground";

describe("api playground", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("drops a late response after the endpoint changes", async () => {
    const pending = Promise.withResolvers<Response>();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return pending.promise;
      })
    );
    render(<ApiPlayground />);

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Sending GET /v1/observations"
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Endpoint" }));
    const option = screen.getByRole("option", {
      name: "GET /v1/measures/{measure_id}",
    });
    fireEvent.pointerDown(option, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(option, { button: 0, pointerId: 1 });
    fireEvent.click(option);

    expect({
      aborted: signal?.aborted ?? false,
      endpoint: screen
        .getByRole("combobox", { name: "Endpoint" })
        .textContent?.includes("GET /v1/measures/{measure_id}"),
      status: screen.getByRole("status").textContent,
    }).toStrictEqual({
      aborted: true,
      endpoint: true,
      status: "No request sent yet.",
    });

    await act(async () => {
      pending.resolve(
        new Response("stale-observation-body", {
          headers: { "content-type": "application/json" },
          status: 200,
        })
      );
    });

    expect({
      staleBody: screen.queryByText("stale-observation-body"),
      staleStatus: screen.queryByText(/HTTP 200 from GET \/v1\/observations/),
      status: screen.getByRole("status").textContent,
    }).toStrictEqual({
      staleBody: null,
      staleStatus: null,
      status: "No request sent yet.",
    });
  });
});
