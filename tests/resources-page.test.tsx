import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResourcesPage } from "@/features/resources/resources-page";
import { isProfessionalAppPath } from "@/lib/auth/app-route-guard";
import { getRouteShell, pageMetadataForRoute } from "@/lib/navigation";
import {
  CDC_RESOURCE_TOPICS,
  REGIONAL_CENTERS,
  STATE_RESOURCES,
  resourcesPageHref,
  selectedStateFromQuery,
} from "@/lib/resources/catalog";
import { REGIONAL_CENTER_LOGOS } from "@/lib/resources/regional-center-logos";
import { RESOURCE_STATE_PATHS } from "@/lib/resources/state-map-paths";

const replace = vi.fn<(href: string, options?: { scroll?: boolean }) => void>();
let searchParams = new URLSearchParams();

vi.mock(import("next/navigation"), async (importOriginal) => {
  const navigation = await importOriginal();
  return {
    ...navigation,
    usePathname: () => "/resources",
    useRouter: () => ({
      back: vi.fn<() => void>(),
      bfcacheId: "resources-test",
      forward: vi.fn<() => void>(),
      prefetch: vi.fn<(href: string) => void>(),
      push: vi.fn<(href: string) => void>(),
      refresh: vi.fn<() => void>(),
      replace,
    }),
    useSearchParams: () => searchParams as unknown as ReadonlyURLSearchParams,
  };
});

describe("resource catalog", () => {
  it("includes every CDC link, all 50 states once, and nine centers", () => {
    const stateCodes = STATE_RESOURCES.map((state) => state.code);
    expect(new Set(stateCodes).size).toBe(50);
    expect(stateCodes).toContain("AK");
    expect(stateCodes).toContain("HI");
    expect(CDC_RESOURCE_TOPICS).toHaveLength(4);
    expect(
      CDC_RESOURCE_TOPICS.flatMap((topic) => topic.links).map(
        (link) => link.url
      )
    ).toStrictEqual([
      "https://ndc.services.cdc.gov/case-definitions/lyme-disease-2022/",
      "https://www.cdc.gov/lyme/data-research/facts-stats/surveillance-data-1.html",
      "https://www.cdc.gov/mmwr/volumes/73/wr/mm7306a1.htm",
      "https://www.cdc.gov/ticks/resources/TickSurveillance_Iscapularis-P.pdf",
      "https://www.cdc.gov/ticks/data-research/facts-stats/western-blacklegged-tick-surveillance.html",
      "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
      "https://www.cdc.gov/lyme/diagnosis-testing/",
      "https://www.cdc.gov/lyme/hcp/communication-resources/index.html",
      "https://www.cdc.gov/ticks/prevention/index.html",
      "https://www.cdc.gov/lyme/communication-resources/index.html",
      "https://www.cdc.gov/ticks/communication-resources/index.html",
    ]);
  });

  it("keeps nine centers and a real boundary for every state", () => {
    const stateCodes = STATE_RESOURCES.map((state) => state.code);
    expect(REGIONAL_CENTERS).toHaveLength(9);
    expect(REGIONAL_CENTERS.map((center) => center.name)).toStrictEqual([
      "Gulf South VECTOR",
      "Midwest Center",
      "NEVBD",
      "NewVec",
      "PacVec",
      "RaHPVEC",
      "Southeastern Center",
      "Tropical Islands Training & Evaluation Center",
      "VectorED Network",
    ]);
    expect(
      REGIONAL_CENTERS.filter(
        (center) => center.type === "Center of Excellence"
      )
    ).toHaveLength(4);
    expect(
      RESOURCE_STATE_PATHS.map((shape) => shape.code).toSorted()
    ).toStrictEqual(stateCodes.toSorted());
    expect(
      STATE_RESOURCES.every((state) => state.url.startsWith("https://"))
    ).toBeTruthy();
  });

  it("accepts a state code and resets anything else", () => {
    expect(selectedStateFromQuery("id")?.name).toBe("Idaho");
    expect(selectedStateFromQuery(null)).toBeNull();
    expect(selectedStateFromQuery("ZZ")).toBeNull();
    expect(selectedStateFromQuery("Idaho")).toBeNull();
    expect(resourcesPageHref("ID")).toBe("/resources?state=ID#state-resources");
  });

  it("keeps the resources route public inside the professional shell", () => {
    expect(resourcesPageHref("DC")).toBe("/resources");
    expect(getRouteShell("/resources")).toBe("none");
    expect(isProfessionalAppPath("/resources")).toBeFalsy();
    expect(pageMetadataForRoute("/resources").title).toBe(
      "Resources | One Health Lyme Gap Atlas"
    );
  });
});

describe("Resources page", () => {
  afterEach(() => {
    cleanup();
    replace.mockReset();
    searchParams = new URLSearchParams();
    window.location.hash = "";
  });

  it("shows a neutral state prompt when no state is selected", () => {
    render(<ResourcesPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Resources" })
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Select a state" })
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /Visit state resources/ })
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "CDC guidance" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "CDC guidance & tools" })
    ).toBeVisible();
  });

  it("frames the state directory as exploring other states", () => {
    render(<ResourcesPage />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Explore resources from other states",
      })
    ).toBeVisible();
    expect(
      screen.getByText(
        "See how states approach Lyme disease surveillance, prevention, and education. Find materials and ideas that may help your program."
      )
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Find your state's resources" })
    ).toBeNull();
  });

  it("places the official CDC logo beside the guidance heading", () => {
    render(<ResourcesPage />);

    expect(
      screen.getByRole("img", {
        name: "Centers for Disease Control and Prevention",
      })
    ).toHaveAttribute("src", "/resources/cdc-logo.svg");
  });

  it("initializes the selector from a state query", () => {
    searchParams = new URLSearchParams("state=ID");
    render(<ResourcesPage />);

    expect(
      screen.getByRole("heading", {
        name: "DHW — Mosquito and Tick Disease Prevention",
      })
    ).toBeVisible();
    expect(screen.getAllByText("State education resource")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: /Visit state resources/ })
    ).toHaveAttribute(
      "href",
      "https://healthandwelfare.idaho.gov/dhw-voice/avoid-getting-bitten-mosquitoes-and-ticks-can-cause-serious-illness"
    );
    expect(
      screen.getByRole("button", { name: "Select Idaho", pressed: true })
    ).toBeTruthy();
  });

  it("canonicalizes a lowercase code and keeps the section hash", () => {
    window.location.hash = "#state-resources";
    searchParams = new URLSearchParams("state=id");
    render(<ResourcesPage />);

    expect(replace).toHaveBeenCalledWith(
      "/resources?state=ID#state-resources",
      { scroll: false }
    );
  });

  it("synchronizes the directory and clears an invalid state code", () => {
    searchParams = new URLSearchParams("state=ZZ");
    render(<ResourcesPage />);

    expect(
      screen.getByRole("heading", { name: "Select a state" })
    ).toBeVisible();
    expect(replace).toHaveBeenCalledWith("/resources", { scroll: false });

    fireEvent.click(screen.getByText("Browse all 50 states A–Z"));
    const directory = screen
      .getByText("Browse all 50 states A–Z")
      .closest("details") as HTMLElement;
    expect(within(directory).getAllByRole("button")).toHaveLength(50);
    fireEvent.click(within(directory).getByRole("button", { name: "Alabama" }));
    expect(replace).toHaveBeenCalledWith(
      "/resources?state=AL#state-resources",
      { scroll: false }
    );
  });

  it("filters regional centers without dropping their links", () => {
    render(<ResourcesPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Centers of Excellence" })
    );
    const regional = screen.getByRole("region", {
      name: "Regional expertise & training",
    });
    expect(within(regional).getAllByRole("link")).toHaveLength(4);
    expect(
      within(regional).getByRole("heading", { name: "NewVec" })
    ).toBeVisible();
    expect(within(regional).queryByRole("link", { name: /NEVBD/ })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Training & Evaluation" })
    );
    expect(within(regional).getAllByRole("link")).toHaveLength(5);
    expect(
      within(regional).getByRole("link", { name: /NEVBD/ })
    ).toHaveAttribute("href", "https://www.neregionalvectorcenter.com/");
  });

  it("places a verified logo beside each center name without hiding the name", () => {
    render(<ResourcesPage />);
    const regional = screen.getByRole("region", {
      name: "Regional expertise & training",
    });
    const centersWithLogos = REGIONAL_CENTERS.filter(
      (center) => REGIONAL_CENTER_LOGOS[center.id]
    );
    const centersWithoutLogos = REGIONAL_CENTERS.filter(
      (center) => !REGIONAL_CENTER_LOGOS[center.id]
    );

    for (const center of centersWithLogos) {
      const heading = within(regional).getByRole("heading", {
        name: center.name,
      });
      const logo = REGIONAL_CENTER_LOGOS[center.id];
      const copy = heading.parentElement;
      const image = copy?.nextElementSibling?.querySelector("img");
      expect(heading).toBeVisible();
      expect(copy).toHaveClass("resources-center-copy");
      expect(copy?.nextElementSibling).toHaveClass("resources-center-logo");
      expect(image).toHaveAttribute("src", logo?.src);
      expect(image).toHaveAttribute("alt", "");
    }

    for (const center of centersWithoutLogos) {
      const heading = within(regional).getByRole("heading", {
        name: center.name,
      });
      expect(heading.closest("article")?.querySelector("img")).toBeNull();
    }

    expect(within(regional).getAllByRole("link")).toHaveLength(9);
    expect(
      within(regional).getByText("Research and entomology training.")
    ).toBeVisible();
    expect(
      within(regional).getByRole("heading", {
        name: "Tropical Islands Training & Evaluation Center",
      })
    ).toBeVisible();
  });

  it("returns every center from the all-centers filter", () => {
    render(<ResourcesPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Training & Evaluation" })
    );
    fireEvent.click(screen.getByRole("button", { name: "All centers" }));
    expect(
      within(
        screen.getByRole("region", { name: "Regional expertise & training" })
      ).getAllByRole("link")
    ).toHaveLength(9);
  });
});
