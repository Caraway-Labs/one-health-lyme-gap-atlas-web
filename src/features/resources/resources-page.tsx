"use client";

import {
  BarChart3,
  ChevronDown,
  FileText,
  Search,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  CDC_RESOURCE_TOPICS,
  REGIONAL_CENTER_FILTERS,
  RESOURCE_SECTION_HREFS,
  RESOURCE_SECTION_IDS,
  RESOURCES_PAGE_SUBTITLE,
  RESOURCES_PAGE_TITLE,
  SVI_INTERPRETATION_RESOURCE,
  regionalCentersForFilter,
  selectedStateFromQuery,
  statesInAlphabeticalOrder,
  type CdcResourceLink,
  type RegionalCenter,
  type RegionalCenterFilter,
  type StateResource,
} from "@/lib/resources/catalog";

import { StateResourceMap } from "./state-resource-map";

import "./resources.css";

const TOPIC_ICONS: Record<string, LucideIcon> = {
  "clinical-laboratory": FileText,
  "prevention-education": Shield,
  "surveillance-reporting": BarChart3,
  "tick-pathogen-surveillance": Search,
};

const DIRECTORY = statesInAlphabeticalOrder();

function externalLabel(title: string): string {
  return `${title} (opens in a new tab)`;
}

function ExternalResourceLink({
  className,
  link,
}: {
  className?: string;
  link: Pick<CdcResourceLink, "title" | "url">;
}) {
  return (
    <a
      className={className}
      href={link.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span>{link.title}</span>
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function ResourcesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedState = searchParams.get("state");
  const selected = selectedStateFromQuery(requestedState);
  const [centerFilter, setCenterFilter] = useState<RegionalCenterFilter>("all");
  const centers = regionalCentersForFilter(centerFilter);

  useEffect(() => {
    if (requestedState === null) {
      return;
    }
    if (selected && requestedState === selected.code) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (selected) {
      params.set("state", selected.code);
    } else {
      params.delete("state");
    }
    const query = params.toString();
    const hash = window.location.hash;
    router.replace(`${query ? `${pathname}?${query}` : pathname}${hash}`, {
      scroll: false,
    });
  }, [pathname, requestedState, router, searchParams, selected]);

  const selectState = (state: StateResource) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("state", state.code);
    router.replace(
      `${pathname}?${params.toString()}${RESOURCE_SECTION_HREFS.state}`,
      { scroll: false }
    );
  };

  return (
    <div className="resources-page">
      <header className="resources-intro">
        <h1>{RESOURCES_PAGE_TITLE}</h1>
        <p className="resources-subtitle">{RESOURCES_PAGE_SUBTITLE}</p>
        <nav aria-label="On this page">
          <ul className="resources-jumps">
            <li>
              <a href={RESOURCE_SECTION_HREFS.cdc}>
                CDC guidance <ChevronDown aria-hidden="true" size={16} />
              </a>
            </li>
            <li>
              <a href={RESOURCE_SECTION_HREFS.state}>
                State resources <ChevronDown aria-hidden="true" size={16} />
              </a>
            </li>
            <li>
              <a href={RESOURCE_SECTION_HREFS.regional}>
                Regional centers <ChevronDown aria-hidden="true" size={16} />
              </a>
            </li>
          </ul>
        </nav>
      </header>

      <section
        aria-labelledby="cdc-guidance-heading"
        className="resources-section"
        id={RESOURCE_SECTION_IDS.cdc}
      >
        <h2 id="cdc-guidance-heading">CDC guidance & tools</h2>
        <p className="resources-section-intro">
          National references for surveillance, interpretation, and prevention.
        </p>
        <div className="resources-topic-grid">
          {CDC_RESOURCE_TOPICS.map((topic) => {
            const Icon = TOPIC_ICONS[topic.id] ?? FileText;
            return (
              <article className="resources-card" key={topic.id}>
                <h3>
                  <Icon aria-hidden="true" size={18} />
                  {topic.title}
                </h3>
                <ul className="resources-link-list">
                  {topic.links.map((link) => (
                    <li key={link.id}>
                      <ExternalResourceLink link={link} />
                      <p>{link.description}</p>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="resources-context">
          Community context:{" "}
          <a
            href={SVI_INTERPRETATION_RESOURCE.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {SVI_INTERPRETATION_RESOURCE.title}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </section>

      <section
        aria-labelledby="state-resources-heading"
        className="resources-section"
        id={RESOURCE_SECTION_IDS.state}
      >
        <h2 id="state-resources-heading">Find your state&apos;s resources</h2>
        <div className="resources-state-panel">
          <StateResourceMap
            selectedCode={selected?.code ?? null}
            onSelect={(code) => {
              const state = selectedStateFromQuery(code);
              if (state) {
                selectState(state);
              }
            }}
          />
          <div className="resources-state-detail">
            <div className="resources-state-field">
              <label
                className="resources-state-label"
                htmlFor="state-resource-search"
              >
                State
              </label>
              <Combobox
                isItemEqualToValue={(item, value) => item.code === value.code}
                itemToStringLabel={(item: StateResource) => item.name}
                items={DIRECTORY}
                value={selected}
                onValueChange={(next) => {
                  if (next) {
                    selectState(next);
                  }
                }}
              >
                <ComboboxInputGroup>
                  <ComboboxInput
                    autoComplete="off"
                    id="state-resource-search"
                    placeholder="Select a state"
                  />
                  <ComboboxTrigger aria-label="Show all states" />
                </ComboboxInputGroup>
                <ComboboxContent>
                  <ComboboxEmpty>No state matches that search.</ComboboxEmpty>
                  <ComboboxList>
                    {(state: StateResource) => (
                      <ComboboxItem key={state.code} value={state}>
                        {state.name}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            {selected ? (
              <div aria-live="polite">
                <p aria-hidden="true" className="resources-state-badge">
                  {selected.destinationType}
                </p>
                <h3>{selected.organization}</h3>
                <p>{selected.destinationType}</p>
                <ExternalResourceLink
                  className="resources-visit"
                  link={{
                    title: "Visit state resources",
                    url: selected.url,
                  }}
                />
                <p className="resources-state-note">
                  Program types and services vary by state.
                </p>
              </div>
            ) : (
              <div className="resources-state-prompt">
                <h3>Select a state</h3>
                <p>
                  Choose a state from the map, the search field, or the
                  directory. Atlas does not infer a location.
                </p>
              </div>
            )}
          </div>
        </div>
        <details className="resources-directory">
          <summary>Browse all 50 states A–Z</summary>
          <ul className="resources-directory-list">
            {DIRECTORY.map((state) => (
              <li key={state.code}>
                <button
                  aria-current={
                    selected?.code === state.code ? "true" : undefined
                  }
                  type="button"
                  onClick={() => {
                    selectState(state);
                  }}
                >
                  {state.name}
                </button>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section
        aria-labelledby="regional-centers-heading"
        className="resources-section"
        id={RESOURCE_SECTION_IDS.regional}
      >
        <h2 id="regional-centers-heading">Regional expertise & training</h2>
        <p className="resources-section-intro">
          Research, practical tools, and training from regional vector-borne
          disease centers.
        </p>
        <div
          aria-label="Filter regional centers"
          className="resources-filters"
          role="group"
        >
          {REGIONAL_CENTER_FILTERS.map((filter) => (
            <Button
              key={filter.id}
              aria-pressed={centerFilter === filter.id}
              className={
                centerFilter === filter.id
                  ? "rounded-full bg-[var(--navy)] text-[var(--white)] hover:bg-[var(--navy)]"
                  : "rounded-full"
              }
              type="button"
              variant={centerFilter === filter.id ? "default" : "outline"}
              onClick={() => {
                setCenterFilter(filter.id);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        {centers.length === 0 ? (
          <p className="resources-empty" role="status">
            No centers match this filter.
          </p>
        ) : (
          <div className="resources-center-grid">
            {centers.map((center) => (
              <CenterCard center={center} key={center.id} />
            ))}
          </div>
        )}
        <p className="resources-footer-note">
          Visit each organization for current guidance, services, and training
          opportunities.
        </p>
      </section>
    </div>
  );
}

function CenterCard({ center }: { center: RegionalCenter }) {
  return (
    <article className="resources-card resources-center-card">
      {center.focus ? (
        <p className="resources-center-kicker">{center.focus}</p>
      ) : null}
      <h3>{center.name}</h3>
      <p className="resources-center-type">{center.type}</p>
      <p className="resources-center-purpose">{center.purpose}</p>
      <a
        aria-label={externalLabel(`Visit ${center.name}`)}
        href={center.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        Visit center
        <span aria-hidden="true"> ↗</span>
      </a>
    </article>
  );
}
