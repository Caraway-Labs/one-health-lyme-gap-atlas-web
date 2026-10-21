import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BreadcrumbEllipsis,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";

const COUNTIES = ["Autauga County", "Barbour County", "Bullock County"];

describe("visual-first input surfaces", () => {
  afterEach(() => {
    cleanup();
  });

  describe(Combobox, () => {
    function CountyCombobox({
      onValueChange,
    }: {
      onValueChange?: (value: string | null) => void;
    }) {
      return (
        <Combobox items={COUNTIES} onValueChange={onValueChange}>
          <ComboboxInput
            aria-label="County"
            placeholder="Search counties"
            showClear
          />
          <ComboboxContent>
            <ComboboxEmpty>No county matches.</ComboboxEmpty>
            <ComboboxList>
              {(county: string) => (
                <ComboboxItem key={county} value={county}>
                  {county}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      );
    }

    it("opens from the named trigger, filters as the user types, and selects an option", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn<(value: string | null) => void>();
      render(<CountyCombobox onValueChange={onValueChange} />);

      await user.click(screen.getByRole("button", { name: "Show options" }));
      await expect(screen.findAllByRole("option")).resolves.toHaveLength(3);

      await user.type(screen.getByRole("combobox", { name: "County" }), "bull");
      await waitFor(() => {
        expect(screen.getAllByRole("option")).toHaveLength(1);
      });
      await user.click(screen.getByRole("option", { name: "Bullock County" }));

      expect(onValueChange).toHaveBeenCalledWith(
        "Bullock County",
        expect.anything()
      );
    });

    it("reports an empty result with text and clears through a named button", async () => {
      const user = userEvent.setup();
      render(<CountyCombobox />);
      const input = screen.getByRole("combobox", { name: "County" });

      await user.type(input, "zzz");
      await expect(
        screen.findByText("No county matches.")
      ).resolves.toBeTruthy();

      await user.clear(input);
      expect(screen.queryByText("No county matches.")).toBeNull();
    });

    it("supports grouped options, separators, and a chips selection", async () => {
      const user = userEvent.setup();
      function Chips() {
        const anchor = useComboboxAnchor();
        return (
          <Combobox
            defaultValue={["Autauga County"]}
            items={[{ items: COUNTIES, value: "Alabama" }]}
            multiple
          >
            <ComboboxChips ref={anchor}>
              <ComboboxValue>
                {(values: string[]) =>
                  values.map((value) => (
                    <ComboboxChip key={value}>{value}</ComboboxChip>
                  ))
                }
              </ComboboxValue>
              <ComboboxChipsInput aria-label="Counties" />
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
              <ComboboxList>
                {(group: { items: string[]; value: string }) => (
                  <ComboboxGroup key={group.value} items={group.items}>
                    <ComboboxLabel>{group.value}</ComboboxLabel>
                    <ComboboxSeparator />
                    <ComboboxCollection>
                      {(county: string) => (
                        <ComboboxItem key={county} value={county}>
                          {county}
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxGroup>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        );
      }
      render(<Chips />);

      expect(screen.getByText("Autauga County")).toBeTruthy();
      await user.click(screen.getByRole("combobox", { name: "Counties" }));
      await expect(screen.findByText("Alabama")).resolves.toBeTruthy();
      await user.click(screen.getByRole("option", { name: "Barbour County" }));
      await waitFor(() => {
        expect(screen.getAllByText("Barbour County").length).toBeGreaterThan(0);
      });
    });

    it("exposes a trigger with a caller-supplied name", () => {
      render(
        <Combobox items={COUNTIES}>
          <ComboboxTrigger aria-label="Pick a county">Pick</ComboboxTrigger>
        </Combobox>
      );

      expect(screen.getByLabelText("Pick a county").textContent).toContain(
        "Pick"
      );
    });
  });

  describe(Drawer, () => {
    it("opens a named dialog with a swipe handle and closes from its close button", async () => {
      const user = userEvent.setup();
      render(
        <Drawer showSwipeHandle>
          <DrawerTrigger>Open county</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Bullock County</DrawerTitle>
              <DrawerDescription>Synthetic summary.</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose>Close county</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      );

      await user.click(screen.getByRole("button", { name: "Open county" }));
      const dialog = await screen.findByRole("dialog", {
        name: "Bullock County",
      });
      expect(
        dialog.querySelector("[data-slot='drawer-swipe-handle']")
      ).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Close county" }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("supports snap points, a side swipe direction, and a non-modal surface", async () => {
      const user = userEvent.setup();
      render(
        <Drawer modal={false} snapPoints={[0.5, 1]} swipeDirection="right">
          <DrawerTrigger>Open side</DrawerTrigger>
          <DrawerContent>
            <DrawerTitle>Side panel</DrawerTitle>
          </DrawerContent>
        </Drawer>
      );

      await user.click(screen.getByRole("button", { name: "Open side" }));

      const dialog = await screen.findByRole("dialog", { name: "Side panel" });
      expect(dialog.dataset.swipeAxis).toBe("x");
      expect(Object.hasOwn(dialog.dataset, "snapPoints")).toBeTruthy();
      expect(document.querySelector("[data-slot='drawer-overlay']")).toBeNull();
    });

    it("requires a Drawer parent for its content", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() =>
        render(
          <DrawerContent>
            <DrawerTitle>Orphan</DrawerTitle>
          </DrawerContent>
        )
      ).toThrow("useDrawer must be used within a Drawer.");

      error.mockRestore();
    });
  });

  describe(InputGroup, () => {
    it("groups an input with addons, text, and a named button", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn<() => void>();
      render(
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>https://</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput aria-label="Address" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton aria-label="Go" onClick={onClick}>
              Go
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      );

      expect(document.querySelector("[data-slot='input-group']")).toBeTruthy();
      expect(screen.getByText("https://")).toBeTruthy();
      await user.type(
        screen.getByRole("textbox", { name: "Address" }),
        "atlas"
      );
      await user.click(screen.getByRole("button", { name: "Go" }));

      expect(onClick).toHaveBeenCalledOnce();
      expect(
        (screen.getByRole("textbox", { name: "Address" }) as HTMLInputElement)
          .value
      ).toBe("atlas");
    });

    it("supports a textarea inside the group, block alignment, and disabled state", () => {
      render(
        <InputGroup>
          <InputGroupAddon align="block-start">Notes</InputGroupAddon>
          <InputGroupTextarea aria-label="Note" disabled />
          <InputGroupAddon align="block-end">0 / 200</InputGroupAddon>
        </InputGroup>
      );

      const note = screen.getByRole("textbox", { name: "Note" });
      expect(note.hasAttribute("disabled")).toBeTruthy();
      expect(screen.getByText("Notes").dataset.align).toBe("block-start");
    });
  });

  describe(Textarea, () => {
    it("accepts text and marks itself invalid", async () => {
      const user = userEvent.setup();
      render(<Textarea aria-invalid="true" aria-label="Comment" />);
      const field = screen.getByRole("textbox", { name: "Comment" });

      await user.type(field, "Needs review");

      expect((field as HTMLTextAreaElement).value).toBe("Needs review");
      expect(field.getAttribute("aria-invalid")).toBe("true");
    });
  });

  describe(Toggle, () => {
    it("exposes aria-pressed and flips it on click", async () => {
      const user = userEvent.setup();
      render(<Toggle aria-label="Show labels">Labels</Toggle>);
      const toggle = screen.getByRole("button", { name: "Show labels" });

      expect(toggle.getAttribute("aria-pressed")).toBe("false");
      await user.click(toggle);
      expect(toggle.getAttribute("aria-pressed")).toBe("true");
    });

    it("supports the outline variant and sizes", () => {
      render(
        <Toggle aria-label="Compact" size="sm" variant="outline">
          Compact
        </Toggle>
      );

      expect(screen.getByRole("button", { name: "Compact" })).toBeTruthy();
    });
  });

  describe(BreadcrumbEllipsis, () => {
    it("labels the collapsed items for assistive technology", () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      );

      expect(screen.getByText("More")).toBeTruthy();
    });
  });
});
