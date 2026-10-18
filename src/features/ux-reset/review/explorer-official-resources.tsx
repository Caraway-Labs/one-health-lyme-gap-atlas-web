import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { OFFICIAL_FOLLOW_UP_RESOURCES } from "@/lib/follow-up-workflows";

export function ExplorerOfficialResources() {
  return (
    <Card
      className="ux-reset-explorer-resources gap-3 p-4"
      data-testid="explorer-official-resources"
    >
      <div>
        <p className="eyebrow">Official resources & guidance</p>
        <h3>Resources for follow-up</h3>
        <p className="type-body">
          Authoritative references to support surveillance review, reporting,
          and public-health action.
        </p>
      </div>
      <ul className="ux-reset-explorer-resource-list">
        {OFFICIAL_FOLLOW_UP_RESOURCES.map((resource) => (
          <li key={resource.id}>
            <p className="type-small">{resource.category}</p>
            {resource.external ? (
              <a
                aria-label={`${resource.label} (opens in a new tab)`}
                href={resource.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {resource.label}
                <ExternalLink aria-hidden="true" />
              </a>
            ) : (
              <Link href={resource.href}>{resource.label}</Link>
            )}
            <p className="type-body">{resource.description}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
