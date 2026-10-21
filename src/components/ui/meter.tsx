"use client";

import { Meter as MeterPrimitive } from "@base-ui/react/meter";

import { cn } from "@/lib/utils";

/**
 * A scalar measurement inside a known range (score 0-100, completeness 0-100).
 * Use `Progress` for task progress. The meter never animates severity.
 */
function Meter({
  className,
  children,
  value,
  ...props
}: MeterPrimitive.Root.Props) {
  return (
    <MeterPrimitive.Root
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}
      data-slot="meter"
      value={value}
      {...props}
    >
      {children}
      <MeterTrack>
        <MeterIndicator />
      </MeterTrack>
    </MeterPrimitive.Root>
  );
}

/** Bare root for compositions that place the track themselves. */
function MeterRoot({ className, ...props }: MeterPrimitive.Root.Props) {
  return (
    <MeterPrimitive.Root
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}
      data-slot="meter"
      {...props}
    />
  );
}

function MeterTrack({ className, ...props }: MeterPrimitive.Track.Props) {
  return (
    <MeterPrimitive.Track
      className={cn(
        "bg-muted relative block h-1.5 w-full overflow-hidden rounded-full",
        className
      )}
      data-slot="meter-track"
      {...props}
    />
  );
}

function MeterIndicator({
  className,
  ...props
}: MeterPrimitive.Indicator.Props) {
  return (
    <MeterPrimitive.Indicator
      className={cn("bg-primary h-full rounded-full", className)}
      data-slot="meter-indicator"
      {...props}
    />
  );
}

function MeterLabel({ className, ...props }: MeterPrimitive.Label.Props) {
  return (
    <MeterPrimitive.Label
      className={cn("text-xs font-medium", className)}
      data-slot="meter-label"
      {...props}
    />
  );
}

function MeterValue({ className, ...props }: MeterPrimitive.Value.Props) {
  return (
    <MeterPrimitive.Value
      className={cn(
        "text-muted-foreground ml-auto text-xs tabular-nums",
        className
      )}
      data-slot="meter-value"
      {...props}
    />
  );
}

export { Meter, MeterRoot, MeterTrack, MeterIndicator, MeterLabel, MeterValue };
