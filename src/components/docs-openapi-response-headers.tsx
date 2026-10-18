"use client";

import { useOpenAPI } from "fumadocs-openapi";
import { useOperation } from "fumadocs-openapi/operation";
import { useLayoutEffect, useState } from "react";

import { responseHeaders } from "@/lib/openapi-response-headers";

export function ResponseHeaders() {
  const { doc } = useOpenAPI();
  const { responses } = useOperation();
  const [status, setStatus] = useState(responses[0]?.status ?? "");

  useLayoutEffect(() => {
    const statuses = new Set(responses.map((item) => item.status));
    const sync = () => {
      const selected = selectedResponseStatus(statuses);
      if (selected) setStatus(selected);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributeFilter: ["aria-selected"],
      attributes: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
    };
  }, [responses]);

  const current = responses.find((item) => item.status === status);
  const headers = current
    ? responseHeaders(current.response.headers, doc.resolve)
    : [];
  if (headers.length === 0) return null;

  return (
    <section aria-label="Response Headers" className="mt-6">
      <h3 className="mb-3 text-lg font-medium">Response Headers</h3>
      <ul className="space-y-4">
        {headers.map((header) => (
          <li key={header.name}>
            <h4 className="font-mono text-sm font-medium">{header.name}</h4>
            {header.required ? (
              <p className="text-fd-muted-foreground text-sm">Required</p>
            ) : null}
            {header.schema ? (
              <p className="text-sm">
                Schema <code>{header.schema}</code>
              </p>
            ) : null}
            {header.description ? (
              <p className="text-fd-muted-foreground text-sm">
                {header.description}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function selectedResponseStatus(statuses: Set<string>): string | undefined {
  const selected = document.querySelectorAll(
    '[role="tab"][aria-selected="true"]'
  );
  for (const tab of selected) {
    const name = tab.textContent?.trim();
    if (name && statuses.has(name)) return name;
  }
  return undefined;
}
