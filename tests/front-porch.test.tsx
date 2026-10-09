import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  FRONT_PORCH_BEATS,
  FRONT_PORCH_EXPLORE_LABEL,
  FRONT_PORCH_EXPLORE_SUPPORT,
  FRONT_PORCH_FOLLOW_STORY_LABEL,
  FRONT_PORCH_FOOTER_LINKS,
  FRONT_PORCH_GLASS_CALLOUT,
  FRONT_PORCH_HERO_HEADLINE,
  FRONT_PORCH_HERO_IMAGE,
  FRONT_PORCH_HERO_SUPPORT,
  FRONT_PORCH_STORY_ID,
  frontPorchExploreHref,
  frontPorchExploreHrefSelectsCounty,
} from "@/features/front-porch/front-porch-copy";
import { FrontPorchView } from "@/features/front-porch/front-porch-view";
import { RESET_REVIEW_PATH } from "@/features/ux-reset/routes";

const FORBIDDEN_PUBLIC_COPY =
  /buncombe|alaska|hawaii|37021|data pending|underreported/i;

describe("front porch copy", () => {
  it("keeps the locked hero copy", () => {
    expect(FRONT_PORCH_HERO_HEADLINE).toBe(
      "The data is telling more than one story."
    );
    expect(FRONT_PORCH_HERO_SUPPORT).toBe(
      "Human health, vectors, and environmental conditions each reveal part of the picture. One Health Atlas helps epidemiologists connect those perspectives and decide what deserves a closer look."
    );
    expect(FRONT_PORCH_GLASS_CALLOUT).toBe(
      "Human health + Vectors + Environment"
    );
    expect(FRONT_PORCH_HERO_IMAGE).toMatchObject({
      approved: true,
      src: "/images/one-health-ecosystem.png",
    });
  });

  it("keeps a six-beat story free of invented claims", () => {
    const story = FRONT_PORCH_BEATS.map(
      (beat) => `${beat.title} ${beat.paragraphs.join(" ")}`
    ).join(" ");

    expect(FRONT_PORCH_BEATS.map((beat) => beat.id)).toStrictEqual([
      "question",
      "human-surveillance",
      "vector-pathogen",
      "environment-community",
      "sources-limits",
      "atlas",
    ]);
    expect(story).not.toMatch(FORBIDDEN_PUBLIC_COPY);
    expect(story).not.toMatch(/\d{4}/);
  });

  it("routes the professional CTA to Review without a county", () => {
    expect(frontPorchExploreHref(true)).toBe(RESET_REVIEW_PATH);
    expect(frontPorchExploreHref(false)).toBe(
      "/auth/sign-in?next=%2Fapp%2Freview"
    );
    expect(
      frontPorchExploreHrefSelectsCounty(frontPorchExploreHref(true))
    ).toBeFalsy();
    expect(
      frontPorchExploreHrefSelectsCounty(frontPorchExploreHref(false))
    ).toBeFalsy();
  });
});

describe("front porch view", () => {
  afterEach(cleanup);

  it("renders the signed-out story without a forced sign-in or county", () => {
    render(
      <FrontPorchView heroFontClassName="font-front-porch" signedIn={false} />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: FRONT_PORCH_HERO_HEADLINE })
    ).toBeTruthy();
    expect(screen.getByText(FRONT_PORCH_HERO_SUPPORT)).toBeTruthy();
    expect(screen.getAllByText(FRONT_PORCH_GLASS_CALLOUT)).toHaveLength(1);
    expect(
      screen
        .getByRole("link", { name: FRONT_PORCH_FOLLOW_STORY_LABEL })
        .getAttribute("href")
    ).toBe(`#${FRONT_PORCH_STORY_ID}`);
    expect(
      screen
        .getByRole("link", { name: FRONT_PORCH_EXPLORE_LABEL })
        .getAttribute("href")
    ).toBe("/auth/sign-in?next=%2Fapp%2Freview");
  });

  it("keeps the signed-out professional path and footer free of county claims", () => {
    render(<FrontPorchView signedIn={false} />);

    const image = document.querySelector("img");
    expect([
      screen.getByText(FRONT_PORCH_EXPLORE_SUPPORT).textContent,
      screen.getByRole("button", { name: "Privacy settings" }).textContent,
    ]).toStrictEqual([FRONT_PORCH_EXPLORE_SUPPORT, "Privacy settings"]);
    expect(
      screen.getByRole("link", { name: "Sign in" }).getAttribute("href")
    ).toBe("/auth/sign-in?next=%2Fapp%2Freview");
    expect([
      image?.getAttribute("src"),
      image?.getAttribute("alt"),
      image?.getAttribute("width"),
      image?.getAttribute("height"),
    ]).toStrictEqual([
      expect.stringContaining(
        encodeURIComponent("/images/one-health-ecosystem.png")
      ),
      "",
      "1280",
      "1229",
    ]);
    expect(
      FRONT_PORCH_FOOTER_LINKS.every((item) =>
        screen
          .getAllByRole("link", { name: item.label })
          .some((link) => link.getAttribute("href") === item.href)
      )
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(FORBIDDEN_PUBLIC_COPY);
  });

  it("renders each story beat heading", () => {
    render(<FrontPorchView signedIn={false} />);

    expect(
      FRONT_PORCH_BEATS.map(
        (beat) =>
          screen.getByRole("heading", { level: 2, name: beat.title })
            .textContent
      )
    ).toStrictEqual(FRONT_PORCH_BEATS.map((beat) => beat.title));
  });

  it("sends a signed-in visitor to Review with no county selected", () => {
    render(<FrontPorchView signedIn />);

    expect(
      screen
        .getByRole("link", { name: FRONT_PORCH_EXPLORE_LABEL })
        .getAttribute("href")
    ).toBe(RESET_REVIEW_PATH);
    expect(
      screen.getByRole("link", { name: "Open Review" }).getAttribute("href")
    ).toBe(RESET_REVIEW_PATH);
  });
});
