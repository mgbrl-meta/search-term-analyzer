"use client";

import { useMemo } from "react";
import type { GoogleOsModel, GoogleOsRow, GoogleOsStatus } from "../../../lib/googleOs/types";
import { compactMoney, pct, pctChange, safeDiv, x } from "../../../lib/googleOs/format";
import { GoogleOsTable } from "../shared/GoogleOsTable";
import type { GoogleOsDateMode } from "../../../lib/googleOs/dateFilter";
import { getDateLabel } from "../../../lib/googleOs/dateFilter";

type AdGroupRow = {
  key: string;
  campaign: string;
  label: string;
  adGroupStatus: string;
  cost: number;
  spendShare: number;
  conversionValue: number;
  roas: number;
  conversions: number;
  cpa: number;
  ctr: number;
  cvr: number;
  avgCpc: number;
  roasDodPct: number;
  status: GoogleOsStatus;
  action: string;
  reason: string;
};

function changePct(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous && current) return 100;
  return ((current - previous) / previous) * 100;
}

function decide(row: Omit<AdGroupRow, "status" | "action" | "reason">): Pick<AdGroupRow, "status" | "action" | "reason"> {
  if (row.cost >= 2000 && row.conversions === 0) return { status: "PAUSE", action: "Pause / cut bid 70%", reason: "Spend with zero purchases." };
  if (row.roas < 1 && row.cost >= 2000) return { status: "REDUCE", action: "Cut bid 50–70%", reason: "ROAS below 1x." };
  if (row.roas >= 3 && row.conversions >= 2) return { status: "SCALE", action: "Increase bid 10%", reason: "Strong ROAS and purchases." };
  if (row.roas >= 2) return { status: "KEEP", action: "Hold", reason: "Positive efficiency." };
  if (row.cost >= 300) return { status: "WATCH", action: "Check search terms", reason: "Spend but weak signal." };
  return { status: "INVESTIGATE", action: "Collect more data", reason: "Insufficient data." };
}

function buildAdGroupRows(rows: GoogleOsRow[]) {
  const totalSpend = rows.reduce((sum, row) => sum + row.cost, 0);
  const dates = Array.from(new Set(rows.map((row) => row.date).filter(Boolean))).sort();
  const yesterday = dates[dates.length - 1] || "";
  const previous = dates[dates.length - 2] || "";
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    const key = `${row.campaignId || row.campaign}::${row.adGroupId || row.adGroup}`;
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

      const ydRoas = safeDiv(ydRevenue, ydSpend);
      const pdRoas = safeDiv(pdRevenue, pdSpend);
      const first = groupRows[0];

      const base = {
        key,
        campaign: first.campaign,
        label: first.adGroup || first.campaign,
        adGroupStatus: first.adGroupStatus,
        cost,
        spendShare: safeDiv(cost, totalSpend),
        conversionValue,
        roas: safeDiv(conversionValue, cost),
        conversions,
        cpa: safeDiv(cost, conversions),
        ctr: safeDiv(clicks, impressions),
        cvr: safeDiv(conversions, clicks),
        avgCpc: safeDiv(cost, clicks),
        roasDodPct: changePct(ydRoas, pdRoas),
      };

      return { ...base, ...decide(base) };
    })
    .sort((a, b) => b.cost - a.cost);
}

function Metric({ value, tone = "neutral" }: { value: string; tone?: "green" | "red" | "amber" | "neutral" }) {
  return <span className={`gos-metric ${tone}`}>{value}</span>;
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

function deltaTone(value: number, goodWhenPositive = true) {
  if (value === 0) return "neutral";
  return goodWhenPositive
    ? value > 0 ? "green" : "red"
    : value > 0 ? "red" : "green";
}

function statusTone(status: unknown) {
  const s = String(status || "");
  if (s === "SCALE" || s === "KEEP") return "green";
  if (s === "PAUSE" || s === "REDUCE") return "red";
  if (s === "WATCH") return "amber";
  return "neutral";
}

export function AdGroupsTab({
  model,
  rows: inputRows,
  compareRows = [],
  dateMode = "last_30",
  selectedMonth = "",
  compareMonth = "",
  customStart = "",
  customEnd = "",
}: {
  model: GoogleOsModel;
  rows?: GoogleOsRow[];
  compareRows?: GoogleOsRow[];
  dateMode?: GoogleOsDateMode;
  selectedMonth?: string;
  compareMonth?: string;
  customStart?: string;
  customEnd?: string;
}) {
  const rows = useMemo(() => buildAdGroupRows(inputRows || model.rows), [inputRows, model.rows]);
  const compare = useMemo(() => buildAdGroupRows(compareRows), [compareRows]);

  const compareMap = useMemo(() => {
    const map = new Map<string, AdGroupRow>();
    compare.forEach((row) => map.set(row.key, row));
    return map;
  }, [compare]);

  const tableRows = useMemo(() => rows.map((row) => {
    const prev = compareMap.get(row.key);
    return {
      ...row,
      spendDelta: prev ? row.cost - prev.cost : 0,
      revenueDelta: prev ? row.conversionValue - prev.conversionValue : 0,
      roasDelta: prev ? row.roas - prev.roas : 0,
      cpaDelta: prev ? row.cpa - prev.cpa : 0,
    };
  }), [rows, compareMap]);

  const label = getDateLabel({ mode: dateMode, selectedMonth, compareMonth, customStart, customEnd });

  return (
    <section className="gos-page">
      <div className="gos-panel">
        <div className="gos-panel-head">
          <div>
            <span>Ad Groups</span>
            <h2>Ad group / product diagnosis</h2>
            <p>Showing {label}. Use this for bid cuts, holds, scale decisions, and search-term checks.</p>
          </div>
        </div>

        <GoogleOsTable
          rows={tableRows as unknown as Record<string, unknown>[]}
          columns={[
            { key: "campaign", label: "Campaign" },
            { key: "label", label: "Ad Group" },
            { key: "adGroupStatus", label: "State" },
            { key: "cost", label: "Spend", right: true, render: (row) => <Metric value={compactMoney(row.cost)} tone="red" /> },
            { key: "spendShare", label: "Share", right: true, render: (row) => pct(row.spendShare) },
            { key: "conversionValue", label: "Revenue", right: true, render: (row) => <Metric value={compactMoney(row.conversionValue)} tone="green" /> },
            ...(compareMonth ? [
              { key: "spendDelta", label: "Spend Δ", right: true, render: (row: Record<string, unknown>) => <Metric value={compactMoney(row.spendDelta)} tone={deltaTone(Number(row.spendDelta || 0), false)} /> },
              { key: "revenueDelta", label: "Revenue Δ", right: true, render: (row: Record<string, unknown>) => <Metric value={compactMoney(row.revenueDelta)} tone={deltaTone(Number(row.revenueDelta || 0), true)} /> },
              { key: "roasDelta", label: "ROAS Δ", right: true, render: (row: Record<string, unknown>) => <Metric value={x(row.roasDelta)} tone={deltaTone(Number(row.roasDelta || 0), true)} /> },
              { key: "cpaDelta", label: "CPA Δ", right: true, render: (row: Record<string, unknown>) => <Metric value={compactMoney(row.cpaDelta)} tone={deltaTone(Number(row.cpaDelta || 0), false)} /> },
            ] : []),
            { key: "roas", label: "ROAS", right: true, render: (row) => <Metric value={x(row.roas)} tone={roasTone(Number(row.roas || 0))} /> },
            { key: "conversions", label: "Purch.", right: true, render: (row) => Number(row.conversions || 0).toFixed(0) },
            { key: "cpa", label: "CPA", right: true, render: (row) => <Metric value={compactMoney(row.cpa)} tone={cpaTone(row)} /> },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "cvr", label: "CVR", right: true, render: (row) => <Metric value={pct(row.cvr)} tone={Number(row.cvr || 0) >= 0.02 ? "green" : "amber"} /> },
            { key: "avgCpc", label: "CPC", right: true, render: (row) => compactMoney(row.avgCpc) },
            { key: "roasDodPct", label: "ROAS DoD", right: true, render: (row) => <Metric value={pctChange(row.roasDodPct)} tone={deltaTone(Number(row.roasDodPct || 0), true)} /> },
            { key: "status", label: "Decision", render: (row) => <Metric value={String(row.status || "")} tone={statusTone(row.status)} /> },
            { key: "action", label: "Action" },
          ]}
          empty="No ad group data available for this date range."
        />
      </div>
    </section>
  );
}
