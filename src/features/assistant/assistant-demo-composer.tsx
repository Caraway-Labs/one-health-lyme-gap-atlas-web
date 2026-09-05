"use client";

import { ComposerPrimitive, useAuiState } from "@assistant-ui/react";

import { Button } from "@/components/ui/button";

export function AssistantDemoComposer() {
  const loading = useAuiState((state) => state.thread.isLoading);
  if (loading)
    return <p role="status">Preparing the local demo conversation…</p>;
  return (
    <ComposerPrimitive.Root className="grid gap-2">
      <label className="text-sm font-medium" htmlFor="atlas-assistant-message">
        Ask the Atlas demo
      </label>
      <ComposerPrimitive.Input
        id="atlas-assistant-message"
        className="border-input bg-background min-h-24 rounded-lg border p-3"
        placeholder="For example: What should I review for this county?"
      />
      <div className="flex gap-2">
        <ComposerPrimitive.Send
          render={<Button type="submit">Send demo question</Button>}
        />
        <ComposerPrimitive.Cancel
          render={
            <Button type="button" variant="outline">
              Stop
            </Button>
          }
        />
      </div>
    </ComposerPrimitive.Root>
  );
}
