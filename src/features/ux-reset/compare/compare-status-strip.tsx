"use client";

import { LoaderCircle } from "lucide-react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { CompareStatusError } from "@/features/ux-reset/compare/compare-status-errors";

export type CompareLoadStep = {
  done: boolean;
  id: string;
  label: string;
};

export type CompareStatusRetry = {
  busy: boolean;
  label: string;
  onRetry: () => void;
  waiting: boolean;
};

function RetryButton({ retry }: { retry: CompareStatusRetry }) {
  const handleRetry = retry.onRetry;
  return (
    <Button
      aria-busy={retry.busy}
      data-testid="compare-retry"
      data-waiting={retry.waiting ? "true" : "false"}
      disabled={retry.busy}
      size="sm"
      type="button"
      variant="secondary"
      onClick={handleRetry}
    >
      {retry.label}
    </Button>
  );
}

/**
 * One calm place for everything that is loading or went wrong.
 * Loading shows a single line with progress. Errors collect into one alert
 * with a single retry. The strip keeps its height so results do not jump.
 */
export function CompareStatusStrip({
  errors,
  reserve,
  retry,
  steps,
}: {
  errors: readonly CompareStatusError[];
  reserve: boolean;
  retry: CompareStatusRetry | null;
  steps: readonly CompareLoadStep[];
}) {
  const pending = steps.filter((step) => !step.done);
  const done = steps.length - pending.length;
  const nextLabel = pending[0]?.label;
  return (
    <div
      className="ux-reset-compare-status"
      data-reserve={reserve ? "true" : "false"}
      data-testid="compare-status"
    >
      {pending.length > 0 ? (
        <AtlasStatusMessage
          className="ux-reset-compare-status-loading"
          tone="loading"
        >
          <p data-testid="compare-loading">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            <span>
              {nextLabel}
              <span className="text-muted-foreground">
                {" "}
                · {done} of {steps.length} ready
              </span>
            </span>
          </p>
          <Progress
            aria-label="Comparison data loading progress"
            className="ux-reset-compare-status-progress"
            value={steps.length === 0 ? 0 : (done / steps.length) * 100}
          />
          {errors.length === 0 && retry ? <RetryButton retry={retry} /> : null}
        </AtlasStatusMessage>
      ) : null}
      {errors.length > 0 ? (
        <AtlasStatusMessage
          action={retry ? <RetryButton retry={retry} /> : null}
          className="ux-reset-compare-status-error"
          tone="error"
        >
          <ul>
            {errors.map((error) => (
              <li
                data-testid={`compare-status-error-${error.id}`}
                key={error.id}
              >
                {error.message}
              </li>
            ))}
          </ul>
        </AtlasStatusMessage>
      ) : null}
    </div>
  );
}
