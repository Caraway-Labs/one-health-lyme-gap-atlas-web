import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.carawaylabs.com" }],
        destination: "https://carawaylabs.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

