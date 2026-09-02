import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AtlasMetadata } from "@/generated/models";
import type { EvidenceView } from "@/lib/atlas-ui";

export function AtlasFilters({
  metadata,
  stateFilter,
  query,
  evidence,
  onStateChange,
  onQueryChange,
  onEvidenceChange,
  onDownload,
}: {
  metadata: AtlasMetadata;
  stateFilter: string;
  query: string;
  evidence: EvidenceView;
  onStateChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onEvidenceChange: (value: EvidenceView) => void;
  onDownload?: () => void;
}) {
  return (
    <div className="filter-bar">
      <label>
        <span>State</span>
        <Select
          value={stateFilter}
          onValueChange={(value) => {
            if (value) {
              onStateChange(value);
            }
          }}
        >
          <SelectTrigger aria-label="State" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              { label: "Nationwide", value: "ALL" },
              ...metadata.states.map((state) => ({
                label: state.name,
                value: state.code,
              })),
            ].map((state) => (
              <SelectItem value={state.value} key={state.value}>
                {state.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label>
        <span>County name or FIPS code</span>
        <Input
          aria-label="County name or FIPS code"
          className="h-11"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search counties…"
        />
      </label>
      <label>
        <span>Filter counties by available data</span>
        <Select
          value={evidence}
          onValueChange={(value) => {
            if (value) {
              onEvidenceChange(value as EvidenceView);
            }
          }}
        >
          <SelectTrigger
            aria-label="Filter counties by available data"
            className="h-11 w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All included counties</SelectItem>
            <SelectItem value="ecological">
              Tick or pathogen evidence available
            </SelectItem>
            <SelectItem value="human">
              Published Lyme case count available
            </SelectItem>
            <SelectItem value="complete">Most data fields available</SelectItem>
          </SelectContent>
        </Select>
      </label>
      {onDownload && (
        <Button className="h-11" onClick={onDownload}>
          Download county list
        </Button>
      )}
    </div>
  );
}
