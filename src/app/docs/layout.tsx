import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { DocsAccessibility } from "@/components/docs-accessibility";
import { FrontPorchTrustFooter } from "@/features/front-porch/front-porch-trust-footer";
import { docsSource } from "@/lib/docs-source";

import "@/features/ux-reset/trust-footer.css";

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
                <BrandMark size={28} />
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
      <div className="atlas-anonymous-trust">
        <FrontPorchTrustFooter />
      </div>
    </RootProvider>
  );
}
