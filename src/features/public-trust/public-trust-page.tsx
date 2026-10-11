import type { ReactNode } from "react";

import "./public-trust-pages.css";

/**
 * Shared body for the public trust pages (About, Privacy, AI Ethics).
 * Header, footer, and route chrome stay in PublicLayout.
 */
export function PublicTrustPage({ children }: { children: ReactNode }) {
  return <main className="public-trust-page">{children}</main>;
}

export function PublicTrustIntro({
  children,
  eyebrow,
  title,
}: {
  children?: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className="public-trust-intro">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="type-page">{title}</h1>
      {children}
    </header>
  );
}

export function PublicTrustActions({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Related pages" className="public-trust-actions">
      {children}
    </nav>
  );
}
