import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Meter, MeterLabel, MeterValue } from "@/components/ui/meter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

describe("visual-first UI primitives", () => {
  afterEach(() => {
    cleanup();
  });

  describe(Tabs, () => {
    it("exposes tablist, tab and tabpanel roles with aria-selected", () => {
      render(
        <Tabs defaultValue="shortlist">
          <TabsList aria-label="Explorer rail">
            <TabsTrigger value="shortlist">Shortlist</TabsTrigger>
            <TabsTrigger value="county">County</TabsTrigger>
          </TabsList>
          <TabsContent value="shortlist">Ranked counties</TabsContent>
          <TabsContent value="county">Bullock County detail</TabsContent>
        </Tabs>
      );

      expect(
        screen.getByRole("tablist", { name: "Explorer rail" })
      ).toBeTruthy();
      const shortlist = screen.getByRole("tab", { name: "Shortlist" });
      const county = screen.getByRole("tab", { name: "County" });
      expect(shortlist.getAttribute("aria-selected")).toBe("true");
      expect(county.getAttribute("aria-selected")).toBe("false");
      expect(screen.getByRole("tabpanel").textContent).toBe("Ranked counties");
    });

    it("switches the tabpanel when another tab is clicked", async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="shortlist">
          <TabsList aria-label="Explorer rail">
            <TabsTrigger value="shortlist">Shortlist</TabsTrigger>
            <TabsTrigger value="county">County</TabsTrigger>
          </TabsList>
          <TabsContent value="shortlist">Ranked counties</TabsContent>
          <TabsContent value="county">Bullock County detail</TabsContent>
        </Tabs>
      );
      const shortlist = screen.getByRole("tab", { name: "Shortlist" });
      const county = screen.getByRole("tab", { name: "County" });

      await user.click(county);

      expect(shortlist.getAttribute("aria-selected")).toBe("false");
      expect(county.getAttribute("aria-selected")).toBe("true");
      expect(screen.getByRole("tabpanel").textContent).toBe(
        "Bullock County detail"
      );
    });

    it("moves focus with arrow keys and selects with Enter", async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="shortlist">
          <TabsList aria-label="Explorer rail">
            <TabsTrigger value="shortlist">Shortlist</TabsTrigger>
            <TabsTrigger value="county">County</TabsTrigger>
          </TabsList>
          <TabsContent value="shortlist">Ranked counties</TabsContent>
          <TabsContent value="county">Bullock County detail</TabsContent>
        </Tabs>
      );

      const county = screen.getByRole("tab", { name: "County" });
      screen.getByRole("tab", { name: "Shortlist" }).focus();
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(county);

      await user.keyboard("{Enter}");
      expect(county.getAttribute("aria-selected")).toBe("true");
    });
  });

  describe(ToggleGroup, () => {
    it("keeps one pressed item in single-select mode", async () => {
      const user = userEvent.setup();
      render(
        <ToggleGroup aria-label="Explorer view" defaultValue={["map"]}>
          <ToggleGroupItem value="map">Map</ToggleGroupItem>
          <ToggleGroupItem value="table">Table</ToggleGroupItem>
        </ToggleGroup>
      );

      const map = screen.getByRole("button", { name: "Map" });
      const table = screen.getByRole("button", { name: "Table" });
      expect(map.getAttribute("aria-pressed")).toBe("true");
      expect(table.getAttribute("aria-pressed")).toBe("false");

      await user.click(table);

      expect(table.getAttribute("aria-pressed")).toBe("true");
      expect(map.getAttribute("aria-pressed")).toBe("false");
      expect(Object.hasOwn(table.dataset, "pressed")).toBeTruthy();
    });
  });

  describe("Collapsible and Accordion", () => {
    it("expands and collapses a collapsible with aria-expanded", async () => {
      const user = userEvent.setup();
      render(
        <Collapsible>
          <CollapsibleTrigger>Scoring notes</CollapsibleTrigger>
          <CollapsibleContent>Synthetic scoring note.</CollapsibleContent>
        </Collapsible>
      );

      const trigger = screen.getByRole("button", { name: "Scoring notes" });
      expect(trigger.getAttribute("aria-expanded")).toBe("false");

      await user.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText("Synthetic scoring note.")).toBeTruthy();

      await user.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      await waitFor(() => {
        expect(screen.queryByText("Synthetic scoring note.")).toBeNull();
      });
    });

    it("toggles an accordion item with aria-expanded", async () => {
      const user = userEvent.setup();
      render(
        <Accordion>
          <AccordionItem value="method">
            <AccordionTrigger>Methodology</AccordionTrigger>
            <AccordionContent>Synthetic methodology text.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="limits">
            <AccordionTrigger>Limitations</AccordionTrigger>
            <AccordionContent>Synthetic limitation text.</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      const method = screen.getByRole("button", { name: "Methodology" });
      const limits = screen.getByRole("button", { name: "Limitations" });
      expect(method.getAttribute("aria-expanded")).toBe("false");

      await user.click(method);
      expect(method.getAttribute("aria-expanded")).toBe("true");
      expect(limits.getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByText("Synthetic methodology text.")).toBeTruthy();

      await user.click(method);
      expect(method.getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe(Breadcrumb, () => {
    it("renders a breadcrumb nav and marks the last item as the current page", () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/explore">United States</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/explore?state=AL">Alabama</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Bullock County</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      );

      const nav = screen.getByRole("navigation", { name: "breadcrumb" });
      expect(nav.getAttribute("aria-label")).toBe("breadcrumb");
      expect(screen.getByRole("link", { name: "United States" })).toBeTruthy();
      const current = screen.getByText("Bullock County");
      expect(current.getAttribute("aria-current")).toBe("page");
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
      expect(nav.querySelectorAll("a")).toHaveLength(2);
    });
  });

  describe(Meter, () => {
    it("exposes role meter with value, min and max", () => {
      render(
        <Meter aria-label="Synthetic gap score" max={100} min={0} value={64}>
          <MeterLabel>Gap score</MeterLabel>
          <MeterValue />
        </Meter>
      );

      const meter = screen.getByRole("meter");
      expect(meter.getAttribute("aria-valuenow")).toBe("64");
      expect(meter.getAttribute("aria-valuemin")).toBe("0");
      expect(meter.getAttribute("aria-valuemax")).toBe("100");
      expect(screen.getByText("Gap score")).toBeTruthy();
    });
  });

  describe(Separator, () => {
    it("exposes separator role and orientation", () => {
      render(
        <div>
          <Separator data-testid="horizontal" />
          <Separator data-testid="vertical" orientation="vertical" />
        </div>
      );

      const horizontal = screen.getByTestId("horizontal");
      const vertical = screen.getByTestId("vertical");
      expect(horizontal.getAttribute("role")).toBe("separator");
      expect(horizontal.dataset.orientation).toBe("horizontal");
      expect(vertical.getAttribute("role")).toBe("separator");
      expect(vertical.getAttribute("aria-orientation")).toBe("vertical");
      expect(vertical.dataset.orientation).toBe("vertical");
    });
  });

  describe(Spinner, () => {
    it("is a named status that stops animating under reduced motion", () => {
      render(<Spinner />);

      const spinner = screen.getByRole("status", { name: "Loading" });
      expect(spinner.getAttribute("aria-label")).toBe("Loading");
      expect(spinner.getAttribute("class")).toContain("animate-spin");
      expect(spinner.getAttribute("class")).toContain(
        "motion-reduce:animate-none"
      );
    });
  });

  describe(Sheet, () => {
    it("opens a named dialog, closes it, and returns focus to the trigger", async () => {
      const user = userEvent.setup();
      render(
        <Sheet>
          <SheetTrigger>Open scenario</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Scenario</SheetTitle>
              <SheetDescription>Synthetic scenario controls.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      );

      const trigger = screen.getByRole("button", { name: "Open scenario" });
      await user.click(trigger);

      const dialog = await screen.findByRole("dialog", { name: "Scenario" });
      expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
      const close = screen.getByRole("button", { name: "Close" });

      await user.click(close);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });
    });

    it("closes with Escape", async () => {
      const user = userEvent.setup();
      render(
        <Sheet>
          <SheetTrigger>Open scenario</SheetTrigger>
          <SheetContent side="left">
            <SheetTitle>Scenario</SheetTitle>
          </SheetContent>
        </Sheet>
      );

      await user.click(screen.getByRole("button", { name: "Open scenario" }));
      const dialog = await screen.findByRole("dialog", { name: "Scenario" });
      expect(dialog.dataset.side).toBe("left");

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });
  });

  describe(ScrollArea, () => {
    it("renders its children inside the viewport", () => {
      render(
        <ScrollArea className="h-24">
          <ul>
            <li>Autauga County</li>
            <li>Baldwin County</li>
          </ul>
        </ScrollArea>
      );

      expect(screen.getByText("Autauga County")).toBeTruthy();
      expect(screen.getByText("Baldwin County")).toBeTruthy();
      expect(
        screen
          .getByText("Autauga County")
          .closest('[data-slot="scroll-area-viewport"]')
      ).toBeTruthy();
    });
  });
});
