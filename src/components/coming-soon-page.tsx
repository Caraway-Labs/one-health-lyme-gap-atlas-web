import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function ComingSoonPage({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <main className="coming-soon-page">
      <section aria-labelledby="coming-soon-title" className="coming-soon-card">
        <p className="eyebrow">Coming Soon</p>
        <h1 id="coming-soon-title">{title}</h1>
        <p>{description}</p>
        <p>
          This Atlas capability is in development. It is not available as a
          released analytical workflow yet.
        </p>
        <Link className={buttonVariants({ className: "mt-6" })} href="/">
          Return to Atlas overview
        </Link>
      </section>
    </main>
  );
}
