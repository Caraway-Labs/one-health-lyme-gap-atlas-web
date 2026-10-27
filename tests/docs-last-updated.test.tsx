// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { DocsLastUpdated } from "@/components/docs-last-updated";

describe("docs last updated", () => {
  afterEach(() => {
    cleanup();
  });

  it("includes the formatted date in the first render", () => {
    const date = new Date("2026-10-26T11:00:54Z");
    const { container } = render(<DocsLastUpdated date={date} />);
    const line = container.querySelector("p");
    expect(line?.textContent).toBe(
      `Last updated on ${date.toLocaleDateString()}`
    );
    expect(line?.querySelector("time")).toHaveAttribute(
      "dateTime",
      date.toISOString()
    );
  });
});
