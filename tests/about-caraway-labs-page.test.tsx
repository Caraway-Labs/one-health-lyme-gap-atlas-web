import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AboutCarawayLabsPage, { metadata } from "@/app/about/caraway-labs/page";
import robots from "@/app/robots";
import {
  isProfessionalAppPath,
  shouldRedirectUnauthenticatedAppRoute,
} from "@/lib/auth/app-route-guard";
import { pageMetadataForRoute } from "@/lib/navigation";

const ABOUT_PATH = "/about/caraway-labs";

describe("About Caraway Labs page", () => {
  afterEach(cleanup);

  it("publishes the approved attribution copy", () => {
    render(<AboutCarawayLabsPage />);

    expect({
      disclosure: screen.getByText(/independent Caraway Labs project/)
        .textContent,
      headings: screen.getAllByRole("heading").map((heading) => ({
        level: heading.tagName,
        text: heading.textContent,
      })),
      intro: screen.getByText("Building practical tools for better decisions.")
        .textContent,
      lyme: screen.getByText(/starting with Lyme disease/).textContent,
      mission: screen.getByText(/Caraway Labs develops software experiences/)
        .textContent,
      principles: screen.getAllByRole("listitem").map((item) => ({
        body: within(item).getByRole("paragraph").textContent,
        title: within(item).getByRole("heading").textContent,
      })),
      workflow: screen.getByText(/human surveillance, vectors and pathogens/)
        .textContent,
    }).toStrictEqual({
      disclosure:
        "One Health Atlas is an independent Caraway Labs project. It is not an official public-health agency service, and its information is not medical advice.",
      headings: [
        { level: "H1", text: "About Caraway Labs" },
        { level: "H2", text: "One Health Atlas" },
        { level: "H2", text: "How we approach the work" },
        { level: "H3", text: "Evidence before certainty." },
        { level: "H3", text: "Connected perspectives." },
        { level: "H3", text: "Practical decision support." },
      ],
      intro: "Building practical tools for better decisions.",
      lyme: "One Health Atlas is a Caraway Labs project focused on helping public-health professionals investigate vector-borne disease evidence, starting with Lyme disease.",
      mission:
        "Caraway Labs develops software experiences that help people work with complex information and make more informed decisions.",
      principles: [
        {
          body: "Show sources, observation periods and limitations so users can understand what supports an interpretation.",
          title: "Evidence before certainty.",
        },
        {
          body: "One Health means examining relationships among human health, vectors, animals and the environment without assuming causation from correlation.",
          title: "Connected perspectives.",
        },
        {
          body: "Build tools to help researchers and public-health teams investigate and prioritize questions, not replace expert judgment.",
          title: "Practical decision support.",
        },
      ],
      workflow:
        "The Atlas brings different evidence systems into a common workflow: human surveillance, vectors and pathogens, environmental conditions, and community context. Its aim is to make it easier to explore what the available data shows, where important gaps remain, and what deserves closer investigation.",
    });
  });

  it("returns visitors to the public Atlas and privacy page without a form", () => {
    render(<AboutCarawayLabsPage />);

    expect({
      links: screen.getAllByRole("link").map((link) => ({
        href: link.getAttribute("href"),
        text: link.textContent,
      })),
      textboxes: screen.queryByRole("textbox"),
    }).toStrictEqual({
      links: [
        { href: "/", text: "Return to One Health Atlas" },
        { href: "/privacy", text: "Privacy" },
      ],
      textboxes: null,
    });
  });

  it("uses public route metadata and stays outside the sign-in gate", () => {
    expect({
      metadata,
      professionalPath: isProfessionalAppPath(ABOUT_PATH),
      redirect: shouldRedirectUnauthenticatedAppRoute({
        atlasE2E: false,
        nodeEnv: "production",
        pathname: ABOUT_PATH,
        supabaseConfigured: true,
        userPresent: false,
      }),
      robots: robots().rules,
    }).toStrictEqual({
      metadata: {
        ...pageMetadataForRoute(ABOUT_PATH),
        alternates: { canonical: ABOUT_PATH },
      },
      professionalPath: false,
      redirect: false,
      robots: { allow: "/", disallow: "/app", userAgent: "*" },
    });
  });
});
