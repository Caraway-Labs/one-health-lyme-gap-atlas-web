import type { ReactNode } from "react";

import { UxLabBanner } from "@/features/ux-lab/ux-lab-banner";

export function UxLabShell({ children }: { children: ReactNode }) {
  return (
    <div className="ux-lab-shell">
      <a className="ux-lab-skip" href="#ux-lab-content">
        Skip to prototype content
      </a>
      <UxLabBanner />
      <div id="ux-lab-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
