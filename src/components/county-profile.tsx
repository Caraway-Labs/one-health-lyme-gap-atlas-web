"use client";

import { CountyActionPlan } from "@/components/county-action-plan";
import { PdfExportButton } from "@/components/pdf-export-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import type { CountyDetail } from "@/generated/models";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import { plainPriority, reasonsFor, type ScoreSettings } from "@/lib/atlas-ui";

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
          <Badge className="priority-pill review h-auto">
            {plainPriority(detail.priority)}
          </Badge>
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
        <div className="ledger-panel">
          <h4>Data used for this county</h4>
          <dl>
            <div>
              <dt>Published 2023 Lyme case count</dt>
              <dd>{detail.human_status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Blacklegged tick status</dt>
              <dd>{detail.tick_status}</dd>
            </div>
            <div>
              <dt>Lyme bacterium detected in ticks</dt>
              <dd>{detail.burgdorferi_status}</dd>
            </div>
            <div>
              <dt>Social Vulnerability Index</dt>
              <dd>
                {detail.svi_percentile == null
                  ? "Unavailable"
                  : `${Math.round(detail.svi_percentile * 100)}th percentile`}
              </dd>
            </div>
            <div>
              <dt>Uninsured rate</dt>
              <dd>
                {detail.uninsured_percent == null
                  ? "Unavailable"
                  : `${detail.uninsured_percent}%`}
              </dd>
            </div>
            <div>
              <dt>Rural–urban classification (2023)</dt>
              <dd>{detail.rucc_2023 ?? "Unavailable"}</dd>
            </div>
          </dl>
        </div>
      </div>
      <CountyActionPlan detail={detail} />
    </Card>
  );
}
