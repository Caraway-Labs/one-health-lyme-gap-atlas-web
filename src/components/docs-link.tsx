import { ExternalLink } from "lucide-react";

import { DOCS_SITE_TITLE, getDocsUrl } from "@/lib/docs-config";

export function DocsLink({ className }: { className?: string }) {
  return (
    <a
      aria-label={`Open ${DOCS_SITE_TITLE} (opens in a new tab)`}
      className={className}
      href={getDocsUrl()}
      rel="noopener noreferrer"
      target="_blank"
    >
      Docs
      <ExternalLink aria-hidden="true" size={14} />
    </a>
  );
}
