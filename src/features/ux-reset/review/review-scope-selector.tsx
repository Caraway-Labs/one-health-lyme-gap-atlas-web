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
  stateOptions: readonly AtlasStateOption[];
  onScopeChange: (scope: ReviewScope) => void;
};

export function ReviewScopeSelector({
  scope,
  stateOptions,
  onScopeChange,
}: ReviewScopeSelectorProps) {
  const value = scope === "ALL" ? "ALL" : scope;

  return (
    <label className="ux-reset-review-scope-field">
      <span className="type-small">Jurisdiction</span>
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
          aria-label="Jurisdiction"
          className="h-11 w-full max-w-md"
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
    </label>
  );
}
