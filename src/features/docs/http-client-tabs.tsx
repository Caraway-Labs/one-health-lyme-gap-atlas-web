"use client";

import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import {
  HTTP_CLIENT_GROUP_ID,
  HTTP_CLIENT_LANGUAGES,
  httpClientExamples,
  httpClientPaginationExamples,
  resolveHttpClientRequests,
  type HttpClientBody,
  type HttpClientExamples,
  type HttpClientRequest,
} from "@/features/docs/http-client-examples";

function ClientTabs({ examples }: { examples: HttpClientExamples }) {
  return (
    <Tabs
      groupId={HTTP_CLIENT_GROUP_ID}
      items={[...HTTP_CLIENT_LANGUAGES]}
      label="Client"
      persist
    >
      {HTTP_CLIENT_LANGUAGES.map((language) => (
        <Tab key={language} value={language}>
          <pre className="text-sm break-all whitespace-pre-wrap">
            <code>{examples[language]}</code>
          </pre>
        </Tab>
      ))}
    </Tabs>
  );
}

export function HttpClientTabs({
  body,
  path,
  query,
  requests,
}: {
  body?: HttpClientBody;
  path?: string;
  query?: string;
  requests?: readonly HttpClientRequest[];
}) {
  return (
    <ClientTabs
      examples={httpClientExamples(
        resolveHttpClientRequests({ body, path, query, requests })
      )}
    />
  );
}

export function HttpClientPagination({
  path,
  query,
}: {
  path: string;
  query: string;
}) {
  return (
    <ClientTabs examples={httpClientPaginationExamples({ path, query })} />
  );
}
