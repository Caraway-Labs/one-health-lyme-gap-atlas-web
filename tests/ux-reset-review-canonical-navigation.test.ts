import { describe, expect, it } from "vitest";

import {
  followPendingReviewDestination,
  leavingReviewDestination,
} from "@/features/ux-reset/review/review-canonical-navigation";

const modifiers = {
  altKey: false,
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

describe("Review canonical navigation", () => {
  it("follows Investigate when a scope rewrite is still on Review", () => {
    document.body.innerHTML =
      '<a id="investigate" href="/app/investigate?scope=ALL&dataset=alpha">Investigate</a>';
    const destination = leavingReviewDestination(
      document.querySelector("#investigate"),
      "/explore",
      "http://localhost/explore?scope=state&county=bad&period=2024&dataset=alpha",
      modifiers
    );
    expect({
      destination,
      followed: followPendingReviewDestination({
        destination,
        pathname: "/explore",
        reviewPath: "/explore",
      }),
      modifier: leavingReviewDestination(
        document.querySelector("#investigate"),
        "/explore",
        "http://localhost/explore?scope=state",
        { ...modifiers, metaKey: true }
      ),
      settled: followPendingReviewDestination({
        destination,
        pathname: "/app/investigate",
        reviewPath: "/explore",
      }),
    }).toStrictEqual({
      destination: "/app/investigate?scope=ALL&dataset=alpha",
      followed: "/app/investigate?scope=ALL&dataset=alpha",
      modifier: null,
      settled: null,
    });
  });
});
