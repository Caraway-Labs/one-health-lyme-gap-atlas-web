"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { DATA_DICTIONARY } from "@/lib/data-dictionary";

export function SiteNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dictionaryDialog = useRef<HTMLDialogElement>(null);
  const sectionHref = (section: string) => `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}#${section}`;

  return (
    <nav className="topbar" aria-label="Main navigation">
      <Link className="brand" href="/#atlas" aria-label="One Health Lyme Gap Atlas home"><span className="brand-mark">+</span><span>One Health Lyme Gap Atlas</span></Link>
      <div className="nav-links">
        <div className="section-links"><Link href={sectionHref("atlas")}>Atlas</Link><Link href={sectionHref("scoring")}>How counties are prioritized</Link><Link href={sectionHref("methods")}>How to interpret the Atlas</Link></div>
        <details className="variant-menu"><summary>Variants</summary><div><Link href="/variant_1">County review starting point</Link><Link href="/variant_2">Guided county review</Link><Link href="/variant_3">County evidence workspace</Link><Link href="/variant_4">Score explained</Link><Link href="/variant_5">County comparison</Link><Link href="/variant_6">Wide evidence workspace</Link></div></details>
        <button className="dictionary-button" type="button" onClick={() => dictionaryDialog.current?.showModal()}>Data dictionary</button>
        {process.env.NEXT_PUBLIC_KG_CHAT_ENABLED === "true" && <Link href="/knowledge-graph">Evidence chat</Link>}
      </div>
      <dialog ref={dictionaryDialog} className="dictionary-dialog" aria-labelledby="data-dictionary-title"><div><div className="dictionary-heading"><div><span className="eyebrow">Reference</span><h2 id="data-dictionary-title">Data dictionary</h2></div><button type="button" aria-label="Close data dictionary" onClick={() => dictionaryDialog.current?.close()}>×</button></div><dl>{DATA_DICTIONARY.map(({ term, definition }) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl><form method="dialog"><button className="button secondary">Close</button></form></div></dialog>
    </nav>
  );
}
