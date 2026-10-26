import { describe, expect, it } from "vitest";

import { docsCanonicalUrl } from "../src/lib/docs-config";
import {
  docsGithubEditHref,
  docsGithubEditPath,
  docsOpenGraphAlt,
  docsOpenGraphImagePath,
  docsPageSocialMetadata,
  docsSectionLabel,
} from "../src/lib/docs-social";

describe("docs social metadata", () => {
  it("maps pages to sidebar sections and GitHub source paths", () => {
    expect({
      api: docsSectionLabel("/docs/api-reference"),
      develop: docsSectionLabel("/docs/develop/quickstart"),
      edit: docsGithubEditHref("glossary.mdx"),
      glossary: docsSectionLabel("/docs/glossary"),
      home: docsSectionLabel("/docs"),
      index: docsGithubEditPath("content/docs/index.mdx"),
      quickstart: docsGithubEditPath("develop/quickstart.mdx"),
    }).toStrictEqual({
      api: "API reference",
      develop: "Developers",
      edit: "https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/blob/main/content/docs/glossary.mdx",
      glossary: "Product guide",
      home: "Product guide",
      index: "content/docs/index.mdx",
      quickstart: "content/docs/develop/quickstart.mdx",
    });
  });

  it("builds Open Graph URLs on the docs origin, including when the site is a preview", () => {
    const previewPinned = {
      NEXT_PUBLIC_DOCS_URL: "https://onehealthatlas.org/docs",
      NEXT_PUBLIC_SITE_URL: "https://preview.example",
    };
    const metadata = docsPageSocialMetadata(
      {
        description: "Terms used by the API.",
        title: "Glossary",
        url: "/docs/glossary",
      },
      previewPinned
    );
    const image = docsCanonicalUrl(
      "/docs/og/glossary/image.png",
      previewPinned
    );

    expect({
      alt: docsOpenGraphAlt("Glossary", "Product guide"),
      canonical: metadata.alternates,
      homeImage: docsOpenGraphImagePath("/docs"),
      imageHost: new URL(image).host,
      openGraph: metadata.openGraph?.url,
      images: metadata.openGraph?.images,
      quickstartImage: docsOpenGraphImagePath("/docs/develop/quickstart"),
      twitter: metadata.twitter,
    }).toMatchObject({
      alt: "Glossary (Product guide) — One Health Atlas documentation",
      canonical: { canonical: "https://onehealthatlas.org/docs/glossary" },
      homeImage: "/docs/og/image.png",
      imageHost: "onehealthatlas.org",
      images: [
        {
          alt: "Glossary (Product guide) — One Health Atlas documentation",
          height: 630,
          url: image,
          width: 1200,
        },
      ],
      openGraph: "https://onehealthatlas.org/docs/glossary",
      quickstartImage: "/docs/og/develop/quickstart/image.png",
      twitter: {
        card: "summary_large_image",
        images: [
          {
            alt: "Glossary (Product guide) — One Health Atlas documentation",
            height: 630,
            url: image,
            width: 1200,
          },
        ],
      },
    });
  });

  it("follows a preview docs URL when that origin is configured", () => {
    const preview = {
      NEXT_PUBLIC_DOCS_URL: "https://preview.example/docs",
      NEXT_PUBLIC_SITE_URL: "https://preview.example",
    };
    const metadata = docsPageSocialMetadata(
      { title: "Quickstart", url: "/docs/develop/quickstart" },
      preview
    );
    expect(metadata.openGraph?.url).toBe(
      "https://preview.example/docs/develop/quickstart"
    );
    expect(metadata.openGraph?.images).toStrictEqual([
      expect.objectContaining({
        url: "https://preview.example/docs/og/develop/quickstart/image.png",
      }),
    ]);
  });
});
