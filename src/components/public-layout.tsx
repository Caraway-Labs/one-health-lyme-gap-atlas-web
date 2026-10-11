import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { FrontPorchTrustFooter } from "@/features/front-porch/front-porch-trust-footer";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-layout">
      <header className="public-header">
        <Link
          aria-label="One Health Lyme Gap Atlas home"
          className="public-brand"
          href="/"
        >
          <BrandMark size={28} />
          <span>One Health Lyme Gap Atlas</span>
        </Link>
      </header>
      {children}
      <FrontPorchTrustFooter />
    </div>
  );
}
