"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { STATE_GRID } from "@/features/geographic-explorer/model";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";

type ReviewNationalOrientationProps = {
  states: readonly AtlasStateOption[];
  onOpenState: (stateCode: string) => void;
};

export function ReviewNationalOrientation({
  states,
  onOpenState,
}: ReviewNationalOrientationProps) {
  const byCode = new Map(states.map((state) => [state.code, state]));

  return (
    <Card data-testid="review-national-orientation">
      <CardHeader>
        <h2 className="type-card">State orientation</h2>
        <p className="type-body">
          Choose a state to open its review result. National scope does not
          assemble a nationwide county list.
        </p>
      </CardHeader>
      <CardContent>
        <div
          className="ux-reset-review-state-grid-scroll"
          role="region"
          aria-label="United States state orientation grid"
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <div className="ux-reset-review-state-grid">
            {STATE_GRID.map(({ code, row, column }) => {
              const entry = byCode.get(code);
              return (
                <div
                  key={code}
                  className="ux-reset-review-state-tile"
                  style={{ gridColumn: column, gridRow: row }}
                >
                  <Button
                    className="h-auto min-h-14 w-full px-1 py-1 leading-tight whitespace-normal"
                    type="button"
                    variant="outline"
                    disabled={!entry}
                    aria-label={
                      entry
                        ? `${code}, ${entry.name}`
                        : `${code}, not in this release`
                    }
                    onClick={() => onOpenState(code)}
                  >
                    <strong>{code}</strong>
                    {entry ? <span>{entry.name}</span> : null}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
