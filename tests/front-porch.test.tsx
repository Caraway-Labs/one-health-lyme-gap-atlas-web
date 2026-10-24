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
  FRONT_PORCH_HERO_AUDIENCE,
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
  FRONT_PORCH_SYNTHESIS,
  frontPorchExploreHref,
  frontPorchExploreHrefSelectsCounty,
  frontPorchHrefSelectsUnrelatedCounty,
} from "@/features/front-porch/front-porch-copy";
import { FRONT_PORCH_RELEASE_DETAIL } from "@/features/front-porch/front-porch-example";
import { FrontPorchView } from "@/features/front-porch/front-porch-view";
import {
  ABOUT_CARAWAY_LABS_PATH,
  ATLAS_EXPLORER_PATH,
} from "@/features/ux-reset/routes";
import { ANALYTICS_PREFERENCE_KEY } from "@/lib/analytics-consent";

const FORBIDDEN_PUBLIC_COPY =
  /buncombe|montgomery|alaska|hawaii|37021|51121|data pending|underreported/i;

describe("front porch copy", () => {
  it("identifies the current scoring method separately from the cited data release", () => {
    expect(FRONT_PORCH_RELEASE_DETAIL.join(" ")).toContain(
      "Scoring methodology is surveillance-gap-score-v1.1, Smooth k=50"
    );
    expect(FRONT_PORCH_RELEASE_DETAIL.join(" ")).toContain(
      "30.4, in the Watch band"
    );
    expect(FRONT_PORCH_RELEASE_DETAIL.join(" ")).toContain(
      "Data-release methodology is semantic-2.0.0"
    );
  });

  it("keeps the locked hero copy", () => {
    expect({
      audience: FRONT_PORCH_HERO_AUDIENCE,
      example: FRONT_PORCH_HERO_EXAMPLE,
      headline: FRONT_PORCH_HERO_HEADLINE,
      support: FRONT_PORCH_HERO_SUPPORT,
    }).toStrictEqual({
      audience:
        "Designed for epidemiologists and vector-borne disease programs.",
      example:
        "Follow the Lyme disease example in Montgomery County, Virginia.",
      headline: "Connect the data. See the bigger picture.",
      support:
        "One Health Atlas brings county-level Lyme surveillance, tick and pathogen data, and community context into one place. It helps public health professionals compare counties, review data gaps, and identify questions for local follow-up.",
    });
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
        "Start with reported Lyme disease, then add tick surveillance and community context. This illustrative walkthrough uses published data from Montgomery County, Virginia, to explore what the sources tell us and what questions remain.",
      title: "What can we learn by looking at the data together?",
    });
  });

  it("keeps the approved ending copy free of em dashes", () => {
    expect(FRONT_PORCH_TRUST).toStrictEqual({
      eyebrow: "Confidence through clarity",
      paragraph:
        "Every finding has a source, a time period, and limits to its interpretation. One Health Atlas makes these details visible so public health professionals can assess what the data support and where additional information is needed.",
      title: "What's missing from the data matters, too.",
    });
    expect(FRONT_PORCH_TRUST_LINES.map((line) => line.href)).toStrictEqual([
      "/docs/sources-and-canonical-evidence",
      "/docs/releases-and-methodology",
      "/docs/evidence-and-uncertainty",
      "/docs/current-capabilities",
    ]);
    expect(FRONT_PORCH_FINALE).toStrictEqual({
      eyebrow: "Continue exploring",
      lines: ["One place to see", "the bigger picture."],
      paragraph:
        "Explore county-level Lyme disease data, review the findings in context, and consider questions for local follow-up. One Health Atlas brings the sources together to support informed public health review.",
      title: "One place to see the bigger picture.",
    });
    expect(FRONT_PORCH_EXPLORE_SUPPORT).toBe(
      "Workspace access requires sign-in."
    );
    expect(
      `${FRONT_PORCH_TRUST.paragraph} ${FRONT_PORCH_FINALE.paragraph} ${FRONT_PORCH_EXPLORE_SUPPORT}`
    ).not.toMatch(/—/);
  });

  it("keeps the scrollytelling steps free of invented claims", () => {
    const story = FRONT_PORCH_BEATS.map(
      (beat) => `${beat.title} ${beat.paragraphs.join(" ")}`
    ).join(" ");

    expect({
      details: FRONT_PORCH_BEATS.map((beat) =>
        beat.cardLines.map((line) => `${line.italicLead ?? ""}${line.text}`)
      ),
      ids: FRONT_PORCH_BEATS.map((beat) => beat.id),
      statuses: FRONT_PORCH_BEATS.map((beat) => beat.status),
      titles: FRONT_PORCH_BEATS.map((beat) => beat.title),
    }).toStrictEqual({
      details: [
        [
          "Reported cases provide a starting point for review.",
          "At least 71 reported probable cases",
          "Lyme disease · 2023",
        ],
        [
          "Tick observations and testing add another perspective.",
          "Ixodes scapularis: Established",
          "Borrelia burgdorferi: Present",
          "Cumulative records through December 2025",
        ],
        [
          "Community conditions help frame local public health questions.",
          "5.3% uninsured",
          "CDC/ATSDR SVI · 2018\u20132022 ACS",
        ],
      ],
      ids: ["human-surveillance", "vector-pathogen", "community-context"],
      statuses: ["Human data", "Vector data", "One Health view"],
      titles: [
        "Start with reported Lyme disease.",
        "Add tick and pathogen data.",
        "Place the data in context.",
      ],
    });
    const humanDetail = FRONT_PORCH_BEATS[0]?.sourceDetail.join(" ") ?? "";
    const storyAndCards = `${story} ${FRONT_PORCH_BEATS.map((beat) => beat.cardTitle).join(" ")}`;
    expect({
      environmental: /environmental/i.test(storyAndCards),
      fullRate: humanDetail.includes("71.45"),
      priority: FRONT_PORCH_SYNTHESIS.priorityTerm,
      probableMinimum: humanDetail.includes(
        "published privacy-protected minimum"
      ),
      rateOnCard: FRONT_PORCH_BEATS[0]?.cardLines.some((line) =>
        line.text.includes("71.5")
      ),
      storyDash: /—/.test(story),
      storyForbidden: FORBIDDEN_PUBLIC_COPY.test(story),
    }).toStrictEqual({
      environmental: false,
      fullRate: true,
      priority: "Watch priority",
      probableMinimum: true,
      rateOnCard: false,
      storyDash: false,
      storyForbidden: false,
    });
  });

  it("keeps generic Explorer entry free of a preselected county", () => {
    expect({
      signedIn: frontPorchExploreHref(true),
      signedOut: frontPorchExploreHref(false),
    }).toStrictEqual({
      signedIn: ATLAS_EXPLORER_PATH,
      signedOut: "/auth/sign-in?next=%2Fexplore",
    });
    expect([
      frontPorchExploreHrefSelectsCounty(frontPorchExploreHref(true)),
      frontPorchExploreHrefSelectsCounty(frontPorchExploreHref(false)),
      frontPorchHrefSelectsUnrelatedCounty("/explore?county=37021"),
      frontPorchHrefSelectsUnrelatedCounty(frontPorchExploreHref(true)),
    ]).toStrictEqual([false, false, true, false]);
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
      [...document.querySelectorAll(".front-porch-card-finding em")].map(
        (name) => ({
          name: name.textContent,
          line: name.parentElement?.textContent,
        })
      )
    ).toStrictEqual([
      {
        name: "Ixodes scapularis",
        line: "Ixodes scapularis: Established",
      },
      {
        name: "Borrelia burgdorferi",
        line: "Borrelia burgdorferi: Present",
      },
      {
        name: "Ixodes scapularis",
        line: "Ixodes scapularis: Established",
      },
      {
        name: "Borrelia burgdorferi",
        line: "Borrelia burgdorferi: Present",
      },
    ]);
    expect({
      documentation: screen
        .getByRole("link", { name: "Documentation" })
        .getAttribute("href"),
      explore: screen
        .getByRole("link", { name: FRONT_PORCH_EXPLORE_LABEL })
        .getAttribute("href"),
      how: screen
        .getByRole("link", { name: "How it works" })
        .getAttribute("href"),
      workspace: screen
        .getAllByRole("link", { name: "Explore One Health Atlas" })
        .map((link) => link.getAttribute("href")),
      sources: screen
        .getByRole("link", { name: "Sources and limitations" })
        .getAttribute("href"),
      story: screen
        .getByRole("link", { name: FRONT_PORCH_FOLLOW_STORY_LABEL })
        .getAttribute("href"),
    }).toStrictEqual({
      documentation: "/docs",
      explore: "/auth/sign-in?next=%2Fexplore",
      how: "#front-porch-how",
      workspace: [
        "/auth/sign-in?next=%2Fexplore",
        "/auth/sign-in?next=%2Fexplore",
      ],
      sources: "#front-porch-trust",
      story: `#${FRONT_PORCH_STORY_ID}`,
    });
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
      forbidden:
        /buncombe|alaska|hawaii|37021|51121|data pending|underreported/i.test(
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
        blockedAppLinks: [footer.querySelector('a[href="/app/settings"]')],
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
        blockedAppLinks: [null],
        brand: {
          href: ABOUT_CARAWAY_LABS_PATH,
          rel: "noopener noreferrer",
          target: "_blank",
        },
        brandMark: null,
        feedback: null,
        privacySettings: "Privacy settings",
        trustLinks: FRONT_PORCH_FOOTER_LINKS.map((item) => ({
          href: item.href,
          target: null,
          text: item.label,
        })),
      });
    }
  });

  it("keeps anonymous consent reachable from the public footer", () => {
    localStorage.clear();
    render(<FrontPorchView signedIn={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Privacy settings" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Turn off optional analytics" })
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
