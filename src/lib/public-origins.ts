/**
 * Published site, docs, and API origins.
 *
 * Production defaults are the onehealthatlas hosts. Preview and other
 * deployments replace them with NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_DOCS_URL,
 * and NEXT_PUBLIC_API_BASE_URL. Problem-type URIs stay on the host published
 * in the OpenAPI examples.
 */

export const PRODUCTION_SITE_ORIGIN = "https://onehealthatlas.org";
export const PRODUCTION_API_ORIGIN = "https://api.onehealthatlas.org";
export const PRODUCTION_DOCS_URL = "https://onehealthatlas.org/docs";

const LEGACY_API_ORIGINS = ["https://api.carawaylabs.com"] as const;
const LEGACY_DOCS_URLS = [
  "https://www.carawaylabs.com/docs",
  "https://carawaylabs.com/docs",
  "https://www.onehealthatlas.org/docs",
] as const;
const LEGACY_SITE_ORIGINS = [
  "https://www.carawaylabs.com",
  "https://carawaylabs.com",
  "https://www.onehealthatlas.org",
] as const;

const PROBLEM_TYPE_URL =
  /https:\/\/(?:www\.)?carawaylabs\.com\/problems\/[^\s<>)\]"']*/g;

export type PublicOriginEnvironment = {
  NEXT_PUBLIC_API_BASE_URL?: string;
  NEXT_PUBLIC_DOCS_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

export type PublicOrigins = {
  apiOrigin: string;
  docsUrl: string;
  siteOrigin: string;
};

export function resolvePublicOrigins(
  environment?: PublicOriginEnvironment
): PublicOrigins {
  const siteOrigin = parseSiteOrigin(configuredOrigin(environment, "site"));
  const apiOrigin = parseApiOrigin(configuredOrigin(environment, "api"));
  const configuredDocs = configuredOrigin(environment, "docs");
  return {
    apiOrigin,
    docsUrl: configuredDocs
      ? parseDocsUrl(configuredDocs)
      : docsUrlForSite(siteOrigin),
    siteOrigin,
  };
}

export function getSiteOrigin(environment?: PublicOriginEnvironment): string {
  return resolvePublicOrigins(environment).siteOrigin;
}

export function getPublishedApiOrigin(
  environment?: PublicOriginEnvironment
): string {
  return resolvePublicOrigins(environment).apiOrigin;
}

export function getDocsUrl(environment?: PublicOriginEnvironment): string {
  return resolvePublicOrigins(environment).docsUrl;
}

export function getMetadataBase(environment?: PublicOriginEnvironment): URL {
  return new URL(getSiteOrigin(environment));
}

export function openApiDocumentUrl(origins: PublicOrigins): string {
  return new URL("/openapi.json", `${origins.apiOrigin}/`).href;
}

export function rewritePublicOriginText(
  value: string,
  origins: PublicOrigins = resolvePublicOrigins()
): string {
  const masked: string[] = [];
  const protectedValue = value.replace(PROBLEM_TYPE_URL, (match) => {
    const token = `@@ATLAS_PROBLEM_${masked.length}@@`;
    masked.push(match);
    return token;
  });

  let rewritten = protectedValue;
  const apiOrigins = new Set<string>([
    PRODUCTION_API_ORIGIN,
    ...LEGACY_API_ORIGINS,
  ]);
  for (const origin of apiOrigins) {
    if (origin !== origins.apiOrigin) {
      rewritten = rewritten.replaceAll(origin, origins.apiOrigin);
    }
  }

  const docsUrls = new Set<string>([PRODUCTION_DOCS_URL, ...LEGACY_DOCS_URLS]);
  for (const docsUrl of docsUrls) {
    if (docsUrl !== origins.docsUrl) {
      rewritten = replaceUrlPrefix(rewritten, docsUrl, origins.docsUrl);
    }
  }

  // A configured docs URL can still start with a site origin that is about to
  // be replaced, for example production docs on a preview site. Hide those
  // destinations so the site pass cannot rewrite them.
  const protectedDocs: string[] = [];
  rewritten = maskUrlPrefix(rewritten, origins.docsUrl, protectedDocs);

  const siteOrigins = new Set<string>([
    PRODUCTION_SITE_ORIGIN,
    ...LEGACY_SITE_ORIGINS,
  ]);
  for (const origin of siteOrigins) {
    if (origin !== origins.siteOrigin) {
      rewritten = replaceUrlPrefix(rewritten, origin, origins.siteOrigin);
    }
  }

  rewritten = restoreMasked(rewritten, protectedDocs, "@@ATLAS_DOCS_");

  return restoreMasked(rewritten, masked, "@@ATLAS_PROBLEM_");
}

const URL_CONTINUATION = new Set(["#", "/", "?"]);
const URL_TERMINATOR = new Set([")", "]", '"', "'", "<", ">"]);

function replaceUrlPrefix(
  value: string,
  prefix: string,
  replacement: string
): string {
  if (
    prefix.length === 0 ||
    prefix === replacement ||
    !value.includes(prefix)
  ) {
    return value;
  }
  let cursor = 0;
  let result = "";
  while (cursor < value.length) {
    const index = value.indexOf(prefix, cursor);
    if (index === -1) {
      result += value.slice(cursor);
      break;
    }
    result += value.slice(cursor, index);
    if (!hasUrlPrefixBoundary(value, index, prefix)) {
      result += prefix;
      cursor = index + prefix.length;
      continue;
    }
    const end = urlTokenEnd(value, index + prefix.length);
    result += replacement;
    result += value.slice(index + prefix.length, end);
    cursor = end;
  }
  return result;
}

function maskUrlPrefix(
  value: string,
  prefix: string,
  masked: string[]
): string {
  if (prefix.length === 0 || !value.includes(prefix)) return value;
  let cursor = 0;
  let result = "";
  while (cursor < value.length) {
    const index = value.indexOf(prefix, cursor);
    if (index === -1) {
      result += value.slice(cursor);
      break;
    }
    result += value.slice(cursor, index);
    if (!hasUrlPrefixBoundary(value, index, prefix)) {
      result += prefix;
      cursor = index + prefix.length;
      continue;
    }
    const end = urlTokenEnd(value, index);
    const token = `@@ATLAS_DOCS_${masked.length}@@`;
    masked.push(value.slice(index, end));
    result += token;
    cursor = end;
  }
  return result;
}

function hasUrlPrefixBoundary(
  value: string,
  index: number,
  prefix: string
): boolean {
  if (!value.startsWith(prefix, index)) return false;
  const next = value[index + prefix.length];
  if (next === undefined) return true;
  return (
    URL_CONTINUATION.has(next) || URL_TERMINATOR.has(next) || /\s/u.test(next)
  );
}

function urlTokenEnd(value: string, start: number): number {
  let end = start;
  while (end < value.length) {
    const character = value[end] ?? "";
    if (URL_TERMINATOR.has(character) || /\s/u.test(character)) break;
    end += 1;
  }
  return end;
}

function restoreMasked(
  value: string,
  masked: string[],
  tokenPrefix: string
): string {
  let restored = value;
  for (const [index, match] of masked.entries()) {
    restored = restored.replaceAll(`${tokenPrefix}${index}@@`, match);
  }
  return restored;
}

function configuredOrigin(
  environment: PublicOriginEnvironment | undefined,
  kind: "api" | "docs" | "site"
): string | undefined {
  switch (kind) {
    case "api": {
      return environment
        ? environment.NEXT_PUBLIC_API_BASE_URL
        : process.env.NEXT_PUBLIC_API_BASE_URL;
    }
    case "docs": {
      return environment
        ? environment.NEXT_PUBLIC_DOCS_URL
        : process.env.NEXT_PUBLIC_DOCS_URL;
    }
    case "site": {
      return environment
        ? environment.NEXT_PUBLIC_SITE_URL
        : process.env.NEXT_PUBLIC_SITE_URL;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function docsUrlForSite(siteOrigin: string): string {
  const derived = new URL("/docs", `${siteOrigin}/`).href;
  if (new URL(derived).protocol !== "https:") return PRODUCTION_DOCS_URL;
  return derived;
}

function parseSiteOrigin(value: string | undefined): string {
  if (!value) return PRODUCTION_SITE_ORIGIN;
  return parseHttpOrigin(value, "NEXT_PUBLIC_SITE_URL");
}

function parseApiOrigin(value: string | undefined): string {
  if (!value) return PRODUCTION_API_ORIGIN;
  return parseHttpOrigin(value, "NEXT_PUBLIC_API_BASE_URL");
}

function parseHttpOrigin(value: string, label: string): string {
  const parsed = parsedUrl(value, label);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${label} must be an HTTP(S) origin.`);
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new Error(`${label} must be an HTTP(S) origin.`);
  }
  return parsed.origin;
}

function parseDocsUrl(value: string): string {
  const parsed = parsedUrl(value, "NEXT_PUBLIC_DOCS_URL");
  if (parsed.protocol !== "https:" || parsed.pathname !== "/docs") {
    throw new Error("NEXT_PUBLIC_DOCS_URL must be an HTTPS /docs URL.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("NEXT_PUBLIC_DOCS_URL must be an HTTPS /docs URL.");
  }
  return parsed.href;
}

function parsedUrl(value: string, label: string): URL {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`${label} must be an HTTP(S) URL.`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be an HTTP")) {
      throw error;
    }
    throw new Error(`${label} must be an HTTP(S) URL.`, { cause: error });
  }
}
