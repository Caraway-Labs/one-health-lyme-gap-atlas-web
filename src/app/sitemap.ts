import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "monthly",
      lastModified: "2026-09-13",
      priority: 0.8,
      url: "https://carawaylabs.com/docs",
    },
  ];
}
