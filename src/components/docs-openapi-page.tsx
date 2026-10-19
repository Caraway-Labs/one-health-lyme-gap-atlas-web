"use client";

import {
  createOpenAPIPage,
  type OpenAPIPageProps,
  type OpenAPIPageProps_Preloaded,
} from "fumadocs-openapi/ui";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

import {
  ExampleRequestPanel,
  ExampleResponsePanel,
  OpenApiExampleLayout,
} from "@/components/docs-openapi-example";
import { ResponseHeaders } from "@/components/docs-openapi-response-headers";
import { labelUnnamedOpenApiControls } from "@/lib/openapi-control-names";

const CreatedOpenAPIPage = createOpenAPIPage({
  content: {
    renderAPIExampleLayout(slots) {
      return (
        <OpenApiExampleLayout
          responseTabs={slots.responseTabs}
          usageTabs={slots.usageTabs}
        />
      );
    },
    renderAPIExampleUsageTabs() {
      return <ExampleRequestPanel />;
    },
    renderOperationLayout(slots) {
      return <OperationLayout {...slots} />;
    },
    renderResponseTabs() {
      return <ExampleResponsePanel />;
    },
  },
  playground: {
    enabled: false,
  },
});

type OpenApiPreload = Pick<OpenAPIPageProps_Preloaded, "preloaded">;

const OpenApiPreloadContext = createContext<OpenApiPreload | undefined>(
  undefined
);

export function OpenAPIPageProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: OpenApiPreload | undefined;
}) {
  return (
    <OpenApiPreloadContext.Provider value={value}>
      {children}
    </OpenApiPreloadContext.Provider>
  );
}

export function OpenAPIPage(props: OpenAPIPageProps) {
  const preloaded = useContext(OpenApiPreloadContext);
  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let labeling = false;
    const resize = new ResizeObserver(() => {
      labelControls();
    });
    const labelControls = () => {
      if (labeling) return;
      labeling = true;
      try {
        labelUnnamedOpenApiControls(root);
        for (const element of root.querySelectorAll(".overflow-x-auto")) {
          resize.observe(element);
        }
      } finally {
        labeling = false;
      }
    };
    labelControls();
    const observer = new MutationObserver(labelControls);
    observer.observe(root, {
      attributeFilter: [
        "aria-label",
        "aria-labelledby",
        "name",
        "role",
        "title",
      ],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, []);
  return (
    <div ref={rootRef}>
      <CreatedOpenAPIPage {...preloaded} {...props} />
    </div>
  );
}

function OperationLayout({
  apiExample,
  apiPlayground,
  authSchemes,
  body,
  callbacks,
  description,
  header,
  parameters,
  responses,
}: {
  apiExample: ReactNode;
  apiPlayground: ReactNode;
  authSchemes: ReactNode;
  body: ReactNode;
  callbacks: ReactNode;
  description: ReactNode;
  header: ReactNode;
  parameters: ReactNode;
  responses: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-x-6 gap-y-4 @4xl:flex-row @4xl:items-start">
      <div className="min-w-0 flex-1">
        {header}
        {apiPlayground}
        {description}
        {authSchemes}
        {parameters}
        {body}
        {responses}
        <ResponseHeaders />
        {callbacks}
      </div>
      <div className="@4xl:sticky @4xl:top-[calc(var(--fd-docs-row-3,0px)+1rem)] @4xl:flex @4xl:max-h-[calc(var(--fd-docs-height,100dvh)-var(--fd-docs-row-3,0px)-2rem)] @4xl:w-[400px] @4xl:flex-col">
        {apiExample}
      </div>
    </div>
  );
}
