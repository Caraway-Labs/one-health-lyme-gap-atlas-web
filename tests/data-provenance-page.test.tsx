import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataProvenancePage } from "@/features/public-trust/data-provenance-page";
import {
  dataProvenanceContent,
  dataProvenanceVisibleCountLabel,
} from "@/lib/data-provenance-content";

const BANNED = ["Not provided", "Planned", "conceptual", "governed-"] as const;

function headingLevels() {
  return [...document.querySelectorAll("h1, h2, h3")].map((heading) =>
    Number(heading.tagName.slice(1))
  );
}

describe("Data Provenance page", () => {
  afterEach(cleanup);

  it("renders one H1 and a logical heading order", () => {
    render(<DataProvenancePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Where Atlas evidence comes from",
      })
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    const levels = headingLevels();
    const skipped = levels.find(
      (level, index) => index > 0 && level > (levels[index - 1] ?? 0) + 1
    );
    expect({
      first: levels[0],
      headings: screen.getAllByRole("heading", { level: 1 }).length,
      skipped,
    }).toStrictEqual({
      first: 1,
      headings: 1,
      skipped: undefined,
    });
  });

  it("names every source, the attribution, and the approved closing copy", () => {
    render(<DataProvenancePage />);

    for (const item of dataProvenanceContent.datasets) {
      screen.getByRole("heading", { level: 3, name: item.name });
      const card = document.querySelector(`#${item.anchorId}`);
      const link =
        card instanceof HTMLElement ? within(card).getByRole("link") : null;
      expect({
        href: link?.getAttribute("href"),
        name: link?.textContent?.includes(item.name),
        source: link?.textContent?.includes(
          `Visit the source, ${item.sourceLabel}`
        ),
      }).toStrictEqual({
        href: item.sourceUrl,
        name: true,
        source: true,
      });
    }
    screen.getByText(dataProvenanceContent.attribution);
    screen.getByText(dataProvenanceContent.bulletinNote);
    screen.getByRole("link", { name: "Return to the Atlas" });
    expect(
      screen.getByLabelText("Data Provenance document version").textContent
    ).toContain("Version 1.0.0");
  });

  it("announces the full catalog before a filter is chosen", () => {
    render(<DataProvenancePage />);
    const live = screen.getByText(
      dataProvenanceVisibleCountLabel(dataProvenanceContent.datasets.length)
    );
    expect({
      live: live.getAttribute("aria-live"),
      pressed: screen
        .getByRole("button", { name: "All (20)" })
        .getAttribute("aria-pressed"),
      text: live.textContent,
    }).toStrictEqual({
      live: "polite",
      pressed: "true",
      text: dataProvenanceVisibleCountLabel(20),
    });
  });

  it("shows the ten bulletin cards when that filter is pressed", () => {
    render(<DataProvenancePage />);
    const bulletins = screen.getByRole("button", {
      name: "Public-health bulletins (10)",
    });
    fireEvent.click(bulletins);
    expect({
      lyme: screen.queryByRole("heading", {
        name: "Lyme disease surveillance",
      }),
      mmwr: screen.getByRole("heading", {
        name: "Morbidity and Mortality Weekly Report (MMWR)",
      }).textContent,
      note: screen.getByText(dataProvenanceContent.bulletinNote).textContent,
      pressed: bulletins.getAttribute("aria-pressed"),
      text: screen.getByText(dataProvenanceVisibleCountLabel(10)).textContent,
    }).toStrictEqual({
      lyme: null,
      mmwr: "Morbidity and Mortality Weekly Report (MMWR)",
      note: dataProvenanceContent.bulletinNote,
      pressed: "true",
      text: dataProvenanceVisibleCountLabel(10),
    });
  });

  it("returns every card when All is pressed again", () => {
    render(<DataProvenancePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Human surveillance (1)" })
    );
    const all = screen.getByRole("button", { name: "All (20)" });
    fireEvent.click(all);
    expect({
      cards: dataProvenanceContent.datasets.every(
        (item) =>
          document.querySelector(`#${item.anchorId}`) instanceof HTMLElement
      ),
      note: screen.getByText(dataProvenanceContent.bulletinNote).textContent,
      pressed: all.getAttribute("aria-pressed"),
      text: screen.getByText(dataProvenanceVisibleCountLabel(20)).textContent,
    }).toStrictEqual({
      cards: true,
      note: dataProvenanceContent.bulletinNote,
      pressed: "true",
      text: dataProvenanceVisibleCountLabel(20),
    });
  });

  it("does not render retired catalog wording", () => {
    render(<DataProvenancePage />);
    const text = document.body.textContent ?? "";
    expect(BANNED.filter((phrase) => text.includes(phrase))).toStrictEqual([]);
    expect(screen.queryByText(/No governed measure/)).toBeNull();
  });
});
