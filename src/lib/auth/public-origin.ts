/**
 * Resolves redirects to the public Atlas origin instead of the internal
 * container listener exposed to Next.js behind App Platform's proxy.
 */
export function publicOrigin(request: Request): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredOrigin) return new URL(configuredOrigin).origin;
  return new URL(request.url).origin;
}
