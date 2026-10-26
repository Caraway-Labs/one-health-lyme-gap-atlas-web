import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  import("next/og"),
  () =>
    ({
      ImageResponse: class ImageResponse {
        readonly element: ReactElement;
        readonly options: { height: number; width: number };

        constructor(
          element: ReactElement,
          options: { height: number; width: number }
        ) {
          this.element = element;
          this.options = options;
        }
      },
    }) as unknown as typeof import("next/og")
);

const { GET, generateStaticParams } =
  await import("../src/app/docs/og/[...slug]/route");

describe("docs open graph route", () => {
  it("builds a branded card for a docs page and a home image", async () => {
    const glossary = await GET(
      new Request("http://127.0.0.1/docs/og/glossary/image.png"),
      {
        params: Promise.resolve({ slug: ["glossary", "image.png"] }),
      }
    );
    const home = await GET(new Request("http://127.0.0.1/docs/og/image.png"), {
      params: Promise.resolve({ slug: ["image.png"] }),
    });
    const unsuffixed = await GET(
      new Request("http://127.0.0.1/docs/og/glossary"),
      {
        params: Promise.resolve({ slug: ["glossary"] }),
      }
    );
    const card = glossary as unknown as {
      element: ReactElement<{
        section: string;
        title: string;
        markSrc: string;
      }>;
      options: { height: number; width: number };
    };

    expect({
      height: card.options.height,
      home: home.constructor.name,
      mark: card.element.props.markSrc.startsWith("data:image/png;base64,"),
      section: card.element.props.section,
      title: card.element.props.title,
      unsuffixed: unsuffixed.constructor.name,
      width: card.options.width,
    }).toMatchObject({
      height: 630,
      home: "ImageResponse",
      mark: true,
      section: "Product guide",
      unsuffixed: "ImageResponse",
      width: 1200,
    });
    expect(generateStaticParams()).toContainEqual({
      slug: ["glossary", "image.png"],
    });
  });

  it("returns not found for an unknown docs slug", async () => {
    const missing = await GET(
      new Request("http://127.0.0.1/docs/og/missing/image.png"),
      {
        params: Promise.resolve({ slug: ["missing-docs-page", "image.png"] }),
      }
    );

    expect(missing).toBeInstanceOf(Response);
    expect(missing.status).toBe(404);
  });
});
