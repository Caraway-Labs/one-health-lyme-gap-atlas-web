/**
 * Fumadocs renders "Last updated on" empty until a client effect formats the
 * date. Generated API reference pages are large enough that the effect can
 * still be pending when a reader, or the docs route check, looks at the page.
 * The date is formatted on the server so the first HTML already contains it.
 */
export function DocsLastUpdated({ date }: { date: Date }) {
  return (
    <p className="text-fd-muted-foreground text-sm">
      Last updated on{" "}
      <time dateTime={date.toISOString()}>{date.toLocaleDateString()}</time>
    </p>
  );
}
