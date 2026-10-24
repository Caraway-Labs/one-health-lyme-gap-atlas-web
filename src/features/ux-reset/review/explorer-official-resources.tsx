import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import {
  OFFICIAL_FOLLOW_UP_RESOURCES,
  type OfficialFollowUpResource,
} from "@/lib/follow-up-workflows";
import { resourcesPageHref } from "@/lib/resources/catalog";

const OFFICIAL_RESOURCES_INTRO = "Guidance to support your review.";

type OfficialResourceGroup = {
  category: string;
  resources: OfficialFollowUpResource[];
};

function groupOfficialResources(
  resources: readonly OfficialFollowUpResource[]
): OfficialResourceGroup[] {
  const groups: OfficialResourceGroup[] = [];
  for (const resource of resources) {
    const current = groups.at(-1);
    if (current?.category === resource.category) {
      current.resources.push(resource);
      continue;
    }
    groups.push({ category: resource.category, resources: [resource] });
  }
  return groups;
}

function OfficialResourceLink({
  resource,
}: {
  resource: OfficialFollowUpResource;
}) {
  if (resource.external) {
    return (
      <a
        aria-label={`${resource.label} (opens in a new tab)`}
        href={resource.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span>{resource.label}</span>
        <ExternalLink aria-hidden="true" />
      </a>
    );
  }
  return <Link href={resource.href}>{resource.label}</Link>;
}

export function ExplorerOfficialResources({
  stateCode = null,
}: {
  stateCode?: string | null;
}) {
  const groups = groupOfficialResources(OFFICIAL_FOLLOW_UP_RESOURCES);

  return (
    <Card
      className="ux-reset-explorer-resources ring-0"
      data-testid="explorer-official-resources"
    >
      <div className="ux-reset-explorer-resources-intro">
        <h3>Official resources</h3>
        <p>{OFFICIAL_RESOURCES_INTRO}</p>
      </div>
      <div className="ux-reset-explorer-resource-groups">
        {groups.map((group) => (
          <section key={group.category}>
            <h4>{group.category}</h4>
            <ul className="ux-reset-explorer-resource-list">
              {group.resources.map((resource) => (
                <li key={resource.id}>
                  <OfficialResourceLink resource={resource} />
                  <p>{resource.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="ux-reset-explorer-resources-all">
        <Link href={resourcesPageHref(stateCode)}>View all resources →</Link>
      </p>
    </Card>
  );
}
