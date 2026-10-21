import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Playwright mobile clicks land in the footer. The default bottom-left
  // Next.js indicator uses nextjs-portal and intercepts those pointer events
  // even when no runtime error exists (see #126). Hide it only for E2E.
  devIndicators: process.env.ATLAS_E2E === "1" ? false : undefined,
  async rewrites() {
    return [
      {
        destination: "/llms.mdx/docs/content.md",
        source: "/docs.md",
      },
      {
        destination: "/llms.mdx/docs/content.mdx",
        source: "/docs.mdx",
      },
      {
        destination: "/llms.mdx/docs/:slug*/content.md",
        source: "/docs/:slug*.md",
      },
      {
        destination: "/llms.mdx/docs/:slug*/content.mdx",
        source: "/docs/:slug*.mdx",
      },
    ];
  },
  async redirects() {
    return [
      ...[
        "www.onehealthatlas.org",
        "onehealthatlas.com",
        "www.onehealthatlas.com",
        "onehealthatlas.ai",
        "www.onehealthatlas.ai",
      ].map((host) => ({
        destination: "https://onehealthatlas.org/:path*",
        has: [{ type: "host" as const, value: host }],
        permanent: true,
        source: "/:path*",
      })),
      {
        destination: "https://carawaylabs.com/:path*",
        has: [{ type: "host", value: "www.carawaylabs.com" }],
        permanent: true,
        source: "/:path*",
      },
      // Retired signed-in trust page (issue 811). This runs before middleware,
      // so a signed-out visit never reaches the auth gate.
      {
        destination: "/ai-ethics",
        permanent: true,
        source: "/app/ai-responsible-use",
      },
      {
        destination: "/ai-ethics",
        permanent: true,
        source: "/app/ai-responsible-use/",
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
