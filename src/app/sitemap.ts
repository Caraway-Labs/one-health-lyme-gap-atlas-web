import type { MetadataRoute } from "next";

import { getDocsUrl, getSiteOrigin } from "@/lib/public-origins";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  return [
    {
      changeFrequency: "monthly",
      lastModified: "2026-09-13",
      priority: 0.8,
      url: getDocsUrl(),
    },
    {
      changeFrequency: "monthly",
      priority: 0.4,
      url: new URL("/llms.txt", origin).href,
    },
    {
      changeFrequency: "monthly",
      priority: 0.4,
      url: new URL("/llms-full.txt", origin).href,
    },
    {
      changeFrequency: "monthly",
      priority: 0.5,
      url: new URL("/data-provenance", origin).href,
    },
    {
      changeFrequency: "monthly",
      priority: 0.5,
      url: new URL("/resources", origin).href,
    },
  ];
}
