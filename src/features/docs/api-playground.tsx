"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  API_PLAYGROUND_OPERATIONS,
  playgroundProxyPath,
  type ApiPlaygroundField,
  type ApiPlaygroundOperation,
} from "@/features/docs/api-playground-operations";

const RESPONSE_HEADERS = [
  "content-type",
  "etag",
  "cache-control",
  "retry-after",
] as const;

type ResponseHeaderName = (typeof RESPONSE_HEADERS)[number];

type PlaygroundResult = {
  body: string;
  headers: Partial<Record<ResponseHeaderName, string>>;
  status: number;
};

const initialOperation = API_PLAYGROUND_OPERATIONS[0];

export function ApiPlayground() {
  const [operationId, setOperationId] = useState(initialOperation.id);
  const operation = operationById(operationId);
  const [exampleId, setExampleId] = useState(operation.examples[0].id);
  const [values, setValues] = useState<Record<string, string>>({
    ...operation.examples[0].values,
  });
  const [ifNoneMatch, setIfNoneMatch] = useState("");
  const [statusMessage, setStatusMessage] = useState("No request sent yet.");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    },
    []
  );

  function retireInFlightRequest(): void {
    if (!abortRef.current) return;
    requestIdRef.current += 1;
    abortRef.current.abort();
    abortRef.current = null;
    setSending(false);
    setResult(undefined);
    setStatusMessage("No request sent yet.");
  }

  function startRequest(): { id: number; signal: AbortSignal } {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return { id: requestIdRef.current, signal: controller.signal };
  }

  function selectOperation(nextId: string | null) {
    if (!nextId) return;
    const next = operationById(nextId);
    const example = next.examples[0];
    retireInFlightRequest();
    setOperationId(next.id);
    setExampleId(example.id);
    setValues({ ...example.values });
    setResult(undefined);
    setStatusMessage("No request sent yet.");
  }

  function selectExample(nextId: string | null) {
    if (!nextId) return;
    const example = operation.examples.find((item) => item.id === nextId);
    if (!example) return;
    retireInFlightRequest();
    setExampleId(example.id);
    setValues({ ...example.values });
  }

  function changeValue(name: string, value: string) {
    retireInFlightRequest();
    updateValue(setValues, name, value);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestPath = publicPath(operation, values);
    const proxyPath = playgroundProxyPath(operation, values);
    const entityTag = ifNoneMatch.trim();
    const { id, signal } = startRequest();
    setSending(true);
    setResult(undefined);
    setStatusMessage(`Sending GET ${requestPath}.`);
    try {
      const headers = new Headers({ accept: "application/json" });
      if (entityTag.length > 0) {
        headers.set("if-none-match", entityTag);
      }
      const response = await fetch(proxyPath, {
        cache: "no-store",
        credentials: "omit",
        headers,
        method: "GET",
        signal,
      });
      const next = await readResult(response);
      if (requestIdRef.current !== id) return;
      setResult(next);
      setStatusMessage(`HTTP ${response.status} from GET ${requestPath}.`);
    } catch {
      if (requestIdRef.current !== id) return;
      setStatusMessage("The playground could not complete the request.");
    } finally {
      if (requestIdRef.current === id) {
        abortRef.current = null;
        setSending(false);
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API playground</CardTitle>
        <CardDescription>
          Anonymous read-only GET. The status, body, and headers below are the
          response from the public API.
        </CardDescription>
      </CardHeader>
      <form
        aria-busy={sending || undefined}
        aria-label="API playground"
        onSubmit={onSubmit}
      >
        <CardContent className="grid gap-4">
          <LabeledSelect
            display={operation.label}
            label="Endpoint"
            onValueChange={selectOperation}
            value={operation.id}
          >
            {API_PLAYGROUND_OPERATIONS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </LabeledSelect>
          {operation.examples.length > 1 ? (
            <LabeledSelect
              display={
                operation.examples.find((item) => item.id === exampleId)
                  ?.label ?? operation.examples[0].label
              }
              label="Example"
              onValueChange={selectExample}
              value={exampleId}
            >
              {operation.examples.map((example) => (
                <SelectItem key={example.id} value={example.id}>
                  {example.label}
                </SelectItem>
              ))}
            </LabeledSelect>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {operation.pathFields.map((field) => (
              <PlaygroundField
                field={field}
                key={field.name}
                onChange={(value) => changeValue(field.name, value)}
                value={values[field.name] ?? ""}
              />
            ))}
            {operation.queryFields.map((field) => (
              <PlaygroundField
                field={field}
                key={field.name}
                onChange={(value) => changeValue(field.name, value)}
                value={values[field.name] ?? ""}
              />
            ))}
          </div>
          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="api-playground-if-none-match"
            >
              If-None-Match
            </label>
            <Input
              autoComplete="off"
              id="api-playground-if-none-match"
              name="if-none-match"
              onChange={(event) => {
                retireInFlightRequest();
                setIfNoneMatch(event.target.value);
              }}
              spellCheck={false}
              value={ifNoneMatch}
            />
          </div>
          <Button disabled={sending} type="submit">
            {sending ? "Sending request" : "Send request"}
          </Button>
        </CardContent>
      </form>
      <CardContent className="grid gap-3">
        <p aria-atomic="true" aria-live="polite" role="status">
          {statusMessage}
        </p>
        {result ? <PlaygroundResponse result={result} /> : null}
      </CardContent>
    </Card>
  );
}

function LabeledSelect({
  children,
  display,
  label,
  onValueChange,
  value,
}: {
  children: ReactNode;
  display: string;
  label: string;
  onValueChange: (value: string | null) => void;
  value: string;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium" id={`api-playground-${label}`}>
        {label}
      </span>
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger
          aria-labelledby={`api-playground-${label}`}
          className="w-full max-w-xl"
        >
          <SelectValue>{display}</SelectValue>
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function PlaygroundField({
  field,
  onChange,
  value,
}: {
  field: ApiPlaygroundField;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = `api-playground-${field.name}`;
  const describedBy = field.name === "geography_id" ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {field.label}
      </label>
      <Input
        aria-describedby={describedBy}
        autoComplete="off"
        id={id}
        name={field.name}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        spellCheck={false}
        value={value}
      />
      {describedBy ? (
        <p className="text-muted-foreground text-sm" id={describedBy}>
          Five-digit county FIPS. 36061 is New York County.
        </p>
      ) : null}
    </div>
  );
}

function PlaygroundResponse({ result }: { result: PlaygroundResult }) {
  return (
    <div aria-label="API response" className="grid gap-3" role="region">
      <dl className="grid gap-2 text-sm">
        <div className="flex gap-2">
          <dt className="font-medium">Status</dt>
          <dd>{result.status}</dd>
        </div>
        {RESPONSE_HEADERS.map((name) => {
          const value = result.headers[name];
          if (!value) return null;
          return (
            <div className="flex gap-2 break-all" key={name}>
              <dt className="font-medium">{headerLabel(name)}</dt>
              <dd>{value}</dd>
            </div>
          );
        })}
      </dl>
      <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-3 text-sm wrap-break-word whitespace-pre-wrap">
        <code>{result.body.length > 0 ? result.body : "Empty body."}</code>
      </pre>
    </div>
  );
}

function headerLabel(name: ResponseHeaderName): string {
  switch (name) {
    case "cache-control": {
      return "Cache-Control";
    }
    case "content-type": {
      return "Content-Type";
    }
    case "etag": {
      return "ETag";
    }
    case "retry-after": {
      return "Retry-After";
    }
    default: {
      const exhaustive: never = name;
      return exhaustive;
    }
  }
}

async function readResult(response: Response): Promise<PlaygroundResult> {
  const headers: PlaygroundResult["headers"] = {};
  for (const name of RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  const contentType = headers["content-type"] ?? "";
  const text = await response.text();
  return {
    body: displayBody(contentType, text),
    headers,
    status: response.status,
  };
}

function displayBody(contentType: string, text: string): string {
  if (
    contentType.includes("application/pdf") ||
    contentType.includes("octet-stream")
  ) {
    return `Binary response, ${text.length} bytes.`;
  }
  if (text.length > 100_000) {
    return `${text.slice(0, 100_000)}\n\nResponse truncated for display.`;
  }
  return text;
}

function operationById(id: string): ApiPlaygroundOperation {
  return (
    API_PLAYGROUND_OPERATIONS.find((item) => item.id === id) ??
    API_PLAYGROUND_OPERATIONS[0]
  );
}

function publicPath(
  operation: ApiPlaygroundOperation,
  values: Readonly<Record<string, string>>
): string {
  return playgroundProxyPath(operation, values).replace(/^\/api\/proxy/, "");
}

function updateValue(
  setValues: (
    update: (current: Record<string, string>) => Record<string, string>
  ) => void,
  name: string,
  value: string
): void {
  setValues((current) => ({ ...current, [name]: value }));
}
