import { describe, expect, it } from "vitest";

import {
  FRONT_PORCH_SESSION_HEADER,
  frontPorchSessionHeaders,
  isFrontPorchSignedInHeader,
} from "@/lib/auth/front-porch-session-header";

describe("Front Porch session header", () => {
  it("replaces a spoofed client value with the middleware decision", () => {
    const signedOut = frontPorchSessionHeaders(
      new Headers({ [FRONT_PORCH_SESSION_HEADER]: "1" }),
      false
    );
    const signedIn = frontPorchSessionHeaders(new Headers(), true);

    expect({
      signedIn: isFrontPorchSignedInHeader(
        signedIn.get(FRONT_PORCH_SESSION_HEADER)
      ),
      signedOut: signedOut.get(FRONT_PORCH_SESSION_HEADER),
      unexpected: isFrontPorchSignedInHeader("true"),
    }).toStrictEqual({
      signedIn: true,
      signedOut: "0",
      unexpected: false,
    });
  });
});
