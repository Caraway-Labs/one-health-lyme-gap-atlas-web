import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { allow: "/", disallow: "/app", userAgent: "*" },
    sitemap: "https://onehealthatlas.org/sitemap.xml",
  };
}
