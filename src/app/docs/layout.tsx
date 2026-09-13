import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { DocsAccessibility } from "@/components/docs-accessibility";
import { docsSource } from "@/lib/docs-source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{ options: { api: "/api/search" } }}
      theme={{ enabled: false }}
    >
      <div className="atlas-docs-root">
        <DocsAccessibility />
        <DocsLayout
          nav={{
            title: (
              <span className="atlas-docs-brand">
                <span aria-hidden="true" className="atlas-docs-brand-mark">
                  +
                </span>
                <span>Atlas documentation</span>
              </span>
            ),
            url: "/docs",
          }}
          searchToggle={{ enabled: true }}
          themeSwitch={{ enabled: false }}
          tree={docsSource.getPageTree()}
        >
          {children}
        </DocsLayout>
      </div>
    </RootProvider>
  );
}
