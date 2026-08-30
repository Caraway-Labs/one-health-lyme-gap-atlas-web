import { describe, expect, it } from "vitest";
import { badgeVariants } from "../src/components/ui/badge";
import { buttonVariants } from "../src/components/ui/button";

describe("shared UI primitives", () => {
  it("maps Atlas actions to semantic button variants", () => {
    expect(buttonVariants({ variant: "default" })).toContain("bg-primary");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-secondary");
    expect(buttonVariants({ variant: "ghost" })).toContain("hover:bg-muted");
    expect(buttonVariants({ variant: "destructive" })).toContain("text-destructive");
  });

  it("maps status badges to semantic variants", () => {
    expect(badgeVariants({ variant: "default" })).toContain("bg-primary");
    expect(badgeVariants({ variant: "secondary" })).toContain("bg-secondary");
    expect(badgeVariants({ variant: "destructive" })).toContain("text-destructive");
  });
});
