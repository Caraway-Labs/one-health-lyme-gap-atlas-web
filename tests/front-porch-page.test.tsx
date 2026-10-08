import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ value: null as string | null }));

vi.mock(
  import("next/font/local"),
  () =>
    ({
      default: () => ({ variable: "--font-front-porch-hero" }),
    }) as never
);

vi.mock(import("next/headers"), () => ({
  headers: async () =>
    new Headers(
      session.value === null
        ? undefined
        : { "x-atlas-front-porch-session": session.value }
    ),
}));

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/",
}));

import { AtlasHomePage } from "@/app/atlas-home-page";
import Page, { metadata as overviewMetadata } from "@/app/overview/page";
import { frontPorchHeroFont } from "@/features/front-porch/front-porch-font";
import { FrontPorchPage } from "@/features/front-porch/front-porch-page";
import { readFrontPorchSignedIn } from "@/features/front-porch/front-porch-session";

describe("front porch page session", () => {
  afterEach(() => {
    cleanup();
    session.value = null;
  });

  it("reads a signed-in session header into the Review link", async () => {
    session.value = "1";

    await expect(readFrontPorchSignedIn()).resolves.toBeTruthy();
    render(await FrontPorchPage());

    expect(
      screen.getByRole("link", { name: "Open Review" }).getAttribute("href")
    ).toBe("/app/review");
    expect(frontPorchHeroFont.variable).toBe("--font-front-porch-hero");
  });

  it("treats a missing session header as signed out", async () => {
    render(await FrontPorchPage());

    expect(
      screen.getByRole("link", { name: "Sign in" }).getAttribute("href")
    ).toBe("/auth/sign-in?next=%2Fapp%2Freview");
  });
});

describe("overview route", () => {
  it("keeps a canonical URL and renders the analytical Atlas", () => {
    expect(overviewMetadata.alternates).toStrictEqual({
      canonical: "/overview",
    });
    expect(Page().type).toBe(AtlasHomePage);
  });
});
