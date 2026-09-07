import Link from "next/link";

export function SiteFooter() {
  return <footer>
    <div className="footer-brand"><span className="brand-mark">+</span><span>One Health Lyme Gap Atlas</span></div>
    <p>Independent Caraway Labs prototype. Views do not represent an employer or public health laboratory.</p>
    <nav className="footer-links" aria-label="Footer navigation">
      <Link href="/privacy">Privacy</Link>
      <a href="#atlas">Back to Atlas ↑</a>
    </nav>
  </footer>;
}
