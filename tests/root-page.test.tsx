import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  import("@/features/front-porch/front-porch-page"),
  () =>
    ({
      FrontPorchPage: () => <p>Front porch story</p>,
    }) as never
);

import Page from "@/app/page";

describe("public root route", () => {
  it("renders the Front Porch; middleware sends a legacy analytical query to Atlas Explorer", () => {
    render(<Page />);
    expect(screen.getByText("Front porch story").textContent).toBe(
      "Front porch story"
    );
  });
});
