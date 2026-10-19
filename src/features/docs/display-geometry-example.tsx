import { DISPLAY_GEOMETRY_PATH } from "@/lib/endpoint-delivery";
import {
  getPublishedApiOrigin,
  type PublicOriginEnvironment,
} from "@/lib/public-origins";

export function displayGeometryUrl(
  environment?: PublicOriginEnvironment
): string {
  return new URL(
    DISPLAY_GEOMETRY_PATH,
    `${getPublishedApiOrigin(environment)}/`
  ).href;
}

export function displayGeometryCurl(
  environment?: PublicOriginEnvironment
): string {
  return `curl -fsS '${displayGeometryUrl(environment)}'`;
}

export function DisplayGeometryCurl() {
  return (
    <pre className="border-border bg-muted my-4 rounded-lg border p-4 text-sm break-all whitespace-pre-wrap">
      <code>{displayGeometryCurl()}</code>
    </pre>
  );
}
