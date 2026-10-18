import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageIntroduction } from "@/features/ux-reset/page-introduction";
import { PAGE_INTRODUCTION_COPY } from "@/features/ux-reset/page-introduction-copy";

describe("page introduction", () => {
  it("renders the approved Explorer copy", () => {
    render(<PageIntroduction page="explorer" />);
    const copy = PAGE_INTRODUCTION_COPY.explorer;
    expect(
      screen.getByRole("heading", { level: 1, name: copy.headline })
    ).toBeTruthy();
    const introduction = screen.getByTestId("page-introduction-explorer");
    expect(introduction.textContent).toContain(copy.supporting);
    expect(introduction.textContent).toContain(
      `${copy.guidanceLead} ${copy.guidance}`
    );
    expect(introduction.textContent).not.toContain(
      "From data to better decisions"
    );
    expect(introduction.textContent).not.toMatch(/environmental evidence/i);
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
    expect(screen.getByText(copy.stripBody)).toBeTruthy();
  });
});
