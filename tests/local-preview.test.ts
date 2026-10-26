import { describe, expect, it } from "vitest";

import { localPreviewOptIn } from "@/lib/auth/local-preview";

describe("local preview opt-in", () => {
  it("opens only in development when the flag is explicitly set", () => {
    expect(
      localPreviewOptIn({ nodeEnv: "development", previewFlag: "1" })
    ).toBeTruthy();
  });

  it("stays closed without the flag", () => {
    expect(
      localPreviewOptIn({ nodeEnv: "development", previewFlag: undefined })
    ).toBeFalsy();
    expect(
      localPreviewOptIn({ nodeEnv: "development", previewFlag: "true" })
    ).toBeFalsy();
  });

  it("stays closed in production and test builds even when the flag is set", () => {
    expect(
      localPreviewOptIn({ nodeEnv: "production", previewFlag: "1" })
    ).toBeFalsy();
    expect(
      localPreviewOptIn({ nodeEnv: "test", previewFlag: "1" })
    ).toBeFalsy();
  });
});
