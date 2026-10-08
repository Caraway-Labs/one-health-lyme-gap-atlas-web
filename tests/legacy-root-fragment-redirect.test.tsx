import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LegacyRootFragmentRedirect } from "@/features/front-porch/legacy-root-fragment-redirect";

function installLocation(url: string) {
  const parsed = new URL(url);
  const replace = vi.fn<(url: string) => void>();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      hash: parsed.hash,
      pathname: parsed.pathname,
      replace,
      search: parsed.search,
    },
  });
  return replace;
}

describe("legacy root fragment redirect", () => {
  afterEach(cleanup);

  it("moves a legacy root section onto Overview and follows a later hash change", () => {
    const replace = installLocation(
      "http://localhost/?county=08001&state=CO#atlas"
    );
    const view = render(<LegacyRootFragmentRedirect />);

    expect(replace).toHaveBeenCalledExactlyOnceWith(
      "/overview?county=08001&state=CO#atlas"
    );

    window.location.hash = "#scoring";
    window.location.search = "";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(replace).toHaveBeenNthCalledWith(2, "/overview#scoring");

    view.unmount();
    window.location.hash = "#methods";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(replace).toHaveBeenCalledTimes(2);
  });

  it("leaves the Front Porch story anchor and other pathnames alone", () => {
    const story = installLocation("http://localhost/#front-porch-story");
    const storyView = render(<LegacyRootFragmentRedirect />);
    expect(story).not.toHaveBeenCalled();
    storyView.unmount();

    const overview = installLocation("http://localhost/overview#atlas");
    render(<LegacyRootFragmentRedirect />);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(overview).not.toHaveBeenCalled();
  });
});
