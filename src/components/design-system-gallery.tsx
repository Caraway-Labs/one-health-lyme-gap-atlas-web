"use client";

import { AtlasDataStamp } from "@/components/atlas-data-stamp";
import { AtlasMapLegend } from "@/components/atlas-map-legend";
import { AtlasPriorityBadge } from "@/components/atlas-priority-badge";
import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SEMANTIC_SWATCHES = [
  ["background", "var(--background)"],
  ["primary", "var(--primary)"],
  ["secondary", "var(--secondary)"],
  ["muted", "var(--muted)"],
  ["destructive", "var(--destructive)"],
  ["border", "var(--border)"],
] as const;

const DOMAIN_SWATCHES = [
  ["navy", "var(--navy)"],
  ["teal", "var(--teal)"],
  ["priority urgent", "var(--priority-urgent-bg)"],
  ["map ramp high", "var(--map-ramp-6)"],
] as const;

export function DesignSystemGallery() {
  return (
    <main className="design-system-gallery">
      <header>
        <p className="eyebrow">Lyme Atlas foundations</p>
        <h1 className="type-page">Design system</h1>
        <p>
          Internal reference for tokens, primitives, and Atlas domain patterns.
          This route is unlinked from primary navigation and is not a product
          page.
        </p>
      </header>

      <section aria-labelledby="tokens-heading">
        <h2 className="type-page" id="tokens-heading">
          Tokens
        </h2>
        <p className="type-small">
          Semantic tokens color application chrome. Domain tokens keep map,
          ranking, and severity meaning.
        </p>
        <div className="design-system-swatches">
          {SEMANTIC_SWATCHES.map(([name, background]) => (
            <div className="design-system-swatch" key={name}>
              <span
                aria-hidden="true"
                className="design-system-swatch-chip"
                style={{ background }}
              />
              {name}
            </div>
          ))}
          {DOMAIN_SWATCHES.map(([name, background]) => (
            <div className="design-system-swatch" key={name}>
              <span
                aria-hidden="true"
                className="design-system-swatch-chip"
                style={{ background }}
              />
              {name}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="type-heading">
        <h2 className="type-page" id="type-heading">
          Typography
        </h2>
        <div className="design-system-specimens">
          <p className="type-display">Display</p>
          <p className="type-page">Page heading</p>
          <p className="type-section">Section heading</p>
          <p className="type-card">Card heading</p>
          <p className="type-body">Body copy uses the sans UI family.</p>
          <p className="eyebrow">Eyebrow label</p>
          <p className="type-metric">84.6</p>
        </div>
      </section>

      <section aria-labelledby="primitives-heading">
        <h2 className="type-page" id="primitives-heading">
          Primitives
        </h2>
        <div className="design-system-primitives">
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Inputs</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input aria-label="Example county search" placeholder="Search" />
              <Select defaultValue="all">
                <SelectTrigger aria-label="Example filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All counties</SelectItem>
                  <SelectItem value="ca">California</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Badges and dialog</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Dialog>
                <DialogTrigger render={<Button variant="outline" />}>
                  Open example
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Example dialog</DialogTitle>
                    <DialogDescription>
                      Shared dialog primitive with a visible close control.
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="patterns-heading">
        <h2 className="type-page" id="patterns-heading">
          Atlas domain patterns
        </h2>
        <AtlasSectionHeader
          aside={<AtlasDataStamp>alpha-example · alpha-0.2.0</AtlasDataStamp>}
          description="Compose primitives; keep scoring and geography logic in feature code."
          eyebrow="Reusable pattern"
          title="Section header and data stamp"
        />
        <AtlasStatusMessage title="Example empty state" tone="empty">
          <p>Select a county to see its details.</p>
        </AtlasStatusMessage>
        <AtlasPriorityBadge priority="Priority 2 — Review" />
        <AtlasMapLegend caption="Example legend for review-priority colors." />
      </section>
    </main>
  );
}
