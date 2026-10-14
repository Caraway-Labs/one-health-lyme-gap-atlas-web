import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  FRONT_PORCH_BEATS,
  FRONT_PORCH_EXPLORE_LABEL,
  FRONT_PORCH_EXPLORE_SUPPORT,
  FRONT_PORCH_FINALE,
  FRONT_PORCH_TRUST,
  FRONT_PORCH_TRUST_LINES,
  FRONT_PORCH_FOLLOW_STORY_LABEL,
  FRONT_PORCH_FOOTER_LINKS,
  FRONT_PORCH_GLASS_CALLOUT,
  FRONT_PORCH_INTRO,
  FRONT_PORCH_HERO_EXAMPLE,
  FRONT_PORCH_HERO_HEADLINE,
  FRONT_PORCH_HERO_IMAGE,
  FRONT_PORCH_HERO_SUPPORT,
  FRONT_PORCH_STORY_ID,
  frontPorchExploreHref,
  frontPorchExploreHrefSelectsCounty,
} from "@/features/front-porch/front-porch-copy";
import { FrontPorchView } from "@/features/front-porch/front-porch-view";
import {
  ABOUT_CARAWAY_LABS_PATH,
  ATLAS_EXPLORER_PATH,
} from "@/features/ux-reset/routes";
import { ANALYTICS_PREFERENCE_KEY } from "@/lib/analytics-consent";

const FORBIDDEN_PUBLIC_COPY =
  /buncombe|alaska|hawaii|37021|data pending|underreported/i;

describe("front porch copy", () => {
  it("keeps the locked hero copy", () => {
    expect(FRONT_PORCH_HERO_HEADLINE).toBe(
      "Connect the data. See the bigger picture."
    );
    expect(FRONT_PORCH_HERO_SUPPORT).toBe(
      "Human health, vectors, and environmental conditions each reveal part of the picture. One Health Atlas helps public health professionals connect those perspectives and decide what deserves a closer look."
    );
    expect(FRONT_PORCH_HERO_EXAMPLE).toBe(
      "Follow the Lyme disease example in Buncombe County, North Carolina."
    );
    expect({
      callout: FRONT_PORCH_GLASS_CALLOUT,
      image: FRONT_PORCH_HERO_IMAGE,
    }).toStrictEqual({
      callout: "Human health + Vectors + Environment",
      image: {
        approved: true,
        src: "/images/one-health-ecosystem.png",
      },
    });
    expect(FRONT_PORCH_INTRO).toStrictEqual({
      eyebrow: "The question worth asking",
      paragraph:
        "Reported Lyme cases show part of the picture. Tick surveillance, environmental data, and community context add other perspectives. Follow the Buncombe County example to see what becomes clearer—and what questions remain.",
      title: "What can we learn by looking at the data together?",
    });
  });

  it("keeps the approved ending copy free of em dashes", () => {
    expect(FRONT_PORCH_TRUST).toStrictEqual({
      eyebrow: "Confidence through clarity",
      paragraph:
        "Understanding a dataset means knowing where it came from, when it was collected, and what it can tell us. Atlas brings sources, coverage, and limitations into view so public health professionals can interpret the data in context.",
      title: "What's missing from the data matters, too.",
    });
    expect(FRONT_PORCH_TRUST_LINES.map((line) => line.detail)).toStrictEqual([
      "See where the data came from",
      "Know when the data were collected or reported",
      "See where data are available and where gaps remain",
      "Understand what the data can and cannot tell you",
    ]);
    expect(FRONT_PORCH_FINALE).toStrictEqual({
      eyebrow: "Continue exploring",
      paragraph:
        "Bring human surveillance, tick and pathogen data, and environmental and community context together. Explore county patterns, review the available data, and identify questions for follow-up.",
      title: "One place to see the bigger picture.",
    });
    expect(FRONT_PORCH_EXPLORE_SUPPORT).toBe(
      "Built for public health professionals."
    );
    expect(
      `${FRONT_PORCH_TRUST.paragraph} ${FRONT_PORCH_FINALE.paragraph} ${FRONT_PORCH_EXPLORE_SUPPORT}`
    ).not.toMatch(/—/);
  });

  it("keeps the scrollytelling steps free of invented claims", () => {
    const story = FRONT_PORCH_BEATS.map(
      (beat) => `${beat.title} ${beat.paragraphs.join(" ")}`
    ).join(" ");

    expect(FRONT_PORCH_BEATS.map((beat) => beat.id)).toStrictEqual([
      "human-surveillance",
      "vector-pathogen",
      "environment-community",
    ]);
    expect(FRONT_PORCH_BEATS.map((beat) => beat.title)).toStrictEqual([
      "Start with reported human illness.",
      "Add tick and pathogen data.",
      "Place the data in context.",
    ]);
    expect(FRONT_PORCH_BEATS.map((beat) => beat.status)).toStrictEqual([
      "Human data",
      "Vector data",
      "One Health view",
    ]);
    expect(story).not.toMatch(FORBIDDEN_PUBLIC_COPY);
    expect(story).not.toMatch(/\d{4}/);
  });

  it("routes the professional CTA to Review without a county", () => {
    expect(frontPorchExploreHref(true)).toBe(ATLAS_EXPLORER_PATH);
    expect(frontPorchExploreHref(false)).toBe("/auth/sign-in?next=%2Fexplore");
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
    ).toBe("/auth/sign-in?next=%2Fexplore");
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
    ).toBe("/auth/sign-in?next=%2Fexplore");
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
    expect({
      example: screen.getByText(FRONT_PORCH_HERO_EXAMPLE).textContent,
      forbidden: /alaska|hawaii|37021|data pending|underreported/i.test(
        document.body.textContent ?? ""
      ),
    }).toStrictEqual({
      example: FRONT_PORCH_HERO_EXAMPLE,
      forbidden: false,
    });
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
    ).toBe(ATLAS_EXPLORER_PATH);
    expect(
      screen
        .getByRole("link", { name: "Open Atlas Explorer" })
        .getAttribute("href")
    ).toBe(ATLAS_EXPLORER_PATH);
  });

  it("uses the approved trust footer for signed-out and signed-in visitors", () => {
    for (const signedIn of [false, true]) {
      cleanup();
      render(<FrontPorchView signedIn={signedIn} />);

      const footer = screen.getByRole("contentinfo");
      const brand = within(footer).getByRole("link", {
        name: "One Health Atlas by Caraway Labs (opens in a new tab)",
      });
      const trust = within(screen.getByRole("navigation", { name: "Trust" }));
      expect({
        blockedAppLinks: [
          footer.querySelector('a[href="/app/settings"]'),
          footer.querySelector('a[href="/app/ai-responsible-use"]'),
        ],
        brand: {
          href: brand.getAttribute("href"),
          rel: brand.getAttribute("rel"),
          target: brand.getAttribute("target"),
        },
        brandMark: footer.querySelector("img.atlas-brand-mark"),
        feedback: trust.queryByRole("button", { name: "Feedback" }),
        privacySettings: trust.getByRole("button", { name: "Privacy settings" })
          .textContent,
        trustLinks: trust.getAllByRole("link").map((link) => ({
          href: link.getAttribute("href"),
          target: link.getAttribute("target"),
          text: link.textContent,
        })),
      }).toStrictEqual({
        blockedAppLinks: [null, null],
        brand: {
          href: ABOUT_CARAWAY_LABS_PATH,
          rel: "noopener noreferrer",
          target: "_blank",
        },
        brandMark: null,
        feedback: null,
        privacySettings: "Privacy settings",
        trustLinks: [
          { href: "/privacy", target: null, text: "Privacy" },
          {
            href: "/ai-ethics",
            target: null,
            text: "AI / Responsible Use",
          },
        ],
      });
    }
  });

  it("keeps anonymous consent reachable from the public footer", () => {
    localStorage.clear();
    render(<FrontPorchView signedIn={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Privacy settings" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Keep optional analytics off" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Allow optional analytics" })
    );

    expect(
      JSON.parse(localStorage.getItem(ANALYTICS_PREFERENCE_KEY) ?? "{}")
        .decision
    ).toBe("granted");
    expect(
      screen.getByRole("dialog", { name: "Privacy settings" })
    ).toBeTruthy();
  });

  it("honors Do Not Track from the public privacy settings dialog", () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "doNotTrack");
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      get: () => "1",
    });

    try {
      render(<FrontPorchView signedIn={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Privacy settings" }));
      const allow = screen.getByRole("button", {
        name: "Allow optional analytics",
      });
      expect(
        allow.hasAttribute("disabled") || allow.ariaDisabled === "true"
      ).toBeTruthy();
      expect(screen.getByText(/Do Not Track/)).toBeTruthy();
    } finally {
      if (descriptor) {
        Object.defineProperty(navigator, "doNotTrack", descriptor);
      } else {
        Reflect.deleteProperty(navigator, "doNotTrack");
      }
    }
  });
});
