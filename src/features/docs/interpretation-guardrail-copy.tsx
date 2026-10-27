"use client";

import { Callout } from "fumadocs-ui/components/callout";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";

import { ATLAS_INTERPRETATION_GUARDRAILS } from "./interpretation-guardrails";

export function InterpretationGuardrailCopy(): ReactElement {
  const [copied, setCopied] = useState(false);

  async function copyGuardrails(): Promise<void> {
    await navigator.clipboard.writeText(ATLAS_INTERPRETATION_GUARDRAILS);
    setCopied(true);
  }

  return (
    <div className="my-4 flex flex-col gap-3">
      <Button
        onClick={() => {
          void copyGuardrails();
        }}
        type="button"
        variant="outline"
      >
        {copied
          ? "Copied interpretation guardrails"
          : "Copy interpretation guardrails"}
      </Button>
      <Callout title="Interpret with care" type="warn">
        <pre className="border-border bg-muted overflow-x-auto rounded-lg border p-4 text-sm whitespace-pre-wrap">
          <code>{ATLAS_INTERPRETATION_GUARDRAILS}</code>
        </pre>
      </Callout>
    </div>
  );
}
