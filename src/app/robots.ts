import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/public-origins";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { allow: "/", userAgent: "*" },
    sitemap: new URL("/sitemap.xml", getSiteOrigin()).href,
  };
}
