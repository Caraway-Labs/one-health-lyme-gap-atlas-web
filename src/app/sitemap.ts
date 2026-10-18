import type { MetadataRoute } from "next";

import { getDocsUrl } from "@/lib/public-origins";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "monthly",
      lastModified: "2026-09-13",
      priority: 0.8,
      url: getDocsUrl(),
    },
  ];
}
