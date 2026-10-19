"use client";

import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  copyPageMarkdown,
  copyWithDocumentExecCommand,
  docsPageActionPath,
  loadDocsPageMarkdown,
} from "@/lib/docs-page-actions";
import { cn } from "@/lib/utils";

const COPIED_MESSAGE = "Copied page Markdown.";
const UNAVAILABLE_MESSAGE =
  "Clipboard is unavailable. The page Markdown is selected below.";
const LOAD_ERROR_MESSAGE = "Could not load this page's Markdown.";

export function DocsPageActions({ pageUrl }: { pageUrl: string }) {
  const markdownUrl = docsPageActionPath(pageUrl, "copy-markdown");
  const sourceUrl = docsPageActionPath(pageUrl, "view-source");
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const manualRef = useRef<HTMLTextAreaElement>(null);
  const copying = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [manualCopy, setManualCopy] = useState("");

  useEffect(() => {
    if (manualCopy.length === 0) return;
    const node = manualRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [manualCopy]);

  async function onCopy(): Promise<void> {
    if (copying.current) return;
    copying.current = true;
    setBusy(true);
    try {
      const markdown = await loadDocsPageMarkdown(markdownUrl);
      const result = await copyPageMarkdown(
        markdown,
        navigator.clipboard,
        (value) => copyWithDocumentExecCommand(value)
      );
      if (result.status === "copied") {
        setManualCopy("");
        setMessage(COPIED_MESSAGE);
        if (result.method === "fallback") copyButtonRef.current?.focus();
        return;
      }
      setManualCopy(markdown);
      setMessage(UNAVAILABLE_MESSAGE);
    } catch {
      setManualCopy("");
      setMessage(LOAD_ERROR_MESSAGE);
    } finally {
      copying.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="not-prose flex flex-col gap-2" data-docs-page-actions="">
      <div
        aria-label="Page actions"
        className="flex flex-wrap items-center gap-2"
        role="group"
      >
        <Button
          aria-busy={busy}
          onClick={() => {
            void onCopy();
          }}
          ref={copyButtonRef}
          size="sm"
          type="button"
          variant="outline"
        >
          <Copy aria-hidden="true" />
          Copy Markdown
        </Button>
        <a
          aria-label="View source, opens raw Markdown in a new tab"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          href={sourceUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          View source
        </a>
      </div>
      <p
        aria-live="polite"
        className={cn(
          "text-muted-foreground text-sm",
          message.length === 0 && "sr-only"
        )}
        role="status"
      >
        {message}
      </p>
      {manualCopy.length > 0 ? (
        <textarea
          aria-label="Page Markdown"
          className="border-border bg-background text-foreground max-h-48 w-full rounded-lg border p-3 font-mono text-sm"
          readOnly
          ref={manualRef}
          value={manualCopy}
        />
      ) : null}
    </div>
  );
}
