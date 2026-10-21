"use client";

import {
  BookOpenIcon,
  BugIcon,
  CalendarIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleOffIcon,
  DatabaseIcon,
  FileDownIcon,
  GitCompareArrowsIcon,
  LayersIcon,
  ListChecksIcon,
  LoaderCircleIcon,
  MapIcon,
  MicroscopeIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Table2Icon,
  TreePineIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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

const SYNTHETIC_COUNTIES = [
  "Autauga County, AL",
  "Barbour County, AL",
  "Bullock County, AL",
  "Butler County, AL",
  "Calhoun County, AL",
] as const;

const SYNTHETIC_RANKING = [
  "Bullock County",
  "Barbour County",
  "Butler County",
  "Autauga County",
  "Calhoun County",
  "Chambers County",
  "Cherokee County",
  "Choctaw County",
] as const;

interface IconSpecimen {
  readonly Icon: ComponentType<SVGProps<SVGSVGElement>>;
  readonly label: string;
}

const ICON_VOCABULARY = [
  { Icon: UsersIcon, label: "Human surveillance" },
  { Icon: BugIcon, label: "Tick / vector" },
  { Icon: MicroscopeIcon, label: "Pathogen" },
  { Icon: TreePineIcon, label: "Environment" },
  { Icon: CircleCheckIcon, label: "Available" },
  { Icon: CircleDashedIcon, label: "Limited" },
  { Icon: CircleOffIcon, label: "Unavailable" },
  { Icon: TriangleAlertIcon, label: "Caveat" },
  { Icon: GitCompareArrowsIcon, label: "Compare" },
  { Icon: SparklesIcon, label: "Ask Atlas" },
  { Icon: FileDownIcon, label: "Export" },
  { Icon: DatabaseIcon, label: "Release / source" },
  { Icon: CalendarIcon, label: "Period" },
  { Icon: SlidersHorizontalIcon, label: "Scenario" },
  { Icon: LayersIcon, label: "Layers" },
  { Icon: MapIcon, label: "Map view" },
  { Icon: Table2Icon, label: "Table view" },
  { Icon: ListChecksIcon, label: "Follow-up checklist" },
  { Icon: BookOpenIcon, label: "Resources" },
  { Icon: RotateCcwIcon, label: "Reset" },
  { Icon: LoaderCircleIcon, label: "Loading" },
] as const satisfies readonly IconSpecimen[];

export function DesignSystemVisualFirstSpecimens() {
  return (
    <section aria-labelledby="visual-first-heading">
      <h2 className="type-page" id="visual-first-heading">
        Visual-first primitives
      </h2>
      <p className="type-small">
        Synthetic examples. Scores and counties are illustrative, not governed
        Atlas results.
      </p>
      <div className="design-system-primitives">
        <Card>
          <CardHeader>
            <CardTitle>Tabs</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="shortlist">
              <TabsList aria-label="Example explorer rail">
                <TabsTrigger value="shortlist">Shortlist</TabsTrigger>
                <TabsTrigger value="county">County</TabsTrigger>
              </TabsList>
              <TabsContent value="shortlist">
                Ranked counties for the selected state.
              </TabsContent>
              <TabsContent value="county">
                Selected county summary and evidence.
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Toggle group</CardTitle>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              aria-label="Example result view"
              defaultValue={["map"]}
              variant="outline"
            >
              <ToggleGroupItem value="map">
                <MapIcon aria-hidden="true" />
                Map
              </ToggleGroupItem>
              <ToggleGroupItem value="table">
                <Table2Icon aria-hidden="true" />
                Table
              </ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meter</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Meter aria-label="Example gap score" max={100} min={0} value={64}>
              <MeterLabel>Gap score (synthetic)</MeterLabel>
              <MeterValue />
            </Meter>
            <Meter
              aria-label="Example evidence completeness"
              max={100}
              min={0}
              value={82}
            >
              <MeterLabel>Evidence completeness (synthetic)</MeterLabel>
              <MeterValue />
            </Meter>
            <p className="type-small">
              Meter shows a value inside a known range. Use Progress for task
              progress.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Breadcrumb</CardTitle>
          </CardHeader>
          <CardContent>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/design-system">
                    United States
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/design-system">Alabama</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Bullock County</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collapsible and accordion</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Collapsible>
              <CollapsibleTrigger
                render={<Button size="sm" variant="outline" />}
              >
                Scoring notes
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="type-small">
                  Synthetic note. A collapsible replaces one native details
                  element.
                </p>
              </CollapsibleContent>
            </Collapsible>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scroll area and separator</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-28 rounded-md border">
              <ul className="grid gap-1 p-2 text-sm">
                {SYNTHETIC_RANKING.map((county, index) => (
                  <li key={county}>
                    {index > 0 ? <Separator className="mb-1" /> : null}
                    {county}
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <div className="mt-3 flex h-5 items-center gap-3 text-sm">
              <span>Period</span>
              <Separator orientation="vertical" />
              <span>Source</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sheet, drawer and hover card</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Sheet>
              <SheetTrigger render={<Button variant="outline" />}>
                <SlidersHorizontalIcon aria-hidden="true" />
                Scenario
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Scenario</SheetTitle>
                  <SheetDescription>
                    Synthetic side panel. Adjustments never change published
                    results.
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
            <Drawer>
              <DrawerTrigger render={<Button variant="outline" />}>
                <ListChecksIcon aria-hidden="true" />
                Shortlist
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Shortlist</DrawerTitle>
                  <DrawerDescription>
                    Synthetic mobile bottom sheet.
                  </DrawerDescription>
                </DrawerHeader>
                <DrawerFooter>
                  <DrawerClose render={<Button variant="outline" />}>
                    Close
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
            <HoverCard>
              <HoverCardTrigger
                delay={100}
                render={<Button type="button" variant="ghost" />}
              >
                Bullock County
              </HoverCardTrigger>
              <HoverCardContent>
                <p className="font-semibold">Bullock County, AL</p>
                <p className="type-small">
                  Synthetic hover readout. The same facts stay in the table.
                </p>
              </HoverCardContent>
            </HoverCard>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spinner</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm">
            <Spinner />
            <span>Loading is neutral and never reads as Unavailable.</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Combobox</CardTitle>
          </CardHeader>
          <CardContent>
            <Combobox items={SYNTHETIC_COUNTIES}>
              <ComboboxInput
                aria-label="Example county search"
                placeholder="Search counties"
              />
              <ComboboxContent>
                <ComboboxEmpty>No counties found.</ComboboxEmpty>
                <ComboboxList>
                  {(county: string) => (
                    <ComboboxItem key={county} value={county}>
                      {county}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </CardContent>
        </Card>
      </div>

      <h3 className="type-card" id="icon-vocabulary-heading">
        Atlas icon vocabulary
      </h3>
      <p className="type-small">
        Icons always accompany a text label or accessible name.
      </p>
      <ul
        aria-labelledby="icon-vocabulary-heading"
        className="design-system-swatches"
      >
        {ICON_VOCABULARY.map(({ Icon, label }) => (
          <li className="design-system-swatch" key={label}>
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
