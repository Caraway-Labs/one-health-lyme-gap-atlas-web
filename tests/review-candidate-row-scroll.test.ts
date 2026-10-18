import { describe, expect, it } from "vitest";

import { alignCandidateRow } from "@/features/ux-reset/review/review-candidate-row-scroll";

function box(top: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: 100,
    top,
    width: 100,
    x: 0,
    y: top,
    toJSON() {
      return {};
    },
  };
}

function pair(
  listBox: DOMRect,
  rowBox: DOMRect,
  clientHeight = listBox.height
) {
  const list = document.createElement("div");
  const row = document.createElement("button");
  list.getBoundingClientRect = () => listBox;
  row.getBoundingClientRect = () => rowBox;
  Object.defineProperty(list, "clientHeight", { value: clientHeight });
  return { list, row };
}

describe("selected county row alignment", () => {
  it("does nothing when the row or list has no height", () => {
    const { list, row } = pair(box(0, 200), box(10, 0), 0);
    list.scrollTop = 4;
    alignCandidateRow(list, row);
    expect(list.scrollTop).toBe(4);
  });

  it("pins a row taller than the list to the list top", () => {
    const { list, row } = pair(box(100, 80), box(140, 120));
    alignCandidateRow(list, row);
    expect(list.scrollTop).toBe(40);
  });

  it("scrolls a row that starts above the list into view", () => {
    const { list, row } = pair(box(100, 200), box(70, 40));
    list.scrollTop = 50;
    alignCandidateRow(list, row);
    expect(list.scrollTop).toBe(20);
  });

  it("scrolls a row that ends below the list into view", () => {
    const { list, row } = pair(box(100, 200), box(280, 40));
    alignCandidateRow(list, row);
    expect(list.scrollTop).toBe(20);
  });

  it("leaves a row that already fits", () => {
    const { list, row } = pair(box(100, 200), box(120, 40));
    alignCandidateRow(list, row);
    expect(list.scrollTop).toBe(0);
  });
});
