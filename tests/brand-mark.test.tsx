import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { cleanup, render, screen } from "@testing-library/react";
import Link from "next/link";
import { afterEach, describe, expect, it } from "vitest";

import { BrandMark } from "@/components/brand-mark";

describe("canonical product mark", () => {
  afterEach(cleanup);

  it("serves the approved raster unchanged and leaves the product text accessible", () => {
    const { container } = render(
      <Link href="/app/review" aria-label="One Health Atlas">
        <BrandMark size={32} />
      </Link>
    );
    const image = container.querySelector("img");
    expect(
      Object.fromEntries(
        ["src", "alt", "aria-hidden", "width", "height"].map((key) => [
          key,
          image?.getAttribute(key),
        ])
      )
    ).toStrictEqual({
      src: "/android-chrome-192x192.png",
      alt: "",
      "aria-hidden": "true",
      width: "32",
      height: "32",
    });
    expect(screen.getByRole("link", { name: "One Health Atlas" })).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(
      createHash("sha256")
        .update(readFileSync("public/android-chrome-192x192.png"))
        .digest("hex")
    ).toBe("a5ffcfffec0dd7dcb7aafdc143abc99785831ace83820d9636c9f19dd6a9d9ae");
  });
});
