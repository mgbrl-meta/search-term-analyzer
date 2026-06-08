"use client";

import { useMemo, useState } from "react";
import type { GoogleOsModel, GoogleOsRow, GoogleOsStatus } from "../../../lib/googleOs/types";
import { compactMoney, pct, safeDiv, x } from "../../../lib/googleOs/format";
import { GoogleOsTable } from "../shared/GoogleOsTable";

type CampaignViewMode = "latest_month" | "month_compare" | "quarter";

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
  status: GoogleOsStatus;
  action: string;
  reason: string;
};


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-");
  if (!year || !monthNum) return month;
  return `${MONTHS[Number(monthNum) - 1]}-${year.slice(2)}`;
}

function getAvailableMonths(rows: GoogleOsRow[]) {
  return Array.from(
    new Set(rows.map((row) => row.date?.slice(0, 7)).filter(Boolean))
  ).sort();
}

function getAvailableQuarters(rows: GoogleOsRow[]) {
  const quarters = rows
    .map((row) => {
      if (!row.date) return "";
      const [year, month] = row.date.slice(0, 7).split("-");
      const q = Math.ceil(Number(month) / 3);
      return `${year}-Q${q}`;
    })
    .filter(Boolean);

  return Array.from(new Set(quarters)).sort();
}

function rowQuarter(row: GoogleOsRow) {
  const [year, month] = row.date.slice(0, 7).split("-");
  const q = Math.ceil(Number(month) / 3);
  return `${year}-Q${q}`;
}

function filterRowsByMonth(rows: GoogleOsRow[], month: string) {
  if (!month) return [];
  return rows.filter((row) => row.date.startsWith(month));
}

function filterRowsByQuarter(rows: GoogleOsRow[], quarter: string) {
  if (!quarter) return [];
  return rows.filter((row) => rowQuarter(row) === quarter);
}

function decide(row: Omit<CampaignRow, "status" | "action" | "reason">): Pick<CampaignRow, "status" | "action" | "reason"> {
  if (row.cost >= 2000 && row.conversions === 0) {
    return {
      status: "PAUSE",
      action: "Pause / cut hard",
      reason: "Spend with zero purchases.",
    };
  }

  if (row.roas < 1 && row.cost >= 5000) {
    return {
      status: "REDUCE",
      action: "Reduce budget / bids",
      reason: "ROAS below 1x.",
    };
  }

  if (row.roas >= 3 && row.conversions >= 2) {
    return {
      status: "SCALE",
      action: "Protect / scale carefully",
      reason: "Strong ROAS and purchases.",
    };
  }

  if (row.roas >= 2) {
    return {
      status: "KEEP",
      action: "Hold and monitor",
      reason: "Positive efficiency.",
    };
  }

  if (row.cost >= 300) {
    return {
      status: "WATCH",
      action: "Watch search terms",
      reason: "Spend exists but efficiency is not strong.",
    };
  }

  return {
    status: "INVESTIGATE",
    action: "Collect more data",
    reason: "Insufficient spend for decision.",
  };
}

function buildCampaignRows(rows: GoogleOsRow[]) {
  const totalSpend = rows.reduce((sum, row) => sum + row.cost, 0);
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
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
  tone = "neutral",
}: {
  value: string;
  tone?: "green" | "red" | "amber" | "neutral";
}) {
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
    ? value > 0
      ? "green"
      : "red"
    : value > 0
      ? "red"
      : "green";
}

function statusTone(status: unknown) {
  const s = String(status || "");

  if (s === "SCALE" || s === "KEEP") return "green";
  if (s === "PAUSE" || s === "REDUCE") return "red";
  if (s === "WATCH") return "amber";

  return "neutral";
}

function pctDelta(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous && current) return 100;
  return ((current - previous) / previous) * 100;
}

function DeltaPct({
  value,
  goodWhenPositive = true,
}: {
  value: number;
  goodWhenPositive?: boolean;
}) {
  const sign = value > 0 ? "+" : "";
  return (
    <Metric
      value={`${sign}${value.toFixed(1)}%`}
      tone={deltaTone(value, goodWhenPositive)}
    />
  );
}

function DeltaMoney({
  value,
  goodWhenPositive = true,
}: {
  value: number;
  goodWhenPositive?: boolean;
}) {
  return (
    <Metric
      value={compactMoney(value)}
      tone={deltaTone(value, goodWhenPositive)}
    />
  );
}

export function CampaignsTab({
  model,
}: {
  model: GoogleOsModel;
  rows?: GoogleOsRow[];
  compareRows?: GoogleOsRow[];
  dateMode?: "last_30" | "month" | "custom";
  selectedMonth?: string;
  compareMonth?: string;
  customStart?: string;
  customEnd?: string;
}) {
  const months = useMemo(() => getAvailableMonths(model.rows), [model.rows]);
  const quarters = useMemo(() => getAvailableQuarters(model.rows), [model.rows]);

  const latestMonth = months[months.length - 1] || "";
  const previousMonth = months[months.length - 2] || "";
  const latestQuarter = quarters[quarters.length - 1] || "";

  const [viewMode, setViewMode] = useState<CampaignViewMode>("latest_month");
  const [selectedMonth, setSelectedMonth] = useState(latestMonth);
  const [compareMonth, setCompareMonth] = useState(previousMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(latestQuarter);

  const activeMonth = selectedMonth || latestMonth;
  const activeCompareMonth = compareMonth || previousMonth;
  const activeQuarter = selectedQuarter || latestQuarter;

  const selectedRows = useMemo(() => {
    if (viewMode === "quarter") {
      return filterRowsByQuarter(model.rows, activeQuarter);
    }

    return filterRowsByMonth(model.rows, activeMonth);
  }, [model.rows, viewMode, activeMonth, activeQuarter]);

  const comparisonRows = useMemo(() => {
    if (viewMode !== "month_compare") return [];
    return filterRowsByMonth(model.rows, activeCompareMonth);
  }, [model.rows, viewMode, activeCompareMonth]);

  const rows = useMemo(() => buildCampaignRows(selectedRows), [selectedRows]);
  const compare = useMemo(() => buildCampaignRows(comparisonRows), [comparisonRows]);

  const compareMap = useMemo(() => {
    const map = new Map<string, CampaignRow>();
    compare.forEach((row) => map.set(row.key, row));
    return map;
  }, [compare]);

  const tableRows = useMemo(() => {
    return rows.map((row) => {
      const prev = compareMap.get(row.key);

      return {
        ...row,
        compareCost: prev?.cost || 0,
        compareRevenue: prev?.conversionValue || 0,
        compareRoas: prev?.roas || 0,
        compareCpa: prev?.cpa || 0,
        compareConversions: prev?.conversions || 0,

        spendDelta: prev ? row.cost - prev.cost : 0,
        spendDeltaPct: prev ? pctDelta(row.cost, prev.cost) : 0,

        revenueDelta: prev ? row.conversionValue - prev.conversionValue : 0,
        revenueDeltaPct: prev ? pctDelta(row.conversionValue, prev.conversionValue) : 0,

        roasDelta: prev ? row.roas - prev.roas : 0,
        roasDeltaPct: prev ? pctDelta(row.roas, prev.roas) : 0,

        cpaDelta: prev ? row.cpa - prev.cpa : 0,
        cpaDeltaPct: prev ? pctDelta(row.cpa, prev.cpa) : 0,

        conversionsDelta: prev ? row.conversions - prev.conversions : 0,
        conversionsDeltaPct: prev ? pctDelta(row.conversions, prev.conversions) : 0,
      };
    });
  }, [rows, compareMap]);

  const title =
    viewMode === "quarter"
      ? activeQuarter
      : viewMode === "month_compare"
        ? `${formatMonthLabel(activeMonth)} vs ${formatMonthLabel(activeCompareMonth)}`
        : formatMonthLabel(activeMonth);

  return (
    <section className="gos-page">
      <div className="gos-panel">
        <div className="gos-panel-head campaign-filter-head">
          <div>
            <span>Campaigns</span>
            <h2>Campaign month-on-month performance</h2>
            <p>
              Showing {title}. Latest month is default. Use compare mode to compare any two months.
            </p>
          </div>

          <div className="campaign-filter-bar">
            <label>
              View
              <select
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as CampaignViewMode)}
              >
                <option value="latest_month">Latest Month</option>
                <option value="month_compare">Compare Months</option>
                <option value="quarter">Quarter View</option>
              </select>
            </label>

            {viewMode !== "quarter" ? (
              <label>
                Month
                <select
                  value={activeMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                >
                  {months.slice().reverse().map((month) => (
                    <option key={month} value={month}>
                      {formatMonthLabel(month)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {viewMode === "month_compare" ? (
              <label>
                Compare
                <select
                  value={activeCompareMonth}
                  onChange={(event) => setCompareMonth(event.target.value)}
                >
                  {months.slice().reverse().map((month) => (
                    <option key={month} value={month}>
                      {formatMonthLabel(month)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {viewMode === "quarter" ? (
              <label>
                Quarter
                <select
                  value={activeQuarter}
                  onChange={(event) => setSelectedQuarter(event.target.value)}
                >
                  {quarters.slice().reverse().map((quarter) => (
                    <option key={quarter} value={quarter}>
                      {quarter}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        <GoogleOsTable
          rows={tableRows as unknown as Record<string, unknown>[]}
          columns={[
            { key: "label", label: "Campaign" },
            { key: "campaignType", label: "Type" },
            { key: "campaignStatus", label: "Status" },

            { key: "cost", label: "Spend", right: true, render: (row) => <Metric value={compactMoney(row.cost)} tone="red" /> },
            ...(viewMode === "month_compare" ? [
              { key: "spendDelta", label: "Spend Δ", right: true, render: (row: Record<string, unknown>) => <DeltaMoney value={Number(row.spendDelta || 0)} goodWhenPositive={false} /> },
              { key: "spendDeltaPct", label: "Spend Δ%", right: true, render: (row: Record<string, unknown>) => <DeltaPct value={Number(row.spendDeltaPct || 0)} goodWhenPositive={false} /> },
            ] : []),

            { key: "conversionValue", label: "Revenue", right: true, render: (row) => <Metric value={compactMoney(row.conversionValue)} tone="green" /> },
            ...(viewMode === "month_compare" ? [
              { key: "revenueDelta", label: "Rev Δ", right: true, render: (row: Record<string, unknown>) => <DeltaMoney value={Number(row.revenueDelta || 0)} /> },
              { key: "revenueDeltaPct", label: "Rev Δ%", right: true, render: (row: Record<string, unknown>) => <DeltaPct value={Number(row.revenueDeltaPct || 0)} /> },
            ] : []),

            { key: "roas", label: "ROAS", right: true, render: (row) => <Metric value={x(row.roas)} tone={roasTone(Number(row.roas || 0))} /> },
            ...(viewMode === "month_compare" ? [
              { key: "roasDelta", label: "ROAS Δ", right: true, render: (row: Record<string, unknown>) => <Metric value={x(row.roasDelta)} tone={deltaTone(Number(row.roasDelta || 0))} /> },
              { key: "roasDeltaPct", label: "ROAS Δ%", right: true, render: (row: Record<string, unknown>) => <DeltaPct value={Number(row.roasDeltaPct || 0)} /> },
            ] : []),

            { key: "conversions", label: "Purch.", right: true, render: (row) => Number(row.conversions || 0).toFixed(0) },
            ...(viewMode === "month_compare" ? [
              { key: "conversionsDelta", label: "Purch. Δ", right: true, render: (row: Record<string, unknown>) => <Metric value={Number(row.conversionsDelta || 0).toFixed(0)} tone={deltaTone(Number(row.conversionsDelta || 0))} /> },
              { key: "conversionsDeltaPct", label: "Purch. Δ%", right: true, render: (row: Record<string, unknown>) => <DeltaPct value={Number(row.conversionsDeltaPct || 0)} /> },
            ] : []),

            { key: "cpa", label: "CPA", right: true, render: (row) => <Metric value={compactMoney(row.cpa)} tone={cpaTone(row)} /> },
            ...(viewMode === "month_compare" ? [
              { key: "cpaDelta", label: "CPA Δ", right: true, render: (row: Record<string, unknown>) => <DeltaMoney value={Number(row.cpaDelta || 0)} goodWhenPositive={false} /> },
              { key: "cpaDeltaPct", label: "CPA Δ%", right: true, render: (row: Record<string, unknown>) => <DeltaPct value={Number(row.cpaDeltaPct || 0)} goodWhenPositive={false} /> },
            ] : []),

            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "cvr", label: "CVR", right: true, render: (row) => <Metric value={pct(row.cvr)} tone={Number(row.cvr || 0) >= 0.02 ? "green" : "amber"} /> },
            { key: "spendShare", label: "Share", right: true, render: (row) => pct(row.spendShare) },
            { key: "status", label: "Decision", render: (row) => <Metric value={String(row.status || "")} tone={statusTone(row.status)} /> },
            { key: "action", label: "Action" },
          ]}
          empty="No campaign data available for this view."
        />
      </div>
    </section>
  );
}
