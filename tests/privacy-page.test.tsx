import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";

describe("public privacy page", () => {
  afterEach(cleanup);

  it("keeps public exploration and the privacy page outside the professional workspace", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { name: "Privacy without the fine print." })
    ).toBeTruthy();
    expect(
      screen.getByText(/This Privacy page stays public either way/)
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Return to the Atlas" })
        .getAttribute("href")
    ).toBe("/#atlas");
  });

  it("qualifies analytics, assistant storage, and account controls against current behavior", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(
        /professional workspace does not start that analytics SDK/
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Ask Atlas uses that same browser store and does not keep a separate saved-chat library/
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        /This page does not state how long the API keeps a question/
      )
    ).toBeTruthy();
    expect(
      screen.getAllByText(/from Account and from professional Settings/).length
    ).toBeGreaterThan(0);
  });

  it("does not describe the professional workspace as an unlaunched saved workspace", () => {
    render(<PrivacyPage />);

    expect(
      screen.getAllByText(
        /does not store saved views, saved investigations, or an artifact library/
      ).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Saved workspaces are not launched/)).toBeNull();
  });
});
