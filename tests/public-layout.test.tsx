import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeedbackProvider } from "@/components/feedback-dialog";
import { PublicLayout } from "@/components/public-layout";
import { FRONT_PORCH_FOOTER_LINKS } from "@/features/front-porch/front-porch-copy";
import { ABOUT_CARAWAY_LABS_PATH } from "@/features/ux-reset/routes";
import { getRouteShell } from "@/lib/navigation";

let pathname = "/about/caraway-labs";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
}));

const PUBLIC_TRUST_ROUTES = [
  "/about/caraway-labs",
  "/ai-ethics",
  "/privacy",
] as const;

describe("public trust page shell", () => {
  afterEach(() => {
    cleanup();
    pathname = "/about/caraway-labs";
  });

  it("places the navigation-tray mark and product name before the page", () => {
    expect(
      PUBLIC_TRUST_ROUTES.map((route) => getRouteShell(route))
    ).toStrictEqual(["public", "public", "public"]);

    render(
      <PublicLayout>
        <main>
          <h1>About Caraway Labs</h1>
        </main>
      </PublicLayout>
    );

    const identity = screen.getByRole("link", {
      name: "One Health Lyme Gap Atlas home",
    });
    expect({
      backLink: screen.queryByRole("link", { name: "Back to Atlas" }),
      backLinkWithArrow: screen.queryByRole("link", {
        name: "Back to Atlas ↑",
      }),
      followsIdentity: identity.compareDocumentPosition(
        screen.getByRole("main")
      ),
      heading: screen.getByRole("heading", { name: "About Caraway Labs" })
        .textContent,
      href: identity.getAttribute("href"),
      mark: identity.querySelector("img.atlas-brand-mark")?.getAttribute("src"),
      text: identity.textContent?.replaceAll(/\s+/g, " ").trim(),
    }).toStrictEqual({
      backLink: null,
      backLinkWithArrow: null,
      followsIdentity: Node.DOCUMENT_POSITION_FOLLOWING,
      heading: "About Caraway Labs",
      href: "/",
      mark: "/android-chrome-192x192.png",
      text: "One Health Lyme Gap Atlas",
    });
  });

  it("reuses the public Front Porch trust footer without the legacy disclosure", () => {
    render(
      <PublicLayout>
        <main>
          <p>Evidence before certainty.</p>
        </main>
      </PublicLayout>
    );

    const footer = screen.getByRole("contentinfo");
    const attribution = within(footer).getByRole("link", {
      name: "One Health Atlas by Caraway Labs (opens in a new tab)",
    });
    const trust = within(screen.getByRole("navigation", { name: "Trust" }));
    expect({
      attribution: {
        href: attribution.getAttribute("href"),
        rel: attribution.getAttribute("rel"),
        target: attribution.getAttribute("target"),
      },
      body: screen.getByText("Evidence before certainty.").textContent,
      footerMark: footer.querySelector("img.atlas-brand-mark"),
      legacyDisclosure: screen.queryByText(
        /Independent Caraway Labs prototype/
      ),
      privacySettings: trust.getByRole("button", { name: "Privacy settings" })
        .textContent,
      trustLinks: trust.getAllByRole("link").map((link) => ({
        href: link.getAttribute("href"),
        target: link.getAttribute("target"),
        text: link.textContent,
      })),
    }).toStrictEqual({
      attribution: {
        href: ABOUT_CARAWAY_LABS_PATH,
        rel: "noopener noreferrer",
        target: "_blank",
      },
      body: "Evidence before certainty.",
      footerMark: null,
      legacyDisclosure: null,
      privacySettings: "Privacy settings",
      trustLinks: FRONT_PORCH_FOOTER_LINKS.map((item) => ({
        href: item.href,
        target: null,
        text: item.label,
      })),
    });
  });

  it("restores footer feedback only on the contracted public routes", () => {
    const seen = [
      "/about/caraway-labs",
      "/privacy",
      "/ai-ethics",
      "/data-provenance",
    ].map((route) => {
      cleanup();
      pathname = route;
      render(
        <FeedbackProvider>
          <PublicLayout>
            <main>
              <p>{route}</p>
            </main>
          </PublicLayout>
        </FeedbackProvider>
      );
      const feedback = within(screen.getByRole("contentinfo")).queryByRole(
        "button",
        { name: "Feedback" }
      );
      if (!feedback) {
        return { dialog: null, route, trigger: null };
      }
      fireEvent.click(feedback);
      return {
        dialog: screen
          .getByRole("dialog", { name: "Send feedback" })
          .textContent?.includes("Send feedback"),
        route,
        trigger: feedback.dataset.atlasAnalyticsControl,
      };
    });

    expect(seen).toStrictEqual([
      { dialog: null, route: "/about/caraway-labs", trigger: null },
      {
        dialog: true,
        route: "/privacy",
        trigger: "feedback_footer_open",
      },
      {
        dialog: true,
        route: "/ai-ethics",
        trigger: "feedback_footer_open",
      },
      {
        dialog: true,
        route: "/data-provenance",
        trigger: "feedback_footer_open",
      },
    ]);
  });
});
