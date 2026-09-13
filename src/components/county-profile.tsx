"use client";

import { AtlasPriorityBadge } from "@/components/atlas-priority-badge";
import { CountyActionPlan } from "@/components/county-action-plan";
import { CountyEvidencePanel } from "@/components/county-evidence-panel";
import { PdfExportButton } from "@/components/pdf-export-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import type { CountyDetail } from "@/generated/models";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import { reasonsFor, type ScoreSettings } from "@/lib/atlas-ui";

export function CountyProfile({
  detail,
  copied,
  onCopy,
  settings,
  datasetVersion,
}: {
  detail: CountyDetail;
  copied: boolean;
  onCopy: () => void;
  settings: ScoreSettings;
  datasetVersion: string;
}) {
  const components = [
    ["Low or missing published case data", detail.score.human_weakness],
    ["Tick and pathogen evidence", detail.score.ecological],
    ["Potential barriers to diagnosis and reporting", detail.score.community],
  ];
  return (
    <Card className="profile-card gap-0 py-0">
      <div className="profile-header">
        <div>
          <span className="eyebrow">Selected county</span>
          <h3>
            {detail.county}, {detail.state_name}
          </h3>
          <p>
            FIPS {detail.fips} · Population{" "}
            {detail.population?.toLocaleString() ?? "unavailable"}
          </p>
        </div>
        <div className="score-lockup">
          <AtlasPriorityBadge priority={detail.priority} />
          <strong>{detail.score.score}</strong>
          <span>/ 100</span>
        </div>
      </div>
      <div className="profile-grid">
        <div className="why-panel">
          <h4>Why this county appears in the ranking</h4>
          <ol>
            {reasonsFor(detail).map((reason, index) => (
              <li key={reason}>
                <span>{index + 1}</span>
                <div>
                  <h5>
                    {
                      [
                        "Published Lyme case data",
                        "Tick presence",
                        "Lyme bacterium detection",
                      ][index]
                    }
                  </h5>
                  <p>{reason}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="briefing-actions">
            <Button
              {...analyticsControlAttributes("county_summary_copy")}
              className="h-11"
              onClick={onCopy}
            >
              {copied ? "Summary copied" : "Copy county summary"}
            </Button>
            <a
              {...analyticsControlAttributes("county_scoring_link")}
              href="#scoring"
            >
              Change scoring assumptions
            </a>
            <PdfExportButton
              datasetVersion={datasetVersion}
              geography={{ identifier: detail.fips, level: "county" }}
              settings={settings}
            />
          </div>
        </div>
        <div className="signals-panel">
          <h4>What influenced the ranking</h4>
          {components.map(([label, value]) => (
            <Progress
              className="signal-row flex-col flex-nowrap gap-0"
              key={label as string}
              value={Number(value)}
            >
              <div className="signal-copy">
                <ProgressLabel className="font-inherit text-inherit">
                  {label}
                </ProgressLabel>
                <strong>{value}</strong>
              </div>
            </Progress>
          ))}
        </div>
        <CountyEvidencePanel compact detail={detail} />
      </div>
      <CountyActionPlan detail={detail} />
    </Card>
  );
}
