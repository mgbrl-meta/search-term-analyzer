"use client";

import type { GoogleOsModel } from "../../../lib/googleOs/types";
import { money, pct, pctChange, x } from "../../../lib/googleOs/format";
import { GoogleOsKpi } from "../shared/GoogleOsKpi";
import { GoogleOsTable } from "../shared/GoogleOsTable";

export function CommandCenterTab({ model }: { model: GoogleOsModel }) {
  const { summary } = model;

  const topIssues = model.adGroups
    .filter((row) => row.status === "PAUSE" || row.status === "REDUCE")
    .slice(0, 8);

  const winners = model.adGroups
    .filter((row) => row.status === "SCALE" || row.status === "KEEP")
    .slice()
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 8);

  return (
    <section className="gos-page">
      <div className="gos-hero">
        <div>
          <span>Google OS</span>
          <h1>Command Center</h1>
          <p>
            Daily Google Ads operator system for Shopping, Search, and Search Terms.
            Data range: {summary.startDate} → {summary.endDate}
          </p>
        </div>
      </div>

      <div className="gos-kpi-grid">
        <GoogleOsKpi label="Spend" value={money(summary.cost)} sub={`${pctChange(summary.costDodPct)} DoD`} tone="red" />
        <GoogleOsKpi label="Revenue" value={money(summary.conversionValue)} sub={`${pctChange(summary.revenueDodPct)} DoD`} tone="green" />
        <GoogleOsKpi label="ROAS" value={x(summary.roas)} sub={`${pctChange(summary.roasDodPct)} DoD`} tone={summary.roas >= 3 ? "green" : summary.roas < 1 ? "red" : "amber"} />
        <GoogleOsKpi label="Conversions" value={summary.conversions.toFixed(2)} />
        <GoogleOsKpi label="CPA" value={money(summary.cpa)} tone={summary.roas >= 3 ? "green" : "red"} />
        <GoogleOsKpi label="AOV" value={money(summary.aov)} />
        <GoogleOsKpi label="CVR" value={pct(summary.cvr)} tone={summary.cvr > 0.01 ? "green" : "amber"} />
        <GoogleOsKpi label="Avg CPC" value={money(summary.avgCpc)} />
      </div>

      <div className="gos-insight-grid">
        <div className="gos-insight-card danger">
          <span>Biggest Issue</span>
          <p>{summary.biggestIssue}</p>
        </div>

        <div className="gos-insight-card">
          <span>Immediate Action</span>
          <p>{summary.immediateAction}</p>
        </div>

        <div className="gos-insight-card">
          <span>Budget Recommendation</span>
          <p>{summary.budgetRecommendation}</p>
        </div>
      </div>

      <div className="gos-two-col">
        <div className="gos-panel">
          <div className="gos-panel-head">
            <div>
              <span>Risks</span>
              <h2>Top spend leaks</h2>
            </div>
          </div>

          <GoogleOsTable
            rows={topIssues as unknown as Record<string, unknown>[]}
            columns={[
              { key: "label", label: "Ad group" },
              { key: "campaign", label: "Campaign" },
              { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
              { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
              { key: "status", label: "Status" },
              { key: "action", label: "Action" },
            ]}
            empty="No major risks detected yet."
          />
        </div>

        <div className="gos-panel">
          <div className="gos-panel-head">
            <div>
              <span>Winners</span>
              <h2>Protect / scale candidates</h2>
            </div>
          </div>

          <GoogleOsTable
            rows={winners as unknown as Record<string, unknown>[]}
            columns={[
              { key: "label", label: "Ad group" },
              { key: "campaign", label: "Campaign" },
              { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
              { key: "conversionValue", label: "Revenue", right: true, render: (row) => money(row.conversionValue) },
              { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
              { key: "action", label: "Action" },
            ]}
            empty="No winners detected yet."
          />
        </div>
      </div>
    </section>
  );
}
