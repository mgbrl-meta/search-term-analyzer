"use client";

import { useMemo, useState } from "react";
import type { GoogleOsModel, GoogleOsRow, GoogleOsStatus } from "../../../lib/googleOs/types";
import { compactMoney, pct, safeDiv, x } from "../../../lib/googleOs/format";
import { formatGoogleOsDateLabel, formatGoogleOsMonthLabel } from "../../../lib/googleOs/dateFilter";

type PeriodMode = "daily" | "weekly" | "monthly" | "quarterly";

type Segment =
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

function buildCampaignRows(rows: GoogleOsRow[], segment: Segment) {
  const filteredRows = rows.filter((row) => getSegment(row) === segment);
  const totalSegmentSpend = filteredRows.reduce((sum, row) => sum + row.cost, 0);
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
        segment,
        statusText: first.campaignStatus || "-",
        spend: a.spend,
        revenue: a.revenue,
        purchases: a.purchases,
        roas: a.roas,
        cpa: a.cpa,
        ctr: a.ctr,
        cvr: a.cvr,
        share: safeDiv(a.spend, totalSegmentSpend),
      };

      return {
        ...base,
        ...decide(base),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

function roasClass(value: number) {
  if (value >= 3) return "green";
  if (value < 1) return "red";
  if (value < 2) return "amber";
  return "";
}

function decisionClass(value: unknown) {
  const s = String(value || "");

  if (s === "SCALE" || s === "KEEP") return "green";
  if (s === "PAUSE" || s === "REDUCE") return "red";
  if (s === "WATCH") return "amber";

  return "";
}

function SegmentDot({ segment }: { segment: Segment }) {
  return <i className="gos-segment-dot" style={{ background: SEGMENT_COLORS[segment] }} />;
}

export function CampaignsTab({ model }: { model: GoogleOsModel }) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const periods = useMemo(() => getAvailablePeriods(model.rows, periodMode), [model.rows, periodMode]);
  const latestPeriod = periods[periods.length - 1] || "";
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [openSegments, setOpenSegments] = useState<Record<string, boolean>>({
    "Search Brand": true,
    "Search Non Brand": true,
    "Shopping Brand": true,
    "Shopping Non Brand": true,
  });

  const activePeriod = selectedPeriod && periods.includes(selectedPeriod) ? selectedPeriod : latestPeriod;

  const periodRows = useMemo(() => {
    return model.rows.filter((row) => getPeriodKey(row, periodMode) === activePeriod);
  }, [model.rows, periodMode, activePeriod]);

  const segmentRows = useMemo(() => buildSegmentRows(periodRows), [periodRows]);

  const totals = useMemo(() => aggregate(periodRows), [periodRows]);

  function toggleSegment(segment: Segment) {
    setOpenSegments((current) => ({
      ...current,
      [segment]: !current[segment],
    }));
  }

  return (
    <section className="gos-page all-campaigns-summary-page">
      <div className="gos-panel gos-campaign-accordion-panel">
        <div className="gos-campaign-accordion-head">
          <div>
            <span>All Campaigns</span>
            <h2>Campaign type spend and campaign breakdown</h2>
            <p>
              Showing {getPeriodLabel(activePeriod, periodMode)}. Click any campaign type row to view campaigns below it.
            </p>
          </div>

          <div className="gos-campaign-period-filter">
            <div className="gos-campaign-period-buttons">
              <button
                type="button"
                className={periodMode === "daily" ? "active" : ""}
                onClick={() => {
                  setPeriodMode("daily");
                  setSelectedPeriod("");
                }}
              >
                Daily
              </button>
              <button
                type="button"
                className={periodMode === "weekly" ? "active" : ""}
                onClick={() => {
                  setPeriodMode("weekly");
                  setSelectedPeriod("");
                }}
              >
                Weekly
              </button>
              <button
                type="button"
                className={periodMode === "monthly" ? "active" : ""}
                onClick={() => {
                  setPeriodMode("monthly");
                  setSelectedPeriod("");
                }}
              >
                Monthly
              </button>
              <button
                type="button"
                className={periodMode === "quarterly" ? "active" : ""}
                onClick={() => {
                  setPeriodMode("quarterly");
                  setSelectedPeriod("");
                }}
              >
                Quarterly
              </button>
            </div>

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
          </div>
        </div>

        <div className="gos-campaign-summary-strip">
          <div>
            <span>Total Spend</span>
            <strong className="red">{compactMoney(totals.spend)}</strong>
          </div>
          <div>
            <span>Total Revenue</span>
            <strong className="green">{compactMoney(totals.revenue)}</strong>
          </div>
          <div>
            <span>ROAS</span>
            <strong className={roasClass(totals.roas)}>{x(totals.roas)}</strong>
          </div>
          <div>
            <span>Purchases</span>
            <strong>{totals.purchases.toFixed(0)}</strong>
          </div>
          <div>
            <span>CPA</span>
            <strong>{compactMoney(totals.cpa)}</strong>
          </div>
          <div>
            <span>CTR / CVR</span>
            <strong>{pct(totals.ctr)}</strong>
            <small>CVR {pct(totals.cvr)}</small>
          </div>
        </div>

        <div className="gos-campaign-type-table">
          <div className="gos-campaign-table-header">
            <span className="campaign-col-main">Campaign Type</span>
            <span>Campaigns</span>
            <span>Spend</span>
            <span>% Share of Total Spend</span>
            <span>Revenue</span>
            <span>ROAS</span>
            <span>Purch.</span>
            <span>CPA</span>
            <span>CTR</span>
            <span>CVR</span>
          </div>

          {segmentRows.map((segmentRow) => {
            const isOpen = Boolean(openSegments[segmentRow.segment]);
            const campaigns = buildCampaignRows(periodRows, segmentRow.segment);

            return (
              <div key={segmentRow.segment} className="gos-campaign-segment-group">
                <button
                  type="button"
                  className="gos-campaign-segment-row"
                  onClick={() => toggleSegment(segmentRow.segment)}
                >
                  <span className="campaign-col-main campaign-segment-name">
                    <b>{isOpen ? "−" : "+"}</b>
                    <SegmentDot segment={segmentRow.segment} />
                    <strong>{segmentRow.segment}</strong>
                  </span>

                  <span>{segmentRow.campaigns}</span>
                  <span className="red">{compactMoney(segmentRow.spend)}</span>
                  <span>{pct(segmentRow.share)}</span>
                  <span className="green">{compactMoney(segmentRow.revenue)}</span>
                  <span className={roasClass(segmentRow.roas)}>{x(segmentRow.roas)}</span>
                  <span>{segmentRow.purchases.toFixed(0)}</span>
                  <span>{compactMoney(segmentRow.cpa)}</span>
                  <span>{pct(segmentRow.ctr)}</span>
                  <span>{pct(segmentRow.cvr)}</span>
                </button>

                {isOpen ? (
                  <div className="gos-campaign-child-table">
                    {campaigns.map((campaign) => (
                      <div key={campaign.key} className="gos-campaign-child-row">
                        <span className="campaign-col-main campaign-child-name">
                          <i />
                          <strong>{campaign.campaign}</strong>
                          
                        </span>

                        <span>—</span>
                        <span className="red">{compactMoney(campaign.spend)}</span>
                        <span>{pct(campaign.share)} of type</span>
                        <span className="green">{compactMoney(campaign.revenue)}</span>
                        <span className={roasClass(campaign.roas)}>{x(campaign.roas)}</span>
                        <span>{campaign.purchases.toFixed(0)}</span>
                        <span>{compactMoney(campaign.cpa)}</span>
                        <span>{pct(campaign.ctr)}</span>
                        <span>{pct(campaign.cvr)}</span>
                        <span className={`campaign-decision ${decisionClass(campaign.decision)}`}>
                          {campaign.decision}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
