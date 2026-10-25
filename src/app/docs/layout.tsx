import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { CSSProperties, ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { DocsAccessibility } from "@/components/docs-accessibility";
import {
  DocsHeader,
  DocsHomeQuickstart,
  DocsSidebarTabs,
} from "@/components/docs-section-nav";
import { FrontPorchTrustFooter } from "@/features/front-porch/front-porch-trust-footer";
import { DOCS_SITE_TITLE } from "@/lib/docs-config";
import { docsSource } from "@/lib/docs-source";

import "@/features/ux-reset/trust-footer.css";

const docsLayoutStyle = {
  "--fd-header-height": "3.5rem",
} as CSSProperties;

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{ options: { api: "/api/search" } }}
      theme={{ enabled: false }}
    >
      <div className="atlas-docs-root">
        <DocsAccessibility />
        <DocsLayout
          containerProps={{ style: docsLayoutStyle }}
          nav={{
            title: (
              <span className="atlas-docs-brand">
                <BrandMark size={28} />
                <span>{DOCS_SITE_TITLE}</span>
              </span>
            ),
            url: "/docs",
          }}
          searchToggle={{ enabled: true }}
          sidebar={{
            banner: (
              <>
                <DocsSidebarTabs />
                <DocsHomeQuickstart />
              </>
            ),
          }}
          slots={{ header: DocsHeader }}
          tabs={false}
          themeSwitch={{ enabled: false }}
          tree={docsSource.getPageTree()}
        >
          {children}
        </DocsLayout>
      </div>
      <div className="atlas-anonymous-trust">
        <FrontPorchTrustFooter />
      </div>
    </RootProvider>
  );
}
