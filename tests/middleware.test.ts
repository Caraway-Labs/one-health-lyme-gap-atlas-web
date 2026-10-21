// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FRONT_PORCH_SESSION_HEADER } from "@/lib/auth/front-porch-session-header";

type CookieToSet = {
  name: string;
  options?: { path?: string };
  value: string;
};

const getUser = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const createServerClient = vi.hoisted(() =>
  vi.fn<
    (
      url: string,
      key: string,
      options: {
        cookies: {
          getAll: () => unknown;
          setAll: (cookies: CookieToSet[]) => void;
        };
      }
    ) => { auth: { getUser: typeof getUser } }
  >()
);

vi.mock(
  import("@supabase/ssr"),
  () =>
    ({
      createServerClient,
    }) as never
);

import { installedWorkspaceRedirect } from "@/features/ux-reset/workspace-route-migration";
import { config as middlewareConfig, middleware } from "@/middleware";

const SESSION_REQUEST_HEADER = `x-middleware-request-${FRONT_PORCH_SESSION_HEADER}`;

function atlasRequest(path: string, spoofSignedIn = false) {
  return new NextRequest(new URL(path, "http://localhost"), {
    headers: spoofSignedIn ? { [FRONT_PORCH_SESSION_HEADER]: "1" } : undefined,
  });
}

describe("front porch session middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getUser.mockReset();
    createServerClient.mockReset();
  });

  it("refreshes a signed-in Front Porch visitor and overwrites a spoofed header", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            getAll: () => unknown;
            setAll: (cookies: CookieToSet[]) => void;
          };
        }
      ) => {
        options.cookies.getAll();
        options.cookies.setAll([
          { name: "sb-access", options: { path: "/" }, value: "refreshed" },
        ]);
        return { auth: { getUser } };
      }
    );

    const response = await middleware(atlasRequest("/", true));

    expect(response.headers.get(SESSION_REQUEST_HEADER)).toBe("1");
    expect(response.cookies.get("sb-access")?.value).toBe("refreshed");
    expect(response.status).toBe(200);
  });

  it("redirects a legacy Front Porch analytical query to Atlas Explorer", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            getAll: () => unknown;
            setAll: (cookies: CookieToSet[]) => void;
          };
        }
      ) => {
        options.cookies.getAll();
        options.cookies.setAll([
          { name: "sb-access", options: { path: "/" }, value: "refreshed" },
        ]);
        return { auth: { getUser } };
      }
    );

    const response = await middleware(
      atlasRequest("/?county=08001&state=CO", true)
    );

    expect(response.cookies.get("sb-access")?.value).toBe("refreshed");
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost/explore?scope=CO&county=08001"
    );
  });

  it("treats a Front Porch refresh error as signed out", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    getUser.mockRejectedValue(new Error("refresh failed"));
    createServerClient.mockReturnValue({ auth: { getUser } });

    const response = await middleware(atlasRequest("/"));

    expect(response.headers.get(SESSION_REQUEST_HEADER)).toBe("0");
  });

  it("rethrows a refresh error on a professional route", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    getUser.mockRejectedValue(new Error("refresh failed"));
    createServerClient.mockReturnValue({ auth: { getUser } });

    await expect(middleware(atlasRequest("/app/review"))).rejects.toThrow(
      "refresh failed"
    );
  });

  it("redirects an unauthenticated workspace request and keeps refreshed cookies", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    getUser.mockResolvedValue({ data: { user: null } });
    createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: {
          cookies: {
            getAll: () => unknown;
            setAll: (cookies: CookieToSet[]) => void;
          };
        }
      ) => {
        options.cookies.getAll();
        options.cookies.setAll([
          { name: "sb-access", options: { path: "/" }, value: "refreshed" },
        ]);
        return { auth: { getUser } };
      }
    );

    const response = await middleware(atlasRequest("/app/review"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/sign-in?next=%2Fapp%2Freview"
    );
    expect(response.cookies.get("sb-access")?.value).toBe("refreshed");
  });

  it("permanently redirects the retired AI page before the auth gate", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    vi.stubEnv("NODE_ENV", "production");

    const visits = [
      {
        path: "/app/ai-responsible-use",
        signedIn: false,
        target: "http://localhost/ai-ethics",
      },
      {
        path: "/app/ai-responsible-use/",
        signedIn: false,
        target: "http://localhost/ai-ethics",
      },
      {
        path: "/app/ai-responsible-use?from=bookmark",
        signedIn: false,
        target: "http://localhost/ai-ethics?from=bookmark",
      },
      {
        path: "/app/ai-responsible-use/?from=bookmark",
        signedIn: false,
        target: "http://localhost/ai-ethics?from=bookmark",
      },
      {
        path: "/app/ai-responsible-use",
        signedIn: true,
        target: "http://localhost/ai-ethics",
      },
      {
        path: "/app/ai-responsible-use?from=workspace",
        signedIn: true,
        target: "http://localhost/ai-ethics?from=workspace",
      },
    ] as const;

    const observed = [];
    for (const visit of visits) {
      getUser.mockResolvedValue({
        data: { user: visit.signedIn ? { id: "user-1" } : null },
      });
      createServerClient.mockReturnValue({ auth: { getUser } });
      const response = await middleware(atlasRequest(visit.path));
      observed.push({
        location: response.headers.get("location"),
        path: visit.path,
        robots: response.headers.get("x-robots-tag"),
        signedIn: visit.signedIn,
        status: response.status,
      });
      expect(createServerClient).not.toHaveBeenCalled();
      createServerClient.mockClear();
      getUser.mockClear();
    }

    expect(observed).toStrictEqual(
      visits.map((visit) => ({
        location: visit.target,
        path: visit.path,
        robots: "noindex, nofollow",
        signedIn: visit.signedIn,
        status: 308,
      }))
    );
    expect(
      observed.every((visit) => !visit.location?.includes("sign-in"))
    ).toBeTruthy();
  });

  it("serves the public About page without a sign-in redirect", async () => {
    expect(middlewareConfig.matcher).toStrictEqual([
      "/",
      "/app",
      "/app/:path*",
      "/overview",
      "/geographic_explorer",
      "/investigate",
      "/explore",
      "/explore/:path*",
      "/compare",
      "/compare/:path*",
      "/askatlas",
      "/askatlas/:path*",
      "/data-provenance",
      "/data-provenance/:path*",
    ]);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    getUser.mockResolvedValue({ data: { user: null } });
    createServerClient.mockReturnValue({ auth: { getUser } });

    const response = await middleware(atlasRequest("/about/caraway-labs"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps an unauthenticated alias on the sign-in return path", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    vi.stubEnv("NODE_ENV", "production");
    getUser.mockResolvedValue({ data: { user: null } });
    createServerClient.mockReturnValue({ auth: { getUser } });

    const response = await middleware(
      atlasRequest("/app/explore?scope=NY&county=36061&metric=lyme_cases")
    );

    expect({
      location: response.headers.get("location"),
      robots: response.headers.get("x-robots-tag"),
      status: response.status,
    }).toStrictEqual({
      location:
        "http://localhost/auth/sign-in?next=%2Fapp%2Fexplore%3Fscope%3DNY%26county%3D36061%26metric%3Dlyme_cases",
      robots: "noindex, nofollow",
      status: 307,
    });
  });

  it("redirects signed-in aliases once and does not loop or invent a county", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    createServerClient.mockReturnValue({ auth: { getUser } });

    const cases = [
      ["/app", "/explore"],
      ["/app/explore?scope=NY&county=36061", "/explore?scope=NY&county=36061"],
      ["/app/investigate?county=08001", "/explore?county=08001&mode=evidence"],
      ["/app/investigate", "/explore"],
      ["/app/action?county=08001", "/explore?county=08001&mode=follow-up"],
      ["/app/action?county=08001&plan=evidence-brief", null],
      ["/app/action", "/explore"],
      ["/overview?county=08001&state=CO", "/explore?scope=CO&county=08001"],
      [
        "/geographic_explorer?selected=06037,06059",
        "/explore?compare=06037%2C06059",
      ],
      ["/investigate?county=not-a-county", "/explore?selection=required"],
      ["/app/explore?metric=reported-cases&scope=CO", "/explore?scope=CO"],
      [
        "/app/review?scope=CO&county=08001&sort=score",
        "/explore?scope=CO&county=08001&sort=score",
      ],
      [
        "/app/compare?compare=08001,08013&return=review&mode=evidence",
        "/compare?compare=08001%2C08013&return=review&mode=evidence",
      ],
      [
        "/app/assistant?conversation=abc&page_ref=kept",
        "/askatlas?conversation=abc",
      ],
      ["/explore?scope=CO", null],
      ["/compare?compare=08001,08013", null],
      ["/askatlas", null],
      ["/app/feed", null],
      ["/app/settings", null],
      ["/variant_1", null],
      ["/assistant?conversation=abc", null],
    ] as const;

    const observed = [];
    for (const [path, target] of cases) {
      const response = await middleware(atlasRequest(path));
      const installed = installedWorkspaceRedirect({
        pathname: path.split("?")[0] ?? path,
        searchParams: new URLSearchParams(path.split("?")[1] ?? ""),
      });
      const followUp =
        target === null ? null : await middleware(atlasRequest(target));
      observed.push({
        followUp: followUp?.status ?? null,
        installedHref: installed?.href ?? null,
        installedStatus: installed?.status ?? null,
        location: response.headers.get("location"),
        path,
        robots: response.headers.get("x-robots-tag"),
        status: response.status,
      });
    }
    expect(observed).toStrictEqual(
      cases.map(([path, target]) => {
        const pathname = path.split("?")[0] ?? path;
        const workspace = pathname === "/app" || pathname.startsWith("/app/");
        return {
          followUp: target === null ? null : 200,
          installedHref: target,
          installedStatus: target === null ? null : 308,
          location: target === null ? null : `http://localhost${target}`,
          path,
          robots:
            workspace ||
            pathname === "/explore" ||
            pathname === "/compare" ||
            pathname === "/askatlas"
              ? "noindex, nofollow"
              : null,
          status: target === null ? 200 : 308,
        };
      })
    );
  });

  it("sends an unauthenticated canonical workspace URL to sign-in without a permanent redirect", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("ATLAS_E2E", "0");
    vi.stubEnv("NODE_ENV", "production");
    getUser.mockResolvedValue({ data: { user: null } });
    createServerClient.mockReturnValue({ auth: { getUser } });

    const response = await middleware(
      atlasRequest("/explore?scope=CO&county=08001")
    );

    expect({
      location: response.headers.get("location"),
      robots: response.headers.get("x-robots-tag"),
      status: response.status,
    }).toStrictEqual({
      location:
        "http://localhost/auth/sign-in?next=%2Fexplore%3Fscope%3DCO%26county%3D08001",
      robots: "noindex, nofollow",
      status: 307,
    });
  });

  it("serves the Front Porch without Supabase configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const response = await middleware(atlasRequest("/", true));

    expect(createServerClient).not.toHaveBeenCalled();
    expect(response.headers.get(SESSION_REQUEST_HEADER)).toBe("0");
  });
});
