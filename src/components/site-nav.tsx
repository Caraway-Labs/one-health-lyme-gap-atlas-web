export function SiteNav() {
  return (
    <nav className="topbar" aria-label="Main navigation">
      <a className="brand" href="#atlas" aria-label="One Health Lyme Gap Atlas home"><span className="brand-mark">+</span><span>One Health<br />Lyme Gap Atlas</span></a>
      <div className="nav-links"><a href="#atlas">Atlas</a><a href="#scoring">Scoring lab</a><a href="#methods">Data & methods</a></div>
    </nav>
  );
}
