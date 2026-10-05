import {
  ASK_ATLAS_INHERITED_FIELD_KEYS,
  type AskAtlasInheritedContext,
  type AskAtlasInheritedFieldKey,
} from "@/features/ux-reset/ask-atlas/inherited-context";

const FIELD_LABELS: Record<AskAtlasInheritedFieldKey, string> = {
  geography: "Inherited geography",
  measure: "Inherited measure",
  period: "Inherited period",
  release: "Inherited release",
  source: "Inherited source",
};

function contextState(
  context: AskAtlasInheritedContext | null
): "complete" | "none" | "partial" {
  if (!context) {
    return "none";
  }
  const validatedCount = ASK_ATLAS_INHERITED_FIELD_KEYS.filter(
    (key) => context.fields[key].state === "validated"
  ).length;
  if (validatedCount === ASK_ATLAS_INHERITED_FIELD_KEYS.length) {
    return "complete";
  }
  return "partial";
}

export function InheritedContextNotice({
  context,
}: {
  context: AskAtlasInheritedContext | null;
}) {
  const state = contextState(context);
  return (
    <section
      aria-label="Inherited page context"
      className="ux-reset-ask-atlas-inherited"
      data-ask-atlas-surface={context?.surface ?? "none"}
      data-context-state={state}
      data-testid="ask-atlas-inherited-context"
    >
      <h2 className="ux-reset-ask-atlas-inherited-title">
        Inherited from this page
      </h2>
      <p>
        Ask Atlas did not retrieve this context. It is not a citation, and it is
        not evidence the answer used.
      </p>
      {state === "none" ? (
        <p data-testid="ask-atlas-no-context">
          No validated page context is available to inherit.
        </p>
      ) : (
        <dl className="ux-reset-ask-atlas-inherited-list">
          {ASK_ATLAS_INHERITED_FIELD_KEYS.map((key) => {
            const field = context?.fields[key];
            const validated = field?.state === "validated";
            return (
              <div
                data-field={key}
                data-field-id={validated ? field.id : undefined}
                data-field-state={validated ? "validated" : "absent"}
                key={key}
              >
                <dt>{FIELD_LABELS[key]}</dt>
                <dd>
                  {validated ? field.label : "Not validated on this page"}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
