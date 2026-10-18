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

const CreatedOpenAPIPage = createOpenAPIPage({
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
    const labelControls = () => {
      labelUnnamedOpenApiControls(root);
    };
    const resize = new ResizeObserver(labelControls);
    const watch = () => {
      labelControls();
      for (const element of root.querySelectorAll(".overflow-x-auto")) {
        resize.observe(element);
      }
    };
    watch();
    const observer = new MutationObserver(watch);
    observer.observe(root, {
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

function labelUnnamedOpenApiControls(root: ParentNode): void {
  for (const element of root.querySelectorAll(
    '[role="combobox"], [role="switch"]'
  )) {
    if (!(element instanceof HTMLElement)) continue;
    if (element.getAttribute("aria-label")?.trim()) continue;
    const label = element.closest("label");
    const source = label ?? element;
    const name = (source.textContent ?? "").replaceAll(/\s+/g, " ").trim();
    if (name) element.setAttribute("aria-label", name);
  }
  for (const element of root.querySelectorAll(".overflow-x-auto")) {
    if (!(element instanceof HTMLElement)) continue;
    if (element.scrollWidth <= element.clientWidth + 1) continue;
    if (element.tabIndex < 0) element.tabIndex = 0;
    if (!element.getAttribute("aria-label")?.trim()) {
      element.setAttribute("aria-label", "Scrollable schema path");
    }
  }
}
