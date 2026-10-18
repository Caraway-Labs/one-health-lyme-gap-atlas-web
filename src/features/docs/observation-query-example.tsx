import {
  getPublishedApiOrigin,
  type PublicOriginEnvironment,
} from "@/lib/public-origins";

export function observationRequestUrl(
  query: string,
  environment?: PublicOriginEnvironment
): string {
  const origin = getPublishedApiOrigin(environment);
  const url = new URL("/v1/observations", `${origin}/`);
  url.search = query;
  return url.href;
}

export function observationCurl(
  query: string,
  environment?: PublicOriginEnvironment
): string {
  return `curl -fsS '${observationRequestUrl(query, environment)}'`;
}

export function ObservationCurl({ query }: { query: string }) {
  return (
    <pre className="border-border bg-muted my-4 rounded-lg border p-4 text-sm break-all whitespace-pre-wrap">
      <code>{observationCurl(query)}</code>
    </pre>
  );
}

export function publishedGetUrl(
  path: string,
  environment?: PublicOriginEnvironment
): string {
  const origin = getPublishedApiOrigin(environment);
  return new URL(path, `${origin}/`).href;
}

export function publishedGetCurl(
  path: string,
  environment?: PublicOriginEnvironment
): string {
  return `curl -fsS '${publishedGetUrl(path, environment)}'`;
}

export function PublishedGetCurl({ path }: { path: string }) {
  return (
    <pre className="border-border bg-muted my-4 rounded-lg border p-4 text-sm break-all whitespace-pre-wrap">
      <code>{publishedGetCurl(path)}</code>
    </pre>
  );
}
