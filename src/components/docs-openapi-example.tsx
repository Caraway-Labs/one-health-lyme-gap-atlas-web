"use client";

import { Select } from "@base-ui/react/select";
import { Switch } from "@base-ui/react/switch";
import { getRaw } from "@scalar/json-magic/magic-proxy";
import { useComponents, useOpenAPI } from "fumadocs-openapi";
import {
  useCodeUsage,
  useExampleRequests,
  useOperation,
  useResponseExamples,
  type ResponseExample,
} from "fumadocs-openapi/operation";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { OPENAPI_CONTROL_NAMES } from "@/lib/openapi-control-names";

const exampleCardClassName =
  "mb-4 flex min-h-0 flex-col overflow-hidden rounded-xl border bg-fd-card";

export function OpenApiExampleLayout({
  responseTabs,
  usageTabs,
}: {
  responseTabs: ReactNode;
  usageTabs: ReactNode;
}) {
  return (
    <div
      className="prose-no-margin flex min-h-0 flex-col"
      data-openapi-example=""
    >
      {usageTabs}
      {responseTabs}
    </div>
  );
}

export function ExampleRequestPanel() {
  const { codeUsages } = useOperation();
  const examples = useExampleRequests();
  const usageMap = codeUsages.map();
  const languages = [...usageMap].map(([value, item]) => ({
    label: item.label ?? item.lang,
    value,
  }));
  const [language, setLanguage] = useState(languages[0]?.value ?? "");
  const code = useCodeUsage(language);
  const selectedExample = examples.items.find(
    (item) => item.id === examples.selected
  );
  const { CodeBlock } = useComponents();
  const handleExampleRequest = (value: string) => {
    examples.select(value);
  };

  if (!language) return null;

  return (
    <div className={exampleCardClassName}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b ps-4 pe-1.5 text-[0.8125rem] font-medium">
        {examples.items.length > 1 ? (
          <LabeledSelect
            className="text-fd-foreground -ms-2 me-auto max-w-none min-w-0 shrink"
            label={OPENAPI_CONTROL_NAMES.exampleRequest}
            onValueChange={handleExampleRequest}
            options={examples.items.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            value={selectedExample?.id ?? examples.items[0]?.id ?? ""}
          />
        ) : (
          <span className="me-auto truncate">Example Request</span>
        )}
        {languages.length > 1 ? (
          <LabeledSelect
            label={OPENAPI_CONTROL_NAMES.codeSampleLanguage}
            onValueChange={setLanguage}
            options={languages}
            value={language}
          />
        ) : (
          <span className="text-fd-muted-foreground px-2">
            {languages[0]?.label}
          </span>
        )}
      </div>
      {code ? (
        <CodeBlock
          code={code}
          codeblock={{
            className:
              "flex min-h-0 flex-col rounded-none border-0 bg-transparent shadow-none",
            viewportProps: { className: "min-h-0" },
          }}
          lang={codeUsages.get(language)?.lang ?? "bash"}
        />
      ) : null}
    </div>
  );
}

export function ExampleResponsePanel() {
  const tabs = useResponseExamples();
  const { doc } = useOpenAPI();
  const { CodeBlock, Markdown } = useComponents();
  const [status, setStatus] = useState(tabs[0]?.code ?? "");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [showSchema, setShowSchema] = useState(false);
  if (tabs.length === 0) return null;

  const tab = tabs.find((item) => item.code === status) ?? tabs[0];
  if (!tab) return null;
  const examples = tab.examples ?? [];
  const example = examples[exampleIndex] ?? examples[0];
  const media = tab.mediaType
    ? doc.resolve(tab.response.content?.[tab.mediaType])
    : undefined;
  const schema =
    media && typeof media === "object" && "schema" in media
      ? media.schema
      : undefined;
  let body: ReactNode = (
    <p className="text-fd-muted-foreground px-4 py-3 text-sm">Empty</p>
  );
  if (showSchema && schema !== undefined) {
    body = (
      <CodeBlock
        code={JSON.stringify(doc.resolve(schema), (_key, value: unknown) =>
          getRaw(value)
        )}
        codeblock={{
          className:
            "flex min-h-0 flex-col rounded-none border-0 bg-transparent shadow-none",
          viewportProps: { className: "min-h-0" },
        }}
        lang="json"
      />
    );
  } else if (example) {
    body = (
      <>
        {example.description || examples.length > 1 ? (
          <div className="shrink-0 px-4 pt-2.5">
            {examples.length > 1 ? (
              <LabeledSelect
                align="start"
                label={OPENAPI_CONTROL_NAMES.responseExample}
                onValueChange={(value) => {
                  setExampleIndex(Number(value));
                }}
                options={examples.map((item, index) => ({
                  label: responseExampleLabel(item, index),
                  value: String(index),
                }))}
                value={String(examples[exampleIndex] ? exampleIndex : 0)}
              />
            ) : null}
            {example.description ? <Markdown md={example.description} /> : null}
          </div>
        ) : null}
        <CodeBlock
          code={JSON.stringify(example.sample, null, 2)}
          codeblock={{
            className:
              "flex min-h-0 flex-col rounded-none border-0 bg-transparent shadow-none",
            viewportProps: { className: "min-h-0 pt-2" },
          }}
          lang="json"
        />
      </>
    );
  }

  return (
    <div className={exampleCardClassName}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b ps-4 pe-1.5 text-[0.8125rem] font-medium">
        <span className="me-auto truncate">Example Response</span>
        {schema === undefined ? null : (
          <span className="text-fd-muted-foreground flex shrink-0 items-center gap-2">
            Schema
            <Switch.Root
              aria-label={OPENAPI_CONTROL_NAMES.schemaSwitch}
              checked={showSchema}
              className="bg-fd-accent focus-visible:ring-fd-ring data-checked:bg-fd-primary inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
              onCheckedChange={setShowSchema}
            >
              <Switch.Thumb className="bg-fd-muted-foreground data-checked:bg-fd-primary-foreground size-3 rounded-full transition-[translate,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] data-checked:translate-x-3 motion-reduce:transition-none" />
            </Switch.Root>
          </span>
        )}
        <LabeledSelect
          label={OPENAPI_CONTROL_NAMES.responseStatus}
          onValueChange={(value) => {
            setStatus(value);
            setExampleIndex(0);
          }}
          options={tabs.map((item) => ({
            label: item.code,
            value: item.code,
          }))}
          value={tab.code}
        />
      </div>
      {body}
    </div>
  );
}

function responseExampleLabel(example: ResponseExample, index: number): string {
  return typeof example.label === "string" && example.label.trim()
    ? example.label
    : `Example ${index + 1}`;
}

function LabeledSelect({
  align = "end",
  className = "",
  label,
  onValueChange,
  options,
  value,
}: {
  align?: "center" | "end" | "start";
  className?: string;
  label: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  return (
    <Select.Root
      items={options}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      value={value}
    >
      <Select.Trigger
        aria-label={label}
        className={`text-fd-muted-foreground hover:text-fd-accent-foreground data-popup-open:bg-fd-accent data-popup-open:text-fd-accent-foreground flex h-7 w-fit max-w-1/2 shrink-0 items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-0 text-start text-[0.8125rem] font-medium focus:outline-none focus-visible:ring-2 ${className}`}
      >
        <Select.Value className="min-w-0 truncate" />
        <Select.Icon className="text-fd-muted-foreground ms-auto shrink-0">
          <ChevronDown className="size-3.5" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner align={align} className="z-50" sideOffset={4}>
          <Select.Popup className="bg-fd-popover text-fd-popover-foreground relative z-50 max-w-80 min-w-[calc(var(--anchor-width)+--spacing(2))] overflow-hidden rounded-lg border shadow-md">
            <Select.List className="p-1">
              {options.map((option) => (
                <Select.Item
                  className="data-[highlighted]:bg-fd-accent data-[highlighted]:text-fd-accent-foreground flex items-center rounded-md px-2 py-1.5 text-[0.8125rem] font-medium outline-none"
                  key={option.value}
                  value={option.value}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
