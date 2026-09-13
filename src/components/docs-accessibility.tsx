"use client";

import { useEffect } from "react";

export function DocsAccessibility() {
  useEffect(() => {
    document
      .querySelector("#nd-subnav")
      ?.setAttribute("aria-label", "Documentation controls");
    document.querySelector("#nd-toc")?.setAttribute("role", "navigation");
    document
      .querySelector("#nd-toc")
      ?.setAttribute("aria-label", "On this page");
    document
      .querySelector("[data-toc-popover] > header")
      ?.setAttribute("role", "presentation");
  }, []);

  return null;
}
