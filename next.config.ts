import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
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
