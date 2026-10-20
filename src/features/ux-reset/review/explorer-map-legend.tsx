"use client";

import { Info } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EvidenceObject } from "@/features/ux-reset/evidence/evidence-object";
import {
  buildExplorerLegendModel,
  type ExplorerLegendDisclosure,
  type ExplorerLegendGradient,
  type ExplorerLegendSegment,
} from "@/features/ux-reset/review/explorer-legend-model";
import type { ExplorerMapPaint } from "@/features/ux-reset/review/explorer-map-layers";
import { RURALITY_LEGEND_EXPLANATION } from "@/features/ux-reset/review/rurality-palette";

function LegendDisclosure({
  color,
  disclosure,
}: {
  color: string;
  disclosure: ExplorerLegendDisclosure;
}) {
  return (
    <div
      className="ux-reset-explorer-legend-disclosure"
      data-legend-disclosure=""
    >
      <p className="ux-reset-explorer-legend-disclosure-title">
        <span
          aria-hidden="true"
          className="ux-reset-explorer-legend-disclosure-swatch"
          data-legend-disclosure-swatch=""
          style={{ background: color }}
        />
        <strong>{disclosure.title}</strong>
      </p>
      {disclosure.category ? (
        <p className="ux-reset-explorer-legend-disclosure-category">
          {disclosure.category}
        </p>
      ) : null}
      <p className="ux-reset-explorer-legend-disclosure-action">
        {disclosure.action}
      </p>
    </div>
  );
}

const REFERENCE_PILL_SEGMENTS = 7;

function segmentBackground(
  gradient?: ExplorerLegendGradient,
  segment?: ExplorerLegendSegment
): string {
  if (gradient) {
    return `linear-gradient(90deg, ${gradient.stops
      .map((stop) => `${stop.color} ${stop.percent}%`)
      .join(", ")})`;
  }
  return segment?.color ?? "transparent";
}

function LegendStrip({
  children,
  fill,
  items,
}: {
  children: ReactNode;
  fill: "count" | "full";
  items: readonly { background: string; id: string; role: string }[];
}) {
  const count = Math.max(items.length, 1);
  const style: CSSProperties & { "--legend-count": number } = {
    "--legend-count": fill === "full" ? REFERENCE_PILL_SEGMENTS : count,
  };
  return (
    <div
      className="ux-reset-explorer-legend-strip"
      data-legend-count={count}
      data-legend-fill={fill}
      style={style}
    >
      <div aria-hidden="true" className="ux-reset-explorer-legend-pill">
        {items.map((item) => (
          <span
            data-legend-pill-role={item.role}
            data-legend-pill-segment=""
            key={item.id}
            style={{ background: item.background }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

function LegendSegmentButton({
  gradient,
  layerTitle,
  onOpenChange,
  open,
  segment,
}: {
  gradient?: ExplorerLegendGradient;
  layerTitle: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  segment?: ExplorerLegendSegment;
}) {
  const accessibleName =
    gradient?.accessibleName ?? segment?.accessibleName ?? "";
  const tooltip = gradient?.tooltip ?? segment?.tooltip ?? "";
  const disclosure = gradient ? null : (segment?.disclosure ?? null);
  const label = segment?.label ?? "Continuous color scale";
  const dialogName = accessibleName.startsWith(`${layerTitle}:`)
    ? accessibleName
    : `${layerTitle}: ${accessibleName}`;
  const background = segmentBackground(gradient, segment);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={accessibleName}
        className="ux-reset-explorer-legend-segment"
        data-legend-label={label}
        data-legend-role={gradient ? "gradient" : (segment?.role ?? "segment")}
        data-legend-segment=""
        delay={120}
        openOnHover
        type="button"
        onClick={() => {
          // Base UI toggles a hover-capable popover closed on the click that
          // follows pointerdown. Keep the segment disclosure open.
          requestAnimationFrame(() => {
            onOpenChange(true);
          });
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) {
            onOpenChange(true);
          }
        }}
      >
        <span
          aria-hidden="true"
          style={{
            background,
            boxShadow: segment?.outline
              ? `inset 0 0 0 2px ${segment.outline}`
              : undefined,
          }}
        />
        {segment?.visibleLines?.map((line) => (
          <small
            className="ux-reset-explorer-legend-segment-label"
            data-legend-visible-line=""
            key={line}
          >
            {line}
          </small>
        ))}
      </PopoverTrigger>
      <PopoverContent
        align="center"
        aria-label={dialogName}
        className={
          disclosure
            ? "ux-reset-explorer-legend-tip ux-reset-explorer-legend-tip-disclosure border-border w-auto border p-2.5 text-left text-xs shadow-none ring-0"
            : "ux-reset-explorer-legend-tip w-auto"
        }
        side="top"
      >
        {disclosure ? (
          <LegendDisclosure
            color={segment?.color ?? ""}
            disclosure={disclosure}
          />
        ) : (
          <p>{tooltip}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RuralityLegendScale({
  model,
  onOpenChange,
  openId,
}: {
  model: ReturnType<typeof buildExplorerLegendModel>;
  onOpenChange: (id: string | null) => void;
  openId: string | null;
}) {
  const classes = model.segments.filter((segment) => segment.role === "class");
  const missing = model.segments.filter(
    (segment) => segment.role === "missing"
  );
  return (
    <div className="ux-reset-explorer-legend-rurality">
      <div className="ux-reset-explorer-legend-rurality-main">
        <div className="ux-reset-explorer-legend-rurality-scale">
          <LegendStrip
            fill="count"
            items={classes.map((segment) => ({
              background: segment.color,
              id: segment.id,
              role: segment.role ?? "class",
            }))}
          >
            {classes.map((segment) => (
              <LegendSegmentButton
                key={segment.id}
                layerTitle={model.title}
                open={openId === segment.id}
                segment={segment}
                onOpenChange={(next) => {
                  onOpenChange(next ? segment.id : null);
                }}
              />
            ))}
          </LegendStrip>
          <div className="ux-reset-explorer-legend-rurality-captions">
            {model.leftCaption ? (
              <span className="ux-reset-explorer-legend-caption">
                {model.leftCaption}
              </span>
            ) : null}
            {model.rightCaption ? (
              <span className="ux-reset-explorer-legend-caption">
                {model.rightCaption}
              </span>
            ) : null}
          </div>
        </div>
        {missing.length > 0 ? (
          <div className="ux-reset-explorer-legend-rurality-missing">
            {missing.map((segment) => (
              <LegendSegmentButton
                key={segment.id}
                layerTitle={model.title}
                open={openId === segment.id}
                segment={segment}
                onOpenChange={(next) => {
                  onOpenChange(next ? segment.id : null);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
      <p className="ux-reset-explorer-legend-rurality-explanation">
        {RURALITY_LEGEND_EXPLANATION}
      </p>
    </div>
  );
}

function LegendScale({
  gradient,
  layerTitle,
  leftCaption,
  onOpenChange,
  openId,
  rightCaption,
  segments,
}: {
  gradient: ExplorerLegendGradient | null;
  layerTitle: string;
  leftCaption: string | null;
  onOpenChange: (id: string | null) => void;
  openId: string | null;
  rightCaption: string | null;
  segments: readonly ExplorerLegendSegment[];
}) {
  const items = [
    ...segments.map((segment) => ({
      background: segment.color,
      id: segment.id,
      role: segment.role ?? "class",
    })),
    ...(gradient
      ? [
          {
            background: segmentBackground(gradient),
            id: "gradient",
            role: "gradient",
          },
        ]
      : []),
  ];
  const buttons = (
    <>
      {segments.map((segment) => (
        <LegendSegmentButton
          key={segment.id}
          layerTitle={layerTitle}
          open={openId === segment.id}
          segment={segment}
          onOpenChange={(next) => {
            onOpenChange(next ? segment.id : null);
          }}
        />
      ))}
      {gradient ? (
        <LegendSegmentButton
          gradient={gradient}
          layerTitle={layerTitle}
          open={openId === "gradient"}
          onOpenChange={(next) => {
            onOpenChange(next ? "gradient" : null);
          }}
        />
      ) : null}
    </>
  );
  if (gradient) {
    return (
      <div className="ux-reset-explorer-legend-row">
        {leftCaption ? (
          <span
            className="ux-reset-explorer-legend-caption"
            data-legend-caption="start"
          >
            {leftCaption}
          </span>
        ) : null}
        <LegendStrip fill="full" items={items}>
          {buttons}
        </LegendStrip>
        {rightCaption ? (
          <span
            className="ux-reset-explorer-legend-caption"
            data-legend-caption="end"
          >
            {rightCaption}
          </span>
        ) : null}
      </div>
    );
  }
  const scaleStyle: CSSProperties & { "--legend-count": number } = {
    "--legend-count": Math.max(items.length, 1),
  };
  return (
    <div className="ux-reset-explorer-legend-scale" style={scaleStyle}>
      <LegendStrip fill="count" items={items}>
        {buttons}
      </LegendStrip>
      {leftCaption || rightCaption ? (
        <div className="ux-reset-explorer-legend-captions">
          {leftCaption ? (
            <span className="ux-reset-explorer-legend-caption">
              {leftCaption}
            </span>
          ) : (
            <span />
          )}
          {rightCaption ? (
            <span className="ux-reset-explorer-legend-caption">
              {rightCaption}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function legendIdentity(paint: ExplorerMapPaint): string {
  return `${paint.layerId}:${paint.kind}:${paint.period ?? ""}:${paint.title}`;
}

export function ExplorerMapLegend({ paint }: { paint: ExplorerMapPaint }) {
  const model = useMemo(() => buildExplorerLegendModel(paint), [paint]);
  const identity = legendIdentity(paint);
  const [trackedIdentity, setTrackedIdentity] = useState(identity);
  const [openId, setOpenId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  if (trackedIdentity !== identity) {
    setTrackedIdentity(identity);
    setOpenId(null);
    setAboutOpen(false);
  }

  return (
    <section
      aria-label={`${paint.title} map legend`}
      className="ux-reset-explorer-legend"
      data-legend-kind={paint.kind}
      data-legend-layer={paint.layerId}
      data-legend-scale={model.mode}
      data-testid="explorer-map-legend"
      data-unit={paint.unit ?? ""}
    >
      <div className="ux-reset-explorer-legend-head">
        <p className="ux-reset-explorer-legend-title">
          <strong>{model.title}</strong>
          {model.unitLabel ? <span> · {model.unitLabel}</span> : null}
        </p>
        <Popover open={aboutOpen} onOpenChange={setAboutOpen}>
          <PopoverTrigger
            aria-label={model.aboutLabel}
            data-testid="explorer-legend-about"
            delay={1_000_000}
            openOnHover={false}
            render={<Button size="icon-sm" type="button" variant="ghost" />}
          >
            <Info aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            aria-label={model.aboutLabel}
            initialFocus
            side="top"
          >
            <div className="ux-reset-explorer-legend-about">
              {model.aboutSections.map((section) => (
                <section key={section.heading}>
                  <h3>{section.heading}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </section>
              ))}
              {paint.selectionEvidence ? (
                <EvidenceObject
                  claimHeadingLevel="h4"
                  model={paint.selectionEvidence}
                  showGovernedLimitations={false}
                  showReason
                />
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {model.status ? (
        <p className="ux-reset-explorer-legend-status">{model.status}</p>
      ) : null}
      {model.mode === "message" ? null : paint.layerId === "rurality" ? (
        <RuralityLegendScale
          model={model}
          openId={openId}
          onOpenChange={setOpenId}
        />
      ) : (
        <LegendScale
          gradient={model.gradient}
          layerTitle={model.title}
          leftCaption={model.leftCaption}
          openId={openId}
          rightCaption={model.rightCaption}
          segments={model.segments}
          onOpenChange={setOpenId}
        />
      )}
    </section>
  );
}
