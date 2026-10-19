import { afterEach, describe, expect, it } from "vitest";

import {
  labelUnnamedOpenApiControls,
  OPENAPI_CONTROL_NAMES,
} from "@/lib/openapi-control-names";

describe("OpenAPI control names", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("names an empty schema switch and leaves a rendered example control alone", () => {
    document.body.innerHTML = `
      <span role="switch" aria-label=""></span>
      <div data-openapi-example>
        <button role="combobox" aria-label="Response status">200</button>
      </div>
    `;

    labelUnnamedOpenApiControls(document.body);

    expect(
      document.querySelector("[role='switch']")?.getAttribute("aria-label")
    ).toBe(OPENAPI_CONTROL_NAMES.schemaSwitch);
    expect(
      document
        .querySelector("[data-openapi-example] [role='combobox']")
        ?.getAttribute("aria-label")
    ).toBe("Response status");
  });

  it("names a schema combobox that starts without a label", () => {
    document.body.innerHTML = `<button role="combobox">County Context</button>`;

    labelUnnamedOpenApiControls(document.body);

    expect(
      document.querySelector("[role='combobox']")?.getAttribute("aria-label")
    ).toBe(OPENAPI_CONTROL_NAMES.schemaVariant);
  });

  it("does not write the name again once it is stable", () => {
    document.body.innerHTML = `<button role="combobox"></button>`;
    const writes: string[] = [];
    const original = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function setAttribute(name, value) {
      writes.push(`${name}=${value}`);
      original.call(this, name, value);
    };
    try {
      labelUnnamedOpenApiControls(document.body);
      labelUnnamedOpenApiControls(document.body);
    } finally {
      Element.prototype.setAttribute = original;
    }

    expect(writes).toStrictEqual([
      `aria-label=${OPENAPI_CONTROL_NAMES.schemaVariant}`,
    ]);
  });

  it("makes an overflowing schema path keyboard reachable", () => {
    document.body.innerHTML = `<div class="overflow-x-auto"></div>`;
    const path = document.querySelector(".overflow-x-auto");
    if (!(path instanceof HTMLElement)) {
      throw new Error("Missing schema path.");
    }
    Object.defineProperty(path, "clientWidth", { value: 40 });
    Object.defineProperty(path, "scrollWidth", { value: 120 });

    labelUnnamedOpenApiControls(document.body);

    expect(path.tabIndex).toBe(0);
    expect(path.getAttribute("aria-label")).toBe("Scrollable schema path");
  });
});
