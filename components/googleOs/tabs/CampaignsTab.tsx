"use client";

import { useMemo, useState } from "react";
import type { GoogleOsModel, GoogleOsRow, GoogleOsStatus } from "../../../lib/googleOs/types";
import { compactMoney, pct, safeDiv, x } from "../../../lib/googleOs/format";
import { GoogleOsTable } from "../shared/GoogleOsTable";
import { formatGoogleOsDateLabel } from "../../../lib/googleOs/dateFilter";

type CampaignType = "All" | "Search" | "Shopping" | "Demand Gen" | "Video" | "Other";

type TypeSummaryRow = {
  type: CampaignType;
  ySpend: number;
  yRevenue: number;
  yPurchases: number;
  yRoas: number;
  yCpa: number;
  l7Spend: number;
  l7Revenue: number;
  l7Purchases: number;
  l7Roas: number;
  l7Cpa: number;
  spendShare: number;
  campaignCount: number;
};

type CampaignRow = {
  key: string;
  campaign: string;
  campaignType: CampaignType;
  campaignStatus: string;
  cost: number;
  conversionValue: number;
  conversions: number;
  roas: number;
  cpa: number;
  ctr: number;
  cvr: number;
  avgCpc: number;
  spendShare: number;
  status: GoogleOsStatus;
  action: string;
};

const TYPE_ORDER: CampaignType[] = ["Search", "Shopping", "Demand Gen", "Video", "Other"];
const TYPE_COLORS: Record<CampaignType, string> = {
  All: "#94A3B8",
  Search: "#4285F4",
  Shopping: "#34A853",
  "Demand Gen": "#FBBC04",
  Video: "#EA4335",
  Other: "#A855F7",
};

function getCampaignType(row: GoogleOsRow): CampaignType {
  const raw = String(row.campaignType || row.campaign || "").trim().toLowerCase();

  if (raw.includes("search")) return "Search";
  if (raw.includes("shopping")) return "Shopping";
  if (raw.includes("demand")) return "Demand Gen";
  if (raw.includes("video")) return "Video";

  return "Other";
}

function getMaxDate(rows: GoogleOsRow[]) {
  const dates = Array.from(new Set(rows.map((row) => row.date).filter(Boolean))).sort();
  return dates[dates.length - 1] || "";
}

function getLast7Rows(rows: GoogleOsRow[]) {
  const maxDate = getMaxDate(rows);
  if (!maxDate) return [];

  const end = new Date(`${maxDate}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return rows.filter((row) => {
    const d = new Date(`${row.date}T00:00:00`);
    return d >= start && d <= end;
  });
}

function getYesterdayRows(rows: GoogleOsRow[]) {
  const maxDate = getMaxDate(rows);
  if (!maxDate) return [];
  return rows.filter((row) => row.date === maxDate);
}

function aggregate(rows: GoogleOsRow[]) {
  const spend = rows.reduce((sum, row) => sum + row.cost, 0);
  const revenue = rows.reduce((sum, row) => sum + row.conversionValue, 0);
  const purchases = rows.reduce((sum, row) => sum + row.conversions, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);

  return {
    spend,
    revenue,
    purchases,
    impressions,
    clicks,
    roas: safeDiv(revenue, spend),
    cpa: safeDiv(spend, purchases),
    ctr: safeDiv(clicks, impressions),
    cvr: safeDiv(purchases, clicks),
    avgCpc: safeDiv(spend, clicks),
  };
}

function decide(row: {
  cost: number;
  conversionValue: number;
  conversions: number;
  roas: number;
}): Pick<CampaignRow, "status" | "action"> {
  if (row.cost >= 2000 && row.conversions === 0) {
    return { status: "PAUSE", action: "Pause / cut hard" };
  }

  if (row.roas < 1 && row.cost >= 5000) {
    return { status: "REDUCE", action: "Reduce budget / bids" };
  }

  if (row.roas >= 3 && row.conversions >= 2) {
    return { status: "SCALE", action: "Protect / scale carefully" };
  }

  if (row.roas >= 2) {
    return { status: "KEEP", action: "Hold and monitor" };
  }

  if (row.cost >= 300) {
    return { status: "WATCH", action: "Watch search terms" };
  }

  return { status: "INVESTIGATE", action: "Collect more data" };
}

function buildTypeSummary(rows: GoogleOsRow[]): TypeSummaryRow[] {
  const yesterdayRows = getYesterdayRows(rows);
  const last7Rows = getLast7Rows(rows);
  const totalLast7Spend = last7Rows.reduce((sum, row) => sum + row.cost, 0);

  return TYPE_ORDER.map((type) => {
    const yRows = yesterdayRows.filter((row) => getCampaignType(row) === type);
    const l7Rows = last7Rows.filter((row) => getCampaignType(row) === type);

    const y = aggregate(yRows);
    const l7 = aggregate(l7Rows);
    const campaignCount = new Set(l7Rows.map((row) => row.campaignId || row.campaign).filter(Boolean)).size;

    return {
      type,
      ySpend: y.spend,
      yRevenue: y.revenue,
      yPurchases: y.purchases,
      yRoas: y.roas,
      yCpa: y.cpa,
      l7Spend: l7.spend,
      l7Revenue: l7.revenue,
      l7Purchases: l7.purchases,
      l7Roas: l7.roas,
      l7Cpa: l7.cpa,
      spendShare: safeDiv(l7.spend, totalLast7Spend),
      campaignCount,
    };
  }).filter((row) => row.l7Spend > 0 || row.campaignCount > 0);
}

function buildCampaignRows(rows: GoogleOsRow[], selectedType: CampaignType): CampaignRow[] {
  const last7Rows = getLast7Rows(rows);
  const filteredRows =
    selectedType === "All"
      ? last7Rows
      : last7Rows.filter((row) => getCampaignType(row) === selectedType);

  const totalSpend = filteredRows.reduce((sum, row) => sum + row.cost, 0);
  const groups = new Map<string, GoogleOsRow[]>();

  filteredRows.forEach((row) => {
    const key = row.campaignId || row.campaign;
    if (!key) return;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries())
    .map(([key, groupRows]) => {
      const first = groupRows[0];
      const a = aggregate(groupRows);
      const base = {
        key,
        campaign: first.campaign,
        campaignType: getCampaignType(first),
        campaignStatus: first.campaignStatus || "-",
        cost: a.spend,
        conversionValue: a.revenue,
        conversions: a.purchases,
        roas: a.roas,
        cpa: a.cpa,
        ctr: a.ctr,
        cvr: a.cvr,
        avgCpc: a.avgCpc,
        spendShare: safeDiv(a.spend, totalSpend),
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

function statusTone(status: unknown) {
  const s = String(status || "");
  if (s === "SCALE" || s === "KEEP") return "green";
  if (s === "PAUSE" || s === "REDUCE") return "red";
  if (s === "WATCH") return "amber";
  return "neutral";
}

function TypeDot({ type }: { type: CampaignType }) {
  return <i className="all-campaign-type-dot" style={{ background: TYPE_COLORS[type] }} />;
}

function CampaignTypeKpiChart({ rows }: { rows: TypeSummaryRow[] }) {
  const maxSpend = Math.max(...rows.map((row) => row.l7Spend), 1);
  const maxRevenue = Math.max(...rows.map((row) => row.l7Revenue), 1);

  return (
    <div className="all-campaign-type-chart">
      <div className="all-campaign-type-chart-head">
        <div>
          <span>Visualisation</span>
          <h2>Campaign type KPI comparison</h2>
          <p>Last 7 days spend share with yesterday performance context.</p>
        </div>
      </div>

      <div className="all-campaign-type-bars">
        {rows.map((row) => (
          <div key={row.type} className="all-campaign-type-bar-row">
            <div className="all-campaign-type-label">
              <TypeDot type={row.type} />
              <strong>{row.type}</strong>
              <small>{row.campaignCount} campaigns</small>
            </div>

            <div className="all-campaign-type-bar-metric">
              <span>Spend</span>
              <div className="all-campaign-type-bar-track">
                <b
                  style={{
                    width: `${Math.max((row.l7Spend / maxSpend) * 100, row.l7Spend > 0 ? 3 : 0)}%`,
                    background: TYPE_COLORS[row.type],
                  }}
                />
              </div>
              <em>{compactMoney(row.l7Spend)} · {pct(row.spendShare)}</em>
            </div>

            <div className="all-campaign-type-bar-metric">
              <span>Revenue</span>
              <div className="all-campaign-type-bar-track muted">
                <b
                  style={{
                    width: `${Math.max((row.l7Revenue / maxRevenue) * 100, row.l7Revenue > 0 ? 3 : 0)}%`,
                    background: TYPE_COLORS[row.type],
                  }}
                />
              </div>
              <em>{compactMoney(row.l7Revenue)}</em>
            </div>

            <div className="all-campaign-type-mini-kpis">
              <strong className={roasTone(row.l7Roas)}>ROAS {x(row.l7Roas)}</strong>
              <strong>CPA {compactMoney(row.l7Cpa)}</strong>
              <strong>{row.l7Purchases.toFixed(0)} Purch.</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
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
  const [selectedType, setSelectedType] = useState<CampaignType>("All");

  const maxDate = useMemo(() => getMaxDate(model.rows), [model.rows]);
  const typeSummaryRows = useMemo(() => buildTypeSummary(model.rows), [model.rows]);
  const campaignRows = useMemo(() => buildCampaignRows(model.rows, selectedType), [model.rows, selectedType]);

  const selectedSummary = useMemo(() => {
    if (selectedType === "All") {
      const totalYSpend = typeSummaryRows.reduce((sum, row) => sum + row.ySpend, 0);
      const totalYRevenue = typeSummaryRows.reduce((sum, row) => sum + row.yRevenue, 0);
      const totalYPurchases = typeSummaryRows.reduce((sum, row) => sum + row.yPurchases, 0);
      const totalL7Spend = typeSummaryRows.reduce((sum, row) => sum + row.l7Spend, 0);
      const totalL7Revenue = typeSummaryRows.reduce((sum, row) => sum + row.l7Revenue, 0);
      const totalL7Purchases = typeSummaryRows.reduce((sum, row) => sum + row.l7Purchases, 0);
      const totalCampaigns = typeSummaryRows.reduce((sum, row) => sum + row.campaignCount, 0);

      return {
        type: "All" as CampaignType,
        ySpend: totalYSpend,
        yRevenue: totalYRevenue,
        yPurchases: totalYPurchases,
        yRoas: safeDiv(totalYRevenue, totalYSpend),
        yCpa: safeDiv(totalYSpend, totalYPurchases),
        l7Spend: totalL7Spend,
        l7Revenue: totalL7Revenue,
        l7Purchases: totalL7Purchases,
        l7Roas: safeDiv(totalL7Revenue, totalL7Spend),
        l7Cpa: safeDiv(totalL7Spend, totalL7Purchases),
        spendShare: 1,
        campaignCount: totalCampaigns,
      };
    }

    return typeSummaryRows.find((row) => row.type === selectedType);
  }, [selectedType, typeSummaryRows]);

  return (
    <section className="gos-page all-campaigns-summary-page">
      <div className="gos-panel">
        <div className="gos-panel-head all-campaigns-head">
          <div>
            <span>All Campaigns</span>
            <h2>Campaign type spend, share and efficiency</h2>
            <p>
              Yesterday = {maxDate ? formatGoogleOsDateLabel(maxDate) : "-"}.
              Last 7 days powers campaign type share and campaign dropdown below.
            </p>
          </div>

          <label className="all-campaign-type-select">
            Campaign Type
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as CampaignType)}
            >
              <option value="All">All Campaign Types</option>
              {typeSummaryRows.map((row) => (
                <option key={row.type} value={row.type}>
                  {row.type}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="all-campaign-selected-summary">
          <div>
            <span>Selected View</span>
            <strong>{selectedSummary?.type || selectedType}</strong>
            <small>{selectedSummary?.campaignCount || 0} campaigns</small>
          </div>

          <div>
            <span>Yesterday Spend</span>
            <strong className="red">{compactMoney(selectedSummary?.ySpend || 0)}</strong>
            <small>ROAS {x(selectedSummary?.yRoas || 0)} · CPA {compactMoney(selectedSummary?.yCpa || 0)}</small>
          </div>

          <div>
            <span>Yesterday Revenue</span>
            <strong className="green">{compactMoney(selectedSummary?.yRevenue || 0)}</strong>
            <small>{(selectedSummary?.yPurchases || 0).toFixed(0)} purchases</small>
          </div>

          <div>
            <span>Last 7 Days Spend</span>
            <strong className="red">{compactMoney(selectedSummary?.l7Spend || 0)}</strong>
            <small>{pct(selectedSummary?.spendShare || 0)} share of spend</small>
          </div>

          <div>
            <span>Last 7 Days Revenue</span>
            <strong className="green">{compactMoney(selectedSummary?.l7Revenue || 0)}</strong>
            <small>ROAS {x(selectedSummary?.l7Roas || 0)} · CPA {compactMoney(selectedSummary?.l7Cpa || 0)}</small>
          </div>
        </div>

        <GoogleOsTable
          rows={typeSummaryRows as unknown as Record<string, unknown>[]}
          columns={[
            {
              key: "type",
              label: "Campaign Type",
              render: (row) => (
                <span className="all-campaign-type-name">
                  <TypeDot type={String(row.type || "Other") as CampaignType} />
                  {String(row.type || "")}
                </span>
              ),
            },
            { key: "campaignCount", label: "Campaigns", right: true },
            { key: "ySpend", label: "Yest. Spend", right: true, render: (row) => <Metric value={compactMoney(row.ySpend)} tone="red" /> },
            { key: "yRevenue", label: "Yest. Revenue", right: true, render: (row) => <Metric value={compactMoney(row.yRevenue)} tone="green" /> },
            { key: "yRoas", label: "Yest. ROAS", right: true, render: (row) => <Metric value={x(row.yRoas)} tone={roasTone(Number(row.yRoas || 0))} /> },
            { key: "yPurchases", label: "Yest. Purch.", right: true, render: (row) => Number(row.yPurchases || 0).toFixed(0) },
            { key: "yCpa", label: "Yest. CPA", right: true, render: (row) => compactMoney(row.yCpa) },
            { key: "l7Spend", label: "L7 Spend", right: true, render: (row) => <Metric value={compactMoney(row.l7Spend)} tone="red" /> },
            { key: "spendShare", label: "L7 Share", right: true, render: (row) => pct(row.spendShare) },
            { key: "l7Revenue", label: "L7 Revenue", right: true, render: (row) => <Metric value={compactMoney(row.l7Revenue)} tone="green" /> },
            { key: "l7Roas", label: "L7 ROAS", right: true, render: (row) => <Metric value={x(row.l7Roas)} tone={roasTone(Number(row.l7Roas || 0))} /> },
            { key: "l7Purchases", label: "L7 Purch.", right: true, render: (row) => Number(row.l7Purchases || 0).toFixed(0) },
            { key: "l7Cpa", label: "L7 CPA", right: true, render: (row) => compactMoney(row.l7Cpa) },
          ]}
          empty="No campaign type data available."
        />
      </div>

      <div className="gos-panel">
        <CampaignTypeKpiChart rows={typeSummaryRows} />
      </div>

      <div className="gos-panel">
        <div className="gos-panel-head">
          <div>
            <span>Campaign Dropdown</span>
            <h2>{selectedType === "All" ? "All campaigns" : `${selectedType} campaigns`} — last 7 days</h2>
            <p>No ad group expansion in this view. Use specific Search / Shopping / Demand Gen tabs for deeper drilldowns.</p>
          </div>
        </div>

        <GoogleOsTable
          rows={campaignRows as unknown as Record<string, unknown>[]}
          columns={[
            { key: "campaign", label: "Campaign" },
            { key: "campaignType", label: "Type" },
            { key: "campaignStatus", label: "Status" },
            { key: "cost", label: "Spend", right: true, render: (row) => <Metric value={compactMoney(row.cost)} tone="red" /> },
            { key: "spendShare", label: "Share", right: true, render: (row) => pct(row.spendShare) },
            { key: "conversionValue", label: "Revenue", right: true, render: (row) => <Metric value={compactMoney(row.conversionValue)} tone="green" /> },
            { key: "roas", label: "ROAS", right: true, render: (row) => <Metric value={x(row.roas)} tone={roasTone(Number(row.roas || 0))} /> },
            { key: "conversions", label: "Purch.", right: true, render: (row) => Number(row.conversions || 0).toFixed(0) },
            { key: "cpa", label: "CPA", right: true, render: (row) => <Metric value={compactMoney(row.cpa)} tone={cpaTone(row)} /> },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "cvr", label: "CVR", right: true, render: (row) => pct(row.cvr) },
            { key: "status", label: "Decision", render: (row) => <Metric value={String(row.status || "")} tone={statusTone(row.status)} /> },
            { key: "action", label: "Action" },
          ]}
          empty="No campaigns available for selected campaign type."
        />
      </div>
    </section>
  );
}
