import Link from "next/link";

export function SiteNav() {
  return (
    <nav className="topbar" aria-label="Main navigation">
      <Link className="brand" href="/#atlas" aria-label="One Health Lyme Gap Atlas home"><span className="brand-mark">+</span><span>One Health<br />Lyme Gap Atlas</span></Link>
      <div className="nav-links"><Link href="/#atlas">Atlas</Link><Link href="/#scoring">Scoring lab</Link><Link href="/#methods">Data & methods</Link>{process.env.NEXT_PUBLIC_KG_CHAT_ENABLED === "true" && <Link href="/knowledge-graph">Evidence chat</Link>}</div>
    </nav>
  );
}
