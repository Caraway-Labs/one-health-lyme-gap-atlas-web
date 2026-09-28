import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ClinicianResourcesPage from "@/app/ux-lab/public-site-pro-app/(site)/clinicians/page";
import PublicEducationPage from "@/app/ux-lab/public-site-pro-app/(site)/education/page";
import PublicSiteHomePage from "@/app/ux-lab/public-site-pro-app/(site)/page";
import ProfessionalOverviewPage from "@/app/ux-lab/public-site-pro-app/(workspace)/app/page";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";
import {
  OPEN_ATLAS_LABEL,
  PRO_APP_PATH,
  PUBLIC_CLINICIANS_PATH,
  PUBLIC_EDUCATION_PATH,
  PUBLIC_SITE_HOME,
  RETURN_TO_PUBLIC_SITE_LABEL,
  isPrototypeRouteActive,
} from "@/features/ux-lab/public-site-pro-app/paths";
import { ProfessionalAppShell } from "@/features/ux-lab/public-site-pro-app/professional-app-shell";
import { PublicSiteShell } from "@/features/ux-lab/public-site-pro-app/public-site-shell";

let pathname: string = PUBLIC_SITE_HOME;

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
}));

const prohibitedClaim =
  /incidence|high risk|priority \d|treatment|diagnos|recommend|percent|\d+%/i;

describe("Public site + professional app prototype", () => {
  afterEach(() => {
    cleanup();
    pathname = PUBLIC_SITE_HOME;
  });

  it("keeps education and clinician paths on the public site shell", () => {
    render(
      <PublicSiteShell>
        <PublicSiteHomePage />
      </PublicSiteShell>
    );

    const publicNav = screen.getByRole("navigation", { name: "Public site" });
    expect(publicNav.textContent).toContain("Education and local context");
    expect(publicNav.textContent).toContain("Clinician resources");
    expect(publicNav.textContent).not.toContain(OPEN_ATLAS_LABEL);
    expect(screen.getByText("Public site")).toBeTruthy();
    expect(document.querySelector(".app-shell")).toBeNull();
  });

  it("offers an explicit transition into the professional application", () => {
    render(
      <PublicSiteShell>
        <PublicSiteHomePage />
      </PublicSiteShell>
    );

    expect(
      screen
        .getAllByRole("link", { name: OPEN_ATLAS_LABEL })[0]
        ?.getAttribute("href")
    ).toBe(PRO_APP_PATH);
    expect(screen.getByText(UX_LAB_SAMPLE_NOTICE)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(prohibitedClaim);
  });

  it("renders the education and clinician resource paths", () => {
    pathname = PUBLIC_EDUCATION_PATH;
    const education = render(
      <PublicSiteShell>
        <PublicEducationPage />
      </PublicSiteShell>
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Education and local context",
      })
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sample place" })).toBeTruthy();
    education.unmount();

    pathname = PUBLIC_CLINICIANS_PATH;
    render(
      <PublicSiteShell>
        <ClinicianResourcesPage />
      </PublicSiteShell>
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Clinician resources" })
    ).toBeTruthy();
    expect(screen.getByText("Clinician resource cards")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(prohibitedClaim);
  });

  it("opens a labeled professional application with a return path", () => {
    pathname = PRO_APP_PATH;
    render(
      <ProfessionalAppShell>
        <ProfessionalOverviewPage />
      </ProfessionalAppShell>
    );

    expect(screen.getByText("You left the public site")).toBeTruthy();
    expect(screen.getByText("Professional application")).toBeTruthy();
    expect(document.querySelector(".app-shell")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: RETURN_TO_PUBLIC_SITE_LABEL })[0]
        ?.getAttribute("href")
    ).toBe(PUBLIC_SITE_HOME);
    expect(
      screen.getByRole("navigation", { name: "Professional application" })
        .textContent
    ).toContain("Leave this application");
  });

  it("marks the current professional workspace page", () => {
    pathname = PRO_APP_PATH;
    render(
      <ProfessionalAppShell>
        <ProfessionalOverviewPage />
      </ProfessionalAppShell>
    );

    expect(
      screen
        .getByRole("link", { name: "Workspace overview" })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(document.body.textContent).not.toMatch(prohibitedClaim);
  });

  it("matches prototype routes without treating the public site as the app", () => {
    expect(
      isPrototypeRouteActive(
        { href: PUBLIC_SITE_HOME, match: "exact" },
        PUBLIC_SITE_HOME
      )
    ).toBeTruthy();
    expect(
      isPrototypeRouteActive(
        { href: PUBLIC_SITE_HOME, match: "exact" },
        PUBLIC_EDUCATION_PATH
      )
    ).toBeFalsy();
    expect(
      isPrototypeRouteActive(
        { href: PRO_APP_PATH, match: "exact" },
        `${PRO_APP_PATH}/evidence`
      )
    ).toBeFalsy();
    expect(
      isPrototypeRouteActive(
        { href: `${PRO_APP_PATH}/evidence`, match: "prefix" },
        `${PRO_APP_PATH}/evidence`
      )
    ).toBeTruthy();
  });
});
