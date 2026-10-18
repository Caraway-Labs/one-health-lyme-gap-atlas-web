"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  ASK_ATLAS_INHERITED_FIELD_KEYS,
  type AskAtlasInheritedFieldKey,
  type AskAtlasSurface,
} from "@/features/ux-reset/ask-atlas/inherited-context";
import {
  absentAskAtlasPageReference,
  askAtlasReturnLabel,
  readAskAtlasPageReferenceClient,
  subscribeAskAtlasPageReference,
} from "@/features/ux-reset/ask-atlas/page-reference";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<AskAtlasInheritedFieldKey, string> = {
  geography: "Geography",
  measure: "Measure",
  period: "Period",
  release: "Release",
  source: "Source",
};

function boundaryCopy(surface: AskAtlasSurface): string {
  const purpose =
    "This page reference helps you return to where you were. Answers search reviewed literature. It is not a citation, and it is not sent with the question.";
  switch (surface) {
    case "compare": {
      return `${purpose} Ask Atlas does not compare these counties.`;
    }
    case "action":
    case "explore":
    case "investigate":
    case "review": {
      return `${purpose} Changing it does not request county data.`;
    }
    default: {
      const exhaustive: never = surface;
      return exhaustive;
    }
  }
}

export function AskAtlasPageReferenceStrip() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const state = useSyncExternalStore(
    subscribeAskAtlasPageReference,
    () => readAskAtlasPageReferenceClient(pathname, search),
    absentAskAtlasPageReference
  );

  if (state.kind === "absent") {
    return null;
  }

  if (state.kind === "unverified") {
    return (
      <section
        aria-labelledby="ask-atlas-page-reference-title"
        className="ux-reset-ask-atlas-reference"
        data-reference-state="unverified"
        data-testid="ask-atlas-page-reference"
      >
        <h2 id="ask-atlas-page-reference-title">Page reference</h2>
        <p>
          This page reference could not be verified. It is not evidence, and it
          was not retrieved for an answer.
        </p>
        <div className="ux-reset-ask-atlas-reference-actions">
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={state.clearHref}
          >
            Clear page reference
          </Link>
        </div>
      </section>
    );
  }

  const { reference } = state;
  return (
    <section
      aria-labelledby="ask-atlas-page-reference-title"
      className="ux-reset-ask-atlas-reference"
      data-ask-atlas-surface={reference.context.surface}
      data-reference-state="validated"
      data-testid="ask-atlas-page-reference"
    >
      <h2 id="ask-atlas-page-reference-title">Page reference</h2>
      <p>{boundaryCopy(reference.context.surface)}</p>
      <dl className="ux-reset-ask-atlas-reference-list">
        {ASK_ATLAS_INHERITED_FIELD_KEYS.map((key) => {
          const field = reference.context.fields[key];
          if (field.state !== "validated") {
            return null;
          }
          const removeHref = state.removeHrefs[key];
          return (
            <div
              data-field={key}
              data-field-id={field.id}
              data-field-state="validated"
              key={key}
            >
              <dt>{FIELD_LABELS[key]}</dt>
              <dd>
                <span>{field.label}</span>
                {removeHref ? (
                  <Link
                    className={cn(
                      buttonVariants({ size: "sm", variant: "outline" })
                    )}
                    href={removeHref}
                  >
                    {`Remove ${FIELD_LABELS[key].toLowerCase()}`}
                  </Link>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      <div className="ux-reset-ask-atlas-reference-actions">
        <Link
          className={buttonVariants({ size: "sm", variant: "secondary" })}
          data-testid="ask-atlas-return"
          href={state.returnHref}
        >
          {askAtlasReturnLabel(reference.context.surface)}
        </Link>
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={state.clearHref}
        >
          Clear page reference
        </Link>
      </div>
    </section>
  );
}
