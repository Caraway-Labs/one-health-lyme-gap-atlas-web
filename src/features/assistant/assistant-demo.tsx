"use client";

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

import { Button } from "@/components/ui/button";

const demoAdapter: ChatModelAdapter = {
  async *run({ abortSignal }) {
    abortSignal.throwIfAborted();
    yield {
      content: [
        {
          text: "Demo response: Atlas questions should be reviewed against the cited data source ",
          type: "text",
        },
      ],
    };
    abortSignal.throwIfAborted();
    yield {
      content: [
        {
          text: "Demo response: Atlas questions should be reviewed against the cited data source and methodology before action. This fixture does not query Atlas data or a model.",
          type: "text",
        },
      ],
    };
  },
};

function UserMessage() {
  return (
    <MessagePrimitive.Root className="bg-muted rounded-lg p-3 text-sm">
      <p className="mb-1 font-medium">You</p>
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="border-border bg-card rounded-lg border p-3 text-sm">
      <p className="mb-1 font-medium">Atlas assistant demo</p>
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  );
}

function AssistantThread() {
  const runtime = useLocalRuntime(demoAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root
        className="grid gap-4"
        aria-label="Talk with the Atlas demo"
      >
        <section
          aria-label="Demo assistant activity"
          className="border-border bg-muted/40 rounded-lg border p-3 text-sm"
        >
          <strong>Demo activity</strong>
          <p>
            This fixture represents a future safe status such as “Retrieving
            approved evidence”; it never exposes model reasoning.
          </p>
        </section>
        <ThreadPrimitive.Viewport
          className="grid min-h-48 gap-3"
          aria-live="polite"
        >
          <ThreadPrimitive.Empty>
            <div className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              Ask a question to exercise the local demo runtime. No prompt or
              response leaves this browser.
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{ AssistantMessage, UserMessage }}
          />
        </ThreadPrimitive.Viewport>
        <section
          aria-label="Example evidence source"
          className="border-border rounded-lg border p-3 text-sm"
        >
          <strong>Fixture source — not live evidence</strong>
          <p>
            CDC Lyme surveillance, published 2023. Future runtime adapters must
            supply structured source metadata.
          </p>
          <a
            className="text-primary underline"
            href="https://www.cdc.gov/lyme/"
            rel="noopener noreferrer"
            target="_blank"
          >
            Open CDC Lyme surveillance
          </a>
        </section>
        <ComposerPrimitive.Root className="grid gap-2">
          <label
            className="text-sm font-medium"
            htmlFor="atlas-assistant-message"
          >
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
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

export function AssistantDemo() {
  return <AssistantThread />;
}
