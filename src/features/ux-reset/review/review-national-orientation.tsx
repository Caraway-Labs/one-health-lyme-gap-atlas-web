"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { STATE_GRID } from "@/features/geographic-explorer/model";
import type { StateOrientationRow } from "@/features/ux-reset/review/build-review-presentation";

type ReviewNationalOrientationProps = {
  rows: readonly StateOrientationRow[];
  onOpenState: (stateCode: string) => void;
};

export function ReviewNationalOrientation({
  rows,
  onOpenState,
}: ReviewNationalOrientationProps) {
  const byCode = new Map(rows.map((row) => [row.code, row]));

  return (
    <Card data-testid="review-national-orientation">
      <CardHeader>
        <h2 className="type-card">State orientation</h2>
        <p className="type-body">
          National scope summarizes counties in the governed release by state.
          Open a state to see its county review list—Atlas does not show a
          nationwide county leaderboard here.
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
              const disabled = !entry || entry.countyCount === 0;
              return (
                <div
                  key={code}
                  className="ux-reset-review-state-tile"
                  style={{ gridColumn: column, gridRow: row }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    aria-label={`${code}: ${entry?.countyCount ?? 0} counties in scope`}
                    onClick={() => onOpenState(code)}
                  >
                    <strong>{code}</strong>
                    <span>
                      {entry?.countyCount
                        ? `${entry.countyCount} counties`
                        : "No counties"}
                    </span>
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
