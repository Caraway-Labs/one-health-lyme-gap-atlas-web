import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
