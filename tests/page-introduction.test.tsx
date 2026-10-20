import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageIntroduction } from "@/features/ux-reset/page-introduction";
import { PAGE_INTRODUCTION_COPY } from "@/features/ux-reset/page-introduction-copy";

describe("page introduction", () => {
  it("renders the approved Explorer copy", () => {
    render(<PageIntroduction page="explorer" />);
    const copy = PAGE_INTRODUCTION_COPY.explorer;
    const introduction = screen.getByTestId("page-introduction-explorer");
    const text = introduction.textContent ?? "";
    expect({
      count: screen.getAllByTestId("page-introduction-explorer").length,
      environmental: /environmental evidence/i.test(text),
      eyebrow: text.includes(copy.eyebrow),
      headline: screen.getByRole("heading", { level: 1 }).textContent,
      helper: text.includes(copy.helper),
      qualifier: text.includes(copy.scoreQualifier),
      oldBanner: text.includes("Explore potential Lyme surveillance gaps"),
      oldHeadline: text.includes("Explore the One Health Atlas"),
      oldMarketing: text.includes("From data to better decisions"),
      scoreBody: text.includes(copy.scoreBody),
      scoreHeading: screen.getByRole("heading", { level: 2 }).textContent,
      supporting: text.includes(copy.supporting),
    }).toStrictEqual({
      count: 1,
      environmental: false,
      eyebrow: true,
      headline: copy.headline,
      helper: true,
      qualifier: true,
      oldBanner: false,
      oldHeadline: false,
      oldMarketing: false,
      scoreBody: true,
      scoreHeading: copy.scoreHeading,
      supporting: true,
    });
  });

  it("renders the approved Compare copy", () => {
    render(<PageIntroduction page="compare" />);
    const copy = PAGE_INTRODUCTION_COPY.compare;
    expect(
      screen.getByRole("heading", { level: 1, name: copy.headline })
    ).toBeTruthy();
    expect(screen.getByText(copy.supporting)).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: copy.stripHeading })
    ).toBeNull();
    expect(screen.queryByText(copy.stripBody)).toBeNull();
  });
});
