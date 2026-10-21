"use client";

import { BookOpen, ExternalLink } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  OFFICIAL_FOLLOW_UP_RESOURCES,
  type OfficialFollowUpResource,
} from "@/lib/follow-up-workflows";

import "./explorer-visual-first.css";

const OFFICIAL_RESOURCES_INTRO =
  "Authoritative references to support surveillance review, reporting, and public health action.";

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

/** The same references as the former inline card, grouped by topic. */
export function ExplorerOfficialResourcesContent() {
  const groups = groupOfficialResources(OFFICIAL_FOLLOW_UP_RESOURCES);

  return (
    <div
      className="ux-reset-explorer-resources-panel"
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
    </div>
  );
}

/**
 * Official resources as a closed-by-default popover (UX audit A4/Q5). The
 * references are unchanged and are no longer a permanent card under the map.
 */
export function ExplorerOfficialResources() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            data-testid="explorer-official-resources-trigger"
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <BookOpen aria-hidden="true" data-icon="inline-start" />
        <span className="max-sm:sr-only">Official resources</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="ux-reset-explorer-resources-popover"
        side="bottom"
      >
        <ExplorerOfficialResourcesContent />
      </PopoverContent>
    </Popover>
  );
}
