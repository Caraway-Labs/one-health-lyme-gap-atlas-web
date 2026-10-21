"use client";

import { Layers, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPLORER_MAP_LAYERS,
  explorerMapLayerById,
  explorerMapLayerMenuLabel,
  type ExplorerLayerGate,
  type ExplorerMapLayerId,
} from "@/features/ux-reset/review/explorer-map-layers";

type ExplorerMapLayerControlProps = {
  gates: Record<ExplorerMapLayerId, ExplorerLayerGate>;
  layerId: ExplorerMapLayerId;
  onLayerChange: (layerId: ExplorerMapLayerId) => void;
};

export function ExplorerMapLayerControl({
  gates,
  layerId,
  onLayerChange,
}: ExplorerMapLayerControlProps) {
  const selected = explorerMapLayerById(layerId);
  const noteId = "explorer-map-layer-note";
  return (
    <div className="ux-reset-review-scope-field">
      <label className="type-small" htmlFor="explorer-map-layer">
        <Layers aria-hidden="true" />
        <span className="sr-only">Map layer</span>
      </label>
      <Select
        value={selected.id}
        onValueChange={(next) => {
          const layer = EXPLORER_MAP_LAYERS.find((entry) => entry.id === next);
          if (!layer || !gates[layer.id]?.selectable) {
            return;
          }
          onLayerChange(layer.id);
        }}
      >
        <SelectTrigger
          aria-describedby={noteId}
          aria-label="Map layer"
          className="max-w-full min-w-0"
          data-testid="explorer-map-layer"
          id="explorer-map-layer"
        >
          <SelectValue>{explorerMapLayerMenuLabel(selected)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {EXPLORER_MAP_LAYERS.map((layer) => {
            const gate = gates[layer.id];
            const selectable = gate?.selectable ?? false;
            return (
              <SelectItem
                disabled={!selectable}
                key={layer.id}
                value={layer.id}
              >
                {selectable
                  ? explorerMapLayerMenuLabel(layer)
                  : `${explorerMapLayerMenuLabel(layer)} (unavailable)`}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <p className="sr-only" id={noteId}>
        {gates[selected.id]?.reason ??
          "The county list stays a review ranking when one exists. Changing the layer does not rank counties by this measure."}
      </p>
    </div>
  );
}

export function ExplorerMapLayerAvailability({
  gates,
}: {
  gates: Record<ExplorerMapLayerId, ExplorerLayerGate>;
}) {
  const hasGap = EXPLORER_MAP_LAYERS.some(
    (layer) => !(gates[layer.id]?.selectable ?? false)
  );
  if (!hasGap) {
    return null;
  }
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label="Layer availability"
            data-testid="explorer-layer-availability"
            size="icon-sm"
            type="button"
            variant="outline"
          />
        }
      >
        <TriangleAlert aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="ux-reset-layer-availability w-[min(26rem,calc(100vw-1.5rem))] max-w-[min(26rem,calc(100vw-1.5rem))]"
        side="top"
      >
        <p>
          The county list stays a review ranking when one exists. Changing the
          layer does not rank counties by this measure.
        </p>
        <ul>
          {EXPLORER_MAP_LAYERS.map((layer) => (
            <li key={layer.id}>
              <strong>{layer.label}.</strong>{" "}
              {gates[layer.id]?.selectable
                ? "Available from the published collection for this release. Changing the layer does not rank counties by this measure."
                : (gates[layer.id]?.reason ??
                  "This layer is not available for the current release.")}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
