"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReviewScope } from "@/features/ux-reset/review/resolve-review-scope";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";
import { reviewScopeLabel } from "@/lib/atlas-state-geography";

type ReviewScopeSelectorProps = {
  scope: ReviewScope;
  showVisibleLabel?: boolean;
  stateOptions: readonly AtlasStateOption[];
  onScopeChange: (scope: ReviewScope) => void;
};

export function ReviewScopeSelector({
  scope,
  showVisibleLabel = true,
  stateOptions,
  onScopeChange,
}: ReviewScopeSelectorProps) {
  const value = scope === "ALL" ? "ALL" : scope;
  const Field = showVisibleLabel ? "label" : "div";

  return (
    <Field className="ux-reset-review-scope-field">
      {showVisibleLabel ? <span className="type-small">State</span> : null}
      <Select
        value={value}
        onValueChange={(next) => {
          if (!next) {
            return;
          }
          // Item press reports the selected value even when it already matches.
          onScopeChange(next === "ALL" ? "ALL" : next);
        }}
      >
        <SelectTrigger
          aria-label="State"
          className="w-full min-w-0"
          data-testid="review-scope-select"
        >
          <SelectValue>{reviewScopeLabel(scope, stateOptions)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">United States</SelectItem>
          {stateOptions.map((state) => (
            <SelectItem key={state.code} value={state.code}>
              {state.name} ({state.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
