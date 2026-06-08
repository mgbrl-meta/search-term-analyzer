"use client";

import { useMemo } from "react";
import type { GoogleOsModel, GoogleOsRow, GoogleOsStatus } from "../../../lib/googleOs/types";
import { compactMoney, pct, pctChange, safeDiv, x } from "../../../lib/googleOs/format";
import { GoogleOsTable } from "../shared/GoogleOsTable";

type CampaignRow = {
  key: string;
  label: string;
  campaignType: string;
  campaignStatus: string;
  cost: number;
  spendShare: number;
  conversionValue: number;
  roas: number;
  conversions: number;
  cpa: number;
  ctr: number;
  cvr: number;
  avgCpc: number;
  yesterdayRoas: number;
  previousRoas: number;
  roasDodPct: number;
  status: GoogleOsStatus;
  action: string;
  reason: string;
};

function lastNDaysRows(rows: GoogleOsRow[], days: number) {
  const dates = Array.from(new Set(rows.map((row) => row.date).filter(Boolean))).sort();
  const maxDate = dates[dates.length - 1];

  if (!maxDate) return [];

  const end = new Date(`${maxDate}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  return rows.filter((row) => {
    const date = new Date(`${row.date}T00:00:00`);
    return date >= start && date <= end;
  });
}

function changePct(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous && current) return 100;
  return ((current - previous) / previous) * 100;
}

function decide(row: Omit<CampaignRow, "status" | "action" | "reason">): Pick<CampaignRow, "status" | "action" | "reason"> {
  if (row.cost >= 2000 && row.conversions === 0) {
    return {
      status: "PAUSE",
      action: "Pause or cut hard",
      reason: "Meaningful spend with zero purchases in last 30 days.",
    };
  }

  if (row.roas < 1 && row.cost >= 5000) {
    return {
      status: "REDUCE",
      action: "Reduce budget / bids",
      reason: "Last 30-day ROAS is below 1x.",
    };
  }

  if (row.roas >= 3 && row.conversions >= 2) {
    return {
      status: "SCALE",
      action: "Protect / scale carefully",
      reason: "Strong last 30-day ROAS with purchases.",
    };
  }

  if (row.roas >= 2) {
    return {
      status: "KEEP",
      action: "Hold and monitor",
      reason: "Positive but not aggressive scale zone.",
    };
  }

  if (row.cost >= 300) {
    return {
      status: "WATCH",
      action: "Watch search terms",
      reason: "Spend exists but efficiency is not strong enough.",
    };
  }

  return {
    status: "INVESTIGATE",
    action: "Collect more data",
    reason: "Insufficient recent spend for decision.",
  };
}

function buildCampaignRows(rows: GoogleOsRow[]) {
  const recentRows = lastNDaysRows(rows, 30);
  const totalSpend = recentRows.reduce((sum, row) => sum + row.cost, 0);
  const dates = Array.from(new Set(recentRows.map((row) => row.date).filter(Boolean))).sort();
  const yesterday = dates[dates.length - 1] || "";
  const previous = dates[dates.length - 2] || "";

  const groups = new Map<string, GoogleOsRow[]>();

  recentRows.forEach((row) => {
    const key = row.campaignId || row.campaign;
    if (!key) return;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries())
    .map(([key, groupRows]) => {
      const cost = groupRows.reduce((sum, row) => sum + row.cost, 0);
      const conversionValue = groupRows.reduce((sum, row) => sum + row.conversionValue, 0);
      const impressions = groupRows.reduce((sum, row) => sum + row.impressions, 0);
      const clicks = groupRows.reduce((sum, row) => sum + row.clicks, 0);
      const conversions = groupRows.reduce((sum, row) => sum + row.conversions, 0);

      const ydRows = groupRows.filter((row) => row.date === yesterday);
      const pdRows = groupRows.filter((row) => row.date === previous);

      const ydSpend = ydRows.reduce((sum, row) => sum + row.cost, 0);
      const ydRevenue = ydRows.reduce((sum, row) => sum + row.conversionValue, 0);
      const pdSpend = pdRows.reduce((sum, row) => sum + row.cost, 0);
      const pdRevenue = pdRows.reduce((sum, row) => sum + row.conversionValue, 0);

      const yesterdayRoas = safeDiv(ydRevenue, ydSpend);
      const previousRoas = safeDiv(pdRevenue, pdSpend);

      const first = groupRows[0];

      const base = {
        key,
        label: first.campaign,
        campaignType: first.campaignType,
        campaignStatus: first.campaignStatus,
        cost,
        spendShare: safeDiv(cost, totalSpend),
        conversionValue,
        roas: safeDiv(conversionValue, cost),
        conversions,
        cpa: safeDiv(cost, conversions),
        ctr: safeDiv(clicks, impressions),
        cvr: safeDiv(conversions, clicks),
        avgCpc: safeDiv(cost, clicks),
        yesterdayRoas,
        previousRoas,
        roasDodPct: changePct(yesterdayRoas, previousRoas),
      };

      return {
        ...base,
        ...decide(base),
      };
    })
    .sort((a, b) => b.cost - a.cost);
}

function Metric({
  value,
  tone,
}: {
  value: string;
  tone?: "green" | "red" | "amber" | "neutral";
}) {
  return <span className={`gos-metric ${tone || "neutral"}`}>{value}</span>;
}

function roasTone(value: number) {
  if (value >= 3) return "green";
  if (value < 1) return "red";
  if (value < 2) return "amber";
  return "neutral";
}

function cpaTone(row: Record<string, unknown>) {
  const roas = Number(row.roas || 0);
  if (roas >= 3) return "green";
  if (roas < 1) return "red";
  return "amber";
}

function pctTone(value: number, goodWhenPositive = true) {
  if (value === 0) return "neutral";
  if (goodWhenPositive) return value > 0 ? "green" : "red";
  return value > 0 ? "red" : "green";
}

function statusTone(status: unknown) {
  const s = String(status || "");
  if (s === "SCALE" || s === "KEEP") return "green";
  if (s === "PAUSE" || s === "REDUCE") return "red";
  if (s === "WATCH") return "amber";
  return "neutral";
}

export function CampaignsTab({ model }: { model: GoogleOsModel }) {
  const rows = useMemo(() => buildCampaignRows(model.rows), [model.rows]);

  return (
    <section className="gos-page">
      <div className="gos-panel">
        <div className="gos-panel-head">
          <div>
            <span>Campaigns</span>
            <h2>Campaign-level diagnosis — last 30 days</h2>
            <p>
              Sorted by recent spend. Older data is ignored here so decisions stay operator-grade and current.
            </p>
          </div>
        </div>

        <GoogleOsTable
          rows={rows as unknown as Record<string, unknown>[]}
          columns={[
            { key: "label", label: "Campaign" },
            { key: "campaignType", label: "Type" },
            { key: "campaignStatus", label: "Status" },
            { key: "cost", label: "Spend", right: true, render: (row) => <Metric value={compactMoney(row.cost)} tone="red" /> },
            { key: "spendShare", label: "Share", right: true, render: (row) => pct(row.spendShare) },
            { key: "conversionValue", label: "Revenue", right: true, render: (row) => <Metric value={compactMoney(row.conversionValue)} tone="green" /> },
            { key: "roas", label: "ROAS", right: true, render: (row) => <Metric value={x(row.roas)} tone={roasTone(Number(row.roas || 0))} /> },
            { key: "roasDodPct", label: "ROAS DoD", right: true, render: (row) => <Metric value={pctChange(row.roasDodPct)} tone={pctTone(Number(row.roasDodPct || 0))} /> },
            { key: "conversions", label: "Purch.", right: true, render: (row) => Number(row.conversions || 0).toFixed(0) },
            { key: "cpa", label: "CPA", right: true, render: (row) => <Metric value={compactMoney(row.cpa)} tone={cpaTone(row)} /> },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "cvr", label: "CVR", right: true, render: (row) => <Metric value={pct(row.cvr)} tone={Number(row.cvr || 0) >= 0.02 ? "green" : "amber"} /> },
            { key: "status", label: "Decision", render: (row) => <Metric value={String(row.status || "")} tone={statusTone(row.status)} /> },
            { key: "action", label: "Action" },
          ]}
          empty="No campaign data available in the last 30 days."
        />
      </div>
    </section>
  );
}
