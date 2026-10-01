"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

import {
  RELEASE_TRENDS_PREREQUISITE,
  VIEW_GROUPS,
  VIEW_LABELS,
  VIEW_PURPOSES,
  type View,
} from "./model";

const viewControlIds = {
  tiles: "geo_view_tiles",
  multiples: "geo_view_multiples",
  matrix: "geo_view_matrix",
  ranking: "geo_view_ranking",
  maps: "geo_view_maps",
  scatter: "geo_view_scatter",
  compare: "geo_view_compare",
  trends: "geo_view_trends",
} as const satisfies Record<View, string>;

type GeographicExplorerViewSelectorProps = {
  activeView: View;
  onViewChange: (view: View) => void;
};

export function GeographicExplorerViewSelector({
  activeView,
  onViewChange,
}: GeographicExplorerViewSelectorProps) {
  return (
    <nav className="geo-view-nav" aria-label="Visualization views">
      <p className="geo-view-nav-intro">
        Choose a view by task. Your selected county stays with you when you
        switch views.
      </p>
      <div className="geo-view-groups">
        {VIEW_GROUPS.map((group) => (
          <section
            key={group.id}
            className="geo-view-group"
            aria-labelledby={`geo-view-group-${group.id}`}
          >
            <div className="geo-view-group-heading">
              <h2
                className="geo-view-group-title"
                id={`geo-view-group-${group.id}`}
              >
                {group.title}
              </h2>
              <p className="geo-view-group-hint">{group.hint}</p>
            </div>
            <ul className="geo-view-group-list">
              {group.views.map((view) => {
                const active = view === activeView;
                const purposeId = `geo-view-purpose-${view}`;
                return (
                  <li key={view}>
                    <Button
                      {...analyticsControlAttributes(viewControlIds[view])}
                      aria-current={active ? "true" : undefined}
                      aria-describedby={active ? undefined : purposeId}
                      aria-label={VIEW_LABELS[view]}
                      className={
                        active
                          ? "geo-view-option is-active hover:bg-primary"
                          : "geo-view-option"
                      }
                      variant={active ? "default" : "secondary"}
                      onClick={() => onViewChange(view)}
                    >
                      <span className="geo-view-option-label">
                        {VIEW_LABELS[view]}
                      </span>
                      {view === "trends" && !active ? (
                        <Badge
                          className="geo-view-prereq-badge"
                          variant="outline"
                        >
                          Needs release history
                        </Badge>
                      ) : null}
                      {active ? null : (
                        <span
                          className="geo-view-option-purpose"
                          id={purposeId}
                        >
                          {view === "trends"
                            ? RELEASE_TRENDS_PREREQUISITE
                            : VIEW_PURPOSES[view]}
                        </span>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
