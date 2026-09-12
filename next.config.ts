import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Playwright mobile clicks land in the footer. The default bottom-left
  // Next.js indicator uses nextjs-portal and intercepts those pointer events
  // even when no runtime error exists (see #126). Hide it only for E2E.
  devIndicators: process.env.ATLAS_E2E === "1" ? false : undefined,
  async redirects() {
    return [
      {
        destination: "/geographic_explorer",
        permanent: true,
        source: "/variant_7",
      },
      {
        destination: "https://carawaylabs.com/:path*",
        has: [{ type: "host", value: "www.carawaylabs.com" }],
        permanent: true,
        source: "/:path*",
      },
    ];
  },
};

export default nextConfig;
