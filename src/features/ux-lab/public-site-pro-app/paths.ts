/**
 * Disposable routes for the Public Site + Professional App prototype.
 * Public education and clinician resources stay on the site shell.
 * The professional workspace is a separate application shell.
 */

export const PUBLIC_SITE_PRO_APP_PATH = "/ux-lab/public-site-pro-app" as const;

export const PRO_APP_PATH = `${PUBLIC_SITE_PRO_APP_PATH}/app` as const;

export const PUBLIC_SITE_HOME = PUBLIC_SITE_PRO_APP_PATH;

export const PUBLIC_EDUCATION_PATH =
  `${PUBLIC_SITE_PRO_APP_PATH}/education` as const;

export const PUBLIC_CLINICIANS_PATH =
  `${PUBLIC_SITE_PRO_APP_PATH}/clinicians` as const;

export const PRO_EVIDENCE_PATH = `${PRO_APP_PATH}/evidence` as const;

export const PRO_INVESTIGATION_PATH = `${PRO_APP_PATH}/investigation` as const;

export const OPEN_ATLAS_LABEL = "Open Atlas for Public Health";

export const RETURN_TO_PUBLIC_SITE_LABEL = "Return to public site";

type RouteMatch = "exact" | "prefix";

export type PrototypeRoute = {
  href: string;
  id: string;
  label: string;
  match: RouteMatch;
};

export const PUBLIC_SITE_NAV = [
  {
    href: PUBLIC_SITE_HOME,
    id: "home",
    label: "Home",
    match: "exact",
  },
  {
    href: PUBLIC_EDUCATION_PATH,
    id: "education",
    label: "Education and local context",
    match: "prefix",
  },
  {
    href: PUBLIC_CLINICIANS_PATH,
    id: "clinicians",
    label: "Clinician resources",
    match: "prefix",
  },
] as const satisfies readonly PrototypeRoute[];

export const PRO_APP_NAV = [
  {
    href: PRO_APP_PATH,
    id: "overview",
    label: "Workspace overview",
    match: "exact",
  },
  {
    href: PRO_EVIDENCE_PATH,
    id: "evidence",
    label: "Evidence review",
    match: "prefix",
  },
  {
    href: PRO_INVESTIGATION_PATH,
    id: "investigation",
    label: "Investigation reference",
    match: "prefix",
  },
] as const satisfies readonly PrototypeRoute[];

export function isPrototypeRouteActive(
  route: Pick<PrototypeRoute, "href" | "match">,
  pathname: string
): boolean {
  switch (route.match) {
    case "exact": {
      return pathname === route.href;
    }
    case "prefix": {
      return pathname === route.href || pathname.startsWith(`${route.href}/`);
    }
    default: {
      const exhaustive: never = route.match;
      return exhaustive;
    }
  }
}
