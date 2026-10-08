import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const redirectTo = vi.hoisted(() => vi.fn<(href: string) => void>());

vi.mock(import("next/navigation"), () => ({
  redirect: (href: string) => {
    redirectTo(href);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock(
  import("@/features/front-porch/front-porch-page"),
  () =>
    ({
      FrontPorchPage: () => <p>Front porch story</p>,
    }) as never
);

import Page from "@/app/page";

describe("public root route", () => {
  it("sends a legacy analytical query to Overview", async () => {
    await expect(
      Page({
        searchParams: Promise.resolve({
          county: "08001",
          dataset: "alpha-explorer",
          state: "CO",
        }),
      })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectTo).toHaveBeenCalledExactlyOnceWith(
      "/overview?county=08001&dataset=alpha-explorer&state=CO"
    );
  });

  it("renders the Front Porch when the query is not analytical", async () => {
    render(
      await Page({
        searchParams: Promise.resolve({ utm_source: "share" }),
      })
    );

    expect(screen.getByText("Front porch story").textContent).toBe(
      "Front porch story"
    );
  });
});
