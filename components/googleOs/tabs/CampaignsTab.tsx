"use client";

import { useMemo, useState } from "react";
import type { GoogleOsModel, GoogleOsRow, GoogleOsStatus } from "../../../lib/googleOs/types";
import { compactMoney, pct, safeDiv, x } from "../../../lib/googleOs/format";
import { GoogleOsTable } from "../shared/GoogleOsTable";
import { formatGoogleOsDateLabel, formatGoogleOsMonthLabel } from "../../../lib/googleOs/dateFilter";

type PeriodMode = "daily" | "weekly" | "monthly" | "quarterly";

type Segment =
  | "All"
  | "Search Brand"
  | "Search Non Brand"
  | "Shopping Brand"
  | "Shopping Non Brand"
  | "Demand Gen"
  | "Video"
  | "Other";

type SegmentRow = {
  segment: Segment;
  campaigns: number;
  spend: number;
  revenue: number;
  purchases: number;
  roas: number;
  cpa: number;
  ctr: number;
  cvr: number;
  share: number;
};

type CampaignRow = {
  key: string;
  campaign: string;
  segment: Segment;
  statusText: string;
  spend: number;
  revenue: number;
  purchases: number;
  roas: number;
  cpa: number;
  ctr: number;
  cvr: number;
  avgCpc: number;
  share: number;
  decision: GoogleOsStatus;
  action: string;
};

const SEGMENTS: Segment[] = [
  "Search Brand",
  "Search Non Brand",
  "Shopping Brand",
  "Shopping Non Brand",
  "Demand Gen",
  "Video",
  "Other",
];

const SEGMENT_COLORS: Record<Segment, string> = {
  All: "#94A3B8",
  "Search Brand": "#4285F4",
  "Search Non Brand": "#7BAAF7",
  "Shopping Brand": "#34A853",
  "Shopping Non Brand": "#81C995",
  "Demand Gen": "#FBBC04",
  Video: "#EA4335",
  Other: "#A855F7",
};

function isBrandCampaign(row: GoogleOsRow) {
  const text = `${row.campaign || ""} ${row.adGroup || ""}`.toLowerCase();

  return (
    text.includes("brand") ||
    text.includes("branded") ||
    text.includes("bof") ||
    text.includes("brillare") ||
    text.includes("root deep")
  );
}

function getBaseType(row: GoogleOsRow) {
  const raw = `${row.campaignType || ""} ${row.campaign || ""}`.toLowerCase();

  if (raw.includes("search")) return "Search";
  if (raw.includes("shopping")) return "Shopping";
  if (raw.includes("demand")) return "Demand Gen";
  if (raw.includes("video")) return "Video";

  return "Other";
}

function getSegment(row: GoogleOsRow): Segment {
  const type = getBaseType(row);

  if (type === "Search") {
    return isBrandCampaign(row) ? "Search Brand" : "Search Non Brand";
  }

  if (type === "Shopping") {
    return isBrandCampaign(row) ? "Shopping Brand" : "Shopping Non Brand";
  }

  if (type === "Demand Gen") return "Demand Gen";
  if (type === "Video") return "Video";

  return "Other";
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

function dateToKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPeriodKey(row: GoogleOsRow, mode: PeriodMode) {
  const date = new Date(`${row.date}T00:00:00`);

  if (Number.isNaN(date.getTime())) return row.date || "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  if (mode === "daily") return row.date;
  if (mode === "monthly") return `${year}-${month}`;

  if (mode === "quarterly") {
    return `${year}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
  }

  return dateToKey(startOfWeek(date));
}

function getPeriodLabel(period: string, mode: PeriodMode) {
  if (mode === "daily") return formatGoogleOsDateLabel(period);
  if (mode === "monthly") return formatGoogleOsMonthLabel(period);
  if (mode === "quarterly") return period;

  return `Week of ${formatGoogleOsDateLabel(period)}`;
}

function getAvailablePeriods(rows: GoogleOsRow[], mode: PeriodMode) {
  return Array.from(new Set(rows.map((row) => getPeriodKey(row, mode)).filter(Boolean))).sort();
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

function decide(row: { spend: number; purchases: number; roas: number }): Pick<CampaignRow, "decision" | "action"> {
  if (row.spend >= 2000 && row.purchases === 0) {
    return { decision: "PAUSE", action: "Pause / cut hard" };
  }

  if (row.roas < 1 && row.spend >= 5000) {
    return { decision: "REDUCE", action: "Reduce budget / bids" };
  }

  if (row.roas >= 3 && row.purchases >= 2) {
    return { decision: "SCALE", action: "Protect / scale carefully" };
  }

  if (row.roas >= 2) {
    return { decision: "KEEP", action: "Hold and monitor" };
  }

  return { decision: "WATCH", action: "Watch performance" };
}

function buildSegmentRows(rows: GoogleOsRow[]) {
  const totalSpend = rows.reduce((sum, row) => sum + row.cost, 0);

  return SEGMENTS.map((segment) => {
    const segmentRows = rows.filter((row) => getSegment(row) === segment);
    const a = aggregate(segmentRows);
    const campaigns = new Set(segmentRows.map((row) => row.campaignId || row.campaign).filter(Boolean)).size;

    return {
      segment,
      campaigns,
      spend: a.spend,
      revenue: a.revenue,
      purchases: a.purchases,
      roas: a.roas,
      cpa: a.cpa,
      ctr: a.ctr,
      cvr: a.cvr,
      share: safeDiv(a.spend, totalSpend),
    };
  }).filter((row) => row.spend > 0 || row.campaigns > 0);
}

function buildCampaignRows(rows: GoogleOsRow[], selectedSegment: Segment) {
  const filteredRows =
    selectedSegment === "All"
      ? rows
      : rows.filter((row) => getSegment(row) === selectedSegment);

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
        segment: getSegment(first),
        statusText: first.campaignStatus || "-",
        spend: a.spend,
        revenue: a.revenue,
        purchases: a.purchases,
        roas: a.roas,
        cpa: a.cpa,
        ctr: a.ctr,
        cvr: a.cvr,
        avgCpc: a.avgCpc,
        share: safeDiv(a.spend, totalSpend),
      };

      return {
        ...base,
        ...decide(base),
      };
    })
    .sort((a, b) => b.spend - a.spend);
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

function statusTone(value: unknown) {
  const s = String(value || "");

  if (s === "SCALE" || s === "KEEP") return "green";
  if (s === "PAUSE" || s === "REDUCE") return "red";
  if (s === "WATCH") return "amber";

  return "neutral";
}

function SegmentDot({ segment }: { segment: Segment }) {
  return <i className="all-campaign-type-dot" style={{ background: SEGMENT_COLORS[segment] }} />;
}

function SegmentVisual({ rows }: { rows: SegmentRow[] }) {
  const maxSpend = Math.max(...rows.map((row) => row.spend), 1);
  const maxRevenue = Math.max(...rows.map((row) => row.revenue), 1);

  return (
    <div className="all-campaign-type-chart">
      <div className="all-campaign-type-chart-head">
        <div>
          <span>Visualisation</span>
          <h2>Segment KPI comparison</h2>
          <p>Spend share, revenue, ROAS, CPA and purchases by campaign segment.</p>
        </div>
      </div>

      <div className="all-campaign-type-bars">
        {rows.map((row) => (
          <div key={row.segment} className="all-campaign-type-bar-row">
            <div className="all-campaign-type-label">
              <SegmentDot segment={row.segment} />
              <strong>{row.segment}</strong>
              <small>{row.campaigns} campaigns</small>
            </div>

            <div className="all-campaign-type-bar-metric">
              <span>Spend</span>
              <div className="all-campaign-type-bar-track">
                <b
                  style={{
                    width: `${Math.max((row.spend / maxSpend) * 100, row.spend > 0 ? 3 : 0)}%`,
                    background: SEGMENT_COLORS[row.segment],
                  }}
                />
              </div>
              <em>{compactMoney(row.spend)} · {pct(row.share)}</em>
            </div>

            <div className="all-campaign-type-bar-metric">
              <span>Revenue</span>
              <div className="all-campaign-type-bar-track muted">
                <b
                  style={{
                    width: `${Math.max((row.revenue / maxRevenue) * 100, row.revenue > 0 ? 3 : 0)}%`,
                    background: SEGMENT_COLORS[row.segment],
                  }}
                />
              </div>
              <em>{compactMoney(row.revenue)}</em>
            </div>

            <div className="all-campaign-type-mini-kpis">
              <strong className={roasTone(row.roas)}>ROAS {x(row.roas)}</strong>
              <strong>CPA {compactMoney(row.cpa)}</strong>
              <strong>{row.purchases.toFixed(0)} Purch.</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CampaignsTab({ model }: { model: GoogleOsModel }) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const periods = useMemo(() => getAvailablePeriods(model.rows, periodMode), [model.rows, periodMode]);
  const latestPeriod = periods[periods.length - 1] || "";
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<Segment>("All");

  const activePeriod = selectedPeriod && periods.includes(selectedPeriod) ? selectedPeriod : latestPeriod;

  const periodRows = useMemo(() => {
    return model.rows.filter((row) => getPeriodKey(row, periodMode) === activePeriod);
  }, [model.rows, periodMode, activePeriod]);

  const segmentRows = useMemo(() => buildSegmentRows(periodRows), [periodRows]);
  const campaignRows = useMemo(() => buildCampaignRows(periodRows, selectedSegment), [periodRows, selectedSegment]);

  const selectedSummary = useMemo(() => {
    if (selectedSegment === "All") {
      const a = aggregate(periodRows);
      const campaigns = new Set(periodRows.map((row) => row.campaignId || row.campaign).filter(Boolean)).size;

      return {
        segment: "All" as Segment,
        campaigns,
        spend: a.spend,
        revenue: a.revenue,
        purchases: a.purchases,
        roas: a.roas,
        cpa: a.cpa,
        ctr: a.ctr,
        cvr: a.cvr,
        share: 1,
      };
    }

    return segmentRows.find((row) => row.segment === selectedSegment);
  }, [periodRows, selectedSegment, segmentRows]);

  return (
    <section className="gos-page all-campaigns-summary-page">
      <div className="gos-panel">
        <div className="gos-panel-head all-campaigns-head">
          <div>
            <span>All Campaigns</span>
            <h2>Campaign segment spend, share and efficiency</h2>
            <p>
              Showing {getPeriodLabel(activePeriod, periodMode)}. Search and Shopping are split into Brand and Non Brand.
            </p>
          </div>

          <div className="all-campaign-filter-row">
            <label>
              View
              <select
                value={periodMode}
                onChange={(event) => {
                  setPeriodMode(event.target.value as PeriodMode);
                  setSelectedPeriod("");
                }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>

            <label>
              Period
              <select value={activePeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>
                {periods.slice().reverse().map((period) => (
                  <option key={period} value={period}>
                    {getPeriodLabel(period, periodMode)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Segment
              <select value={selectedSegment} onChange={(event) => setSelectedSegment(event.target.value as Segment)}>
                <option value="All">All Segments</option>
                {segmentRows.map((row) => (
                  <option key={row.segment} value={row.segment}>
                    {row.segment}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="all-campaign-selected-summary">
          <div>
            <span>Selected View</span>
            <strong>{selectedSummary?.segment || selectedSegment}</strong>
            <small>{selectedSummary?.campaigns || 0} campaigns</small>
          </div>

          <div>
            <span>Spend</span>
            <strong className="red">{compactMoney(selectedSummary?.spend || 0)}</strong>
            <small>{pct(selectedSummary?.share || 0)} share</small>
          </div>

          <div>
            <span>Revenue</span>
            <strong className="green">{compactMoney(selectedSummary?.revenue || 0)}</strong>
            <small>{(selectedSummary?.purchases || 0).toFixed(0)} purchases</small>
          </div>

          <div>
            <span>ROAS</span>
            <strong>{x(selectedSummary?.roas || 0)}</strong>
            <small>CPA {compactMoney(selectedSummary?.cpa || 0)}</small>
          </div>

          <div>
            <span>CTR / CVR</span>
            <strong>{pct(selectedSummary?.ctr || 0)}</strong>
            <small>CVR {pct(selectedSummary?.cvr || 0)}</small>
          </div>
        </div>

        <GoogleOsTable
          rows={segmentRows as unknown as Record<string, unknown>[]}
          columns={[
            {
              key: "segment",
              label: "Segment",
              render: (row) => (
                <span className="all-campaign-type-name">
                  <SegmentDot segment={String(row.segment || "Other") as Segment} />
                  {String(row.segment || "")}
                </span>
              ),
            },
            { key: "campaigns", label: "Campaigns", right: true },
            { key: "spend", label: "Spend", right: true, render: (row) => <Metric value={compactMoney(row.spend)} tone="red" /> },
            { key: "share", label: "Share", right: true, render: (row) => pct(row.share) },
            { key: "revenue", label: "Revenue", right: true, render: (row) => <Metric value={compactMoney(row.revenue)} tone="green" /> },
            { key: "roas", label: "ROAS", right: true, render: (row) => <Metric value={x(row.roas)} tone={roasTone(Number(row.roas || 0))} /> },
            { key: "purchases", label: "Purch.", right: true, render: (row) => Number(row.purchases || 0).toFixed(0) },
            { key: "cpa", label: "CPA", right: true, render: (row) => compactMoney(row.cpa) },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "cvr", label: "CVR", right: true, render: (row) => pct(row.cvr) },
          ]}
          empty="No segment data available."
        />
      </div>

      <div className="gos-panel">
        <SegmentVisual rows={segmentRows} />
      </div>

      <div className="gos-panel">
        <div className="gos-panel-head">
          <div>
            <span>Campaign Dropdown</span>
            <h2>{selectedSegment === "All" ? "All campaigns" : `${selectedSegment} campaigns`}</h2>
            <p>Campaign list for selected segment and period. Ad groups are intentionally excluded here.</p>
          </div>
        </div>

        <GoogleOsTable
          rows={campaignRows as unknown as Record<string, unknown>[]}
          columns={[
            { key: "campaign", label: "Campaign" },
            { key: "segment", label: "Segment" },
            { key: "statusText", label: "Status" },
            { key: "spend", label: "Spend", right: true, render: (row) => <Metric value={compactMoney(row.spend)} tone="red" /> },
            { key: "share", label: "Share", right: true, render: (row) => pct(row.share) },
            { key: "revenue", label: "Revenue", right: true, render: (row) => <Metric value={compactMoney(row.revenue)} tone="green" /> },
            { key: "roas", label: "ROAS", right: true, render: (row) => <Metric value={x(row.roas)} tone={roasTone(Number(row.roas || 0))} /> },
            { key: "purchases", label: "Purch.", right: true, render: (row) => Number(row.purchases || 0).toFixed(0) },
            { key: "cpa", label: "CPA", right: true, render: (row) => compactMoney(row.cpa) },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "cvr", label: "CVR", right: true, render: (row) => pct(row.cvr) },
            { key: "decision", label: "Decision", render: (row) => <Metric value={String(row.decision || "")} tone={statusTone(row.decision)} /> },
            { key: "action", label: "Action" },
          ]}
          empty="No campaigns available for selected segment."
        />
      </div>
    </section>
  );
}
