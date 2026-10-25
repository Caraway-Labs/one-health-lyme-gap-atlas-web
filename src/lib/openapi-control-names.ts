export const OPENAPI_CONTROL_NAMES = {
  codeSampleLanguage: "Code sample language",
  exampleRequest: "Example request",
  responseExample: "Response example",
  responseStatus: "Response status",
  schemaSwitch: "Show response schema",
  schemaVariant: "Schema variant",
} as const;

const PURPOSE_NAMES = new Set<string>(Object.values(OPENAPI_CONTROL_NAMES));

export function labelUnnamedOpenApiControls(root: ParentNode): void {
  for (const element of root.querySelectorAll(
    '[role="combobox"], [role="switch"]'
  )) {
    if (!(element instanceof HTMLElement)) continue;
    if (element.closest("[data-openapi-example]")) continue;
    const current = element.getAttribute("aria-label")?.trim() ?? "";
    if (current && PURPOSE_NAMES.has(current)) {
      clearEmptyLabelReference(element);
      continue;
    }
    if (current) continue;
    const name =
      element.getAttribute("role") === "switch"
        ? OPENAPI_CONTROL_NAMES.schemaSwitch
        : OPENAPI_CONTROL_NAMES.schemaVariant;
    element.setAttribute("aria-label", name);
    clearEmptyLabelReference(element);
  }
  for (const element of root.querySelectorAll(
    ".overflow-auto, .overflow-x-auto"
  )) {
    if (!(element instanceof HTMLElement)) continue;
    if (element.scrollWidth <= element.clientWidth + 1) continue;
    if (element.tabIndex < 0) element.tabIndex = 0;
    element.classList.add(
      "focus-visible:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-ring"
    );
    if (!element.getAttribute("aria-label")?.trim()) {
      element.setAttribute(
        "aria-label",
        element.querySelector("table")
          ? "Scrollable table"
          : "Scrollable schema path"
      );
    }
  }
}

function clearEmptyLabelReference(element: HTMLElement): void {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy === null) return;
  if (labelledBy.trim()) return;
  element.removeAttribute("aria-labelledby");
}
