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

type BrandGroup = "Brand" | "Non Brand";

type BrandSummaryRow = {
  group: BrandGroup;
  rows: SegmentRow[];
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

function buildBrandSummaryRows(segmentRows: SegmentRow[]): BrandSummaryRow[] {
  const totalSpend = segmentRows.reduce((sum, row) => sum + row.spend, 0);

  const groups: { group: BrandGroup; segments: Segment[] }[] = [
    { group: "Brand", segments: ["Search Brand", "Shopping Brand"] },
    { group: "Non Brand", segments: ["Search Non Brand", "Shopping Non Brand"] },
  ];

  return groups
    .map(({ group, segments }) => {
      const rows = segmentRows.filter((row) => segments.includes(row.segment));

      const campaigns = rows.reduce((sum, row) => sum + row.campaigns, 0);
      const spend = rows.reduce((sum, row) => sum + row.spend, 0);
      const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
      const purchases = rows.reduce((sum, row) => sum + row.purchases, 0);

      const weightedCtrNumerator = rows.reduce((sum, row) => sum + row.ctr * row.spend, 0);
      const weightedCvrNumerator = rows.reduce((sum, row) => sum + row.cvr * row.spend, 0);

      return {
        group,
        rows,
        campaigns,
        spend,
        revenue,
        purchases,
        roas: safeDiv(revenue, spend),
        cpa: safeDiv(spend, purchases),
        ctr: safeDiv(weightedCtrNumerator, spend),
        cvr: safeDiv(weightedCvrNumerator, spend),
        share: safeDiv(spend, totalSpend),
      };
    })
    .filter((row) => row.spend > 0 || row.campaigns > 0);
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


type ChartKpi = "spend" | "revenue" | "roas" | "cpa" | "purchases" | "ctr" | "cvr";

type ChartDimension = "All Account" | Segment;

const CHART_KPIS: { key: ChartKpi; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "revenue", label: "Revenue" },
  { key: "roas", label: "ROAS" },
  { key: "cpa", label: "CPA" },
  { key: "purchases", label: "Purchases" },
  { key: "ctr", label: "CTR" },
  { key: "cvr", label: "CVR" },
];

const CHART_KPI_COLORS: Record<ChartKpi, string> = {
  spend: "#4285F4",
  revenue: "#34A853",
  roas: "#FBBC04",
  cpa: "#EA4335",
  purchases: "#8B5CF6",
  ctr: "#06B6D4",
  cvr: "#F97316",
};

function formatChartValue(value: number, kpi: ChartKpi) {
  if (kpi === "spend" || kpi === "revenue" || kpi === "cpa") return compactMoney(value);
  if (kpi === "roas") return x(value);
  if (kpi === "ctr" || kpi === "cvr") return pct(value);
  return value.toFixed(0);
}

function getKpiValue(row: ReturnType<typeof aggregate>, kpi: ChartKpi) {
  if (kpi === "spend") return row.spend;
  if (kpi === "revenue") return row.revenue;
  if (kpi === "roas") return row.roas;
  if (kpi === "cpa") return row.cpa;
  if (kpi === "purchases") return row.purchases;
  if (kpi === "ctr") return row.ctr;
  if (kpi === "cvr") return row.cvr;
  return 0;
}

function buildChartRows(rows: GoogleOsRow[], periodMode: PeriodMode, dimension: ChartDimension) {
  const grouped = new Map<string, GoogleOsRow[]>();

  rows
    .filter((row) => {
      if (dimension === "All Account") return true;
      return getSegment(row) === dimension;
    })
    .forEach((row) => {
      const key = getPeriodKey(row, periodMode);
      if (!key) return;

      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

  const limit = periodMode === "daily" ? 30 : periodMode === "weekly" ? 12 : 12;

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([period, periodRows]) => {
      const a = aggregate(periodRows);

      return {
        period,
        label: getPeriodLabel(period, periodMode),
        spend: a.spend,
        revenue: a.revenue,
        roas: a.roas,
        cpa: a.cpa,
        purchases: a.purchases,
        ctr: a.ctr,
        cvr: a.cvr,
      };
    });
}



type ChartRow = ReturnType<typeof buildChartRows>[number];

function getChartRowMetric(row: ChartRow, kpi: ChartKpi): number {
  if (kpi === "spend") return row.spend;
  if (kpi === "revenue") return row.revenue;
  if (kpi === "roas") return row.roas;
  if (kpi === "cpa") return row.cpa;
  if (kpi === "purchases") return row.purchases;
  if (kpi === "ctr") return row.ctr;
  if (kpi === "cvr") return row.cvr;

  return 0;
}

function CampaignKpiChart({
  rows,
  dimension,
  kpis,
  periodMode,
}: {
  rows: ReturnType<typeof buildChartRows>;
  dimension: ChartDimension;
  kpis: ChartKpi[];
  periodMode: PeriodMode;
}) {
  const width = 1080;
  const height = 320;
  const padLeft = 62;
  const padRight = 30;
  const padTop = 26;
  const padBottom = 58;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const activeKpis: ChartKpi[] = kpis.length ? kpis : ["spend"];

  const values = rows.flatMap((row) => activeKpis.map((kpi) => getChartRowMetric(row, kpi)));
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = minValue + range * (1 - ratio);
    const y = padTop + chartHeight * ratio;
    return { value, y };
  });

  function getShortXAxisLabel(label: string) {
    const clean = label.replace("Week of ", "");

    if (periodMode === "daily") {
      const parts = clean.split("-");
      if (parts.length === 3) return `${parts[0]}-${parts[1]}`;
      return clean;
    }

    return clean;
  }

  function shouldShowXAxisLabel(index: number) {
    if (rows.length <= 8) return true;
    if (index === 0 || index === rows.length - 1) return true;

    if (periodMode === "daily") return index % Math.ceil(rows.length / 6) === 0;
    if (periodMode === "weekly") return index % Math.ceil(rows.length / 8) === 0;

    return true;
  }

  function getPoint(row: ReturnType<typeof buildChartRows>[number], index: number, kpi: ChartKpi) {
    const value = getChartRowMetric(row, kpi);

    const x =
      rows.length === 1
        ? padLeft + chartWidth / 2
        : padLeft + (index / (rows.length - 1)) * chartWidth;

    const y = padTop + chartHeight - ((value - minValue) / range) * chartHeight;

    return {
      x,
      y,
      value,
    };
  }

  const primaryKpi = activeKpis[0];
  const primaryLabel = CHART_KPIS.find((item) => item.key === primaryKpi)?.label || "Metric";

  return (
    <div className="gos-axis-chart-box">
      <div className="gos-axis-chart-head">
        <div>
          <span>Axis Chart</span>
          <strong>{dimension} · {activeKpis.map((kpi) => CHART_KPIS.find((item) => item.key === kpi)?.label).join(" + ")}</strong>
          <small>
            X-axis = {periodMode}. Multiple key metrics can be compared together.
          </small>
        </div>

        <div className="gos-axis-chart-legend multi">
          {activeKpis.map((kpi) => (
            <span key={kpi}>
              <i style={{ background: CHART_KPI_COLORS[kpi] }} />
              {CHART_KPIS.find((item) => item.key === kpi)?.label}
            </span>
          ))}
        </div>
      </div>

      {rows.length ? (
        <div className="gos-axis-chart-wrap">
          <svg
            className="gos-axis-chart-svg"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${dimension} multi metric trend`}
          >
            {yTicks.map((tick, index) => (
              <g key={index}>
                <line
                  x1={padLeft}
                  y1={tick.y}
                  x2={width - padRight}
                  y2={tick.y}
                  className="gos-axis-chart-grid"
                />
                <text
                  x={padLeft - 12}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="gos-axis-chart-text"
                >
                  {formatChartValue(tick.value, primaryKpi)}
                </text>
              </g>
            ))}

            <line
              x1={padLeft}
              y1={padTop}
              x2={padLeft}
              y2={padTop + chartHeight}
              className="gos-axis-chart-axis"
            />

            <line
              x1={padLeft}
              y1={padTop + chartHeight}
              x2={width - padRight}
              y2={padTop + chartHeight}
              className="gos-axis-chart-axis"
            />

            {activeKpis.map((kpi) => {
              const points = rows.map((row, index) => getPoint(row, index, kpi));
              const line = points.map((point) => `${point.x},${point.y}`).join(" ");

              return (
                <g key={kpi}>
                  <polyline
                    points={line}
                    className="gos-axis-chart-line"
                    style={{ stroke: CHART_KPI_COLORS[kpi] }}
                  />

                  {points.map((point, index) => {
                    const row = rows[index];
                    const kpiLabel = CHART_KPIS.find((item) => item.key === kpi)?.label || kpi;

                    return (
                      <g key={`${kpi}-${row.period}`} className="gos-axis-chart-point">
                        <circle cx={point.x} cy={point.y} r="4.3" style={{ fill: CHART_KPI_COLORS[kpi] }} />
                        <title>{`${row.label}
${kpiLabel}: ${formatChartValue(point.value, kpi)}
Spend: ${compactMoney(row.spend)}
Revenue: ${compactMoney(row.revenue)}
ROAS: ${x(row.roas)}
CPA: ${compactMoney(row.cpa)}
Purchases: ${row.purchases.toFixed(0)}
CTR: ${pct(row.ctr)}
CVR: ${pct(row.cvr)}`}</title>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {rows.map((row, index) => {
              const point = getPoint(row, index, primaryKpi);

              return shouldShowXAxisLabel(index) ? (
                <text
                  key={row.period}
                  x={point.x}
                  y={height - 20}
                  textAnchor="middle"
                  className="gos-axis-chart-text x"
                >
                  {getShortXAxisLabel(row.label)}
                </text>
              ) : null;
            })}

            <text
              x={padLeft + chartWidth / 2}
              y={height - 5}
              textAnchor="middle"
              className="gos-axis-chart-caption"
            >
              {periodMode.toUpperCase()}
            </text>

            <text
              x="14"
              y={padTop + chartHeight / 2}
              textAnchor="middle"
              className="gos-axis-chart-caption"
              transform={`rotate(-90 14 ${padTop + chartHeight / 2})`}
            >
              {primaryLabel.toUpperCase()}
            </text>
          </svg>
        </div>
      ) : (
        <div className="gos-dynamic-chart-empty">No chart data available for this selection.</div>
      )}
    </div>
  );
}


export function CampaignsTab({ model }: { model: GoogleOsModel }) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const [chartDimension, setChartDimension] = useState<ChartDimension>("All Account");
  const [chartKpis, setChartKpis] = useState<ChartKpi[]>(["spend"]);
  const [chartPeriodMode, setChartPeriodMode] = useState<PeriodMode>("daily");
  const periods = useMemo(() => getAvailablePeriods(model.rows, periodMode), [model.rows, periodMode]);
  const latestPeriod = periods[periods.length - 1] || "";
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [openBrandGroups, setOpenBrandGroups] = useState<Record<string, boolean>>({
    Brand: true,
    "Non Brand": true,
  });

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
  const brandSummaryRows = useMemo(() => buildBrandSummaryRows(segmentRows), [segmentRows]);

  const availableChartDimensions = useMemo(() => {
    return ["All Account", ...segmentRows.map((row) => row.segment)] as ChartDimension[];
  }, [segmentRows]);

  const activeChartDimension = availableChartDimensions.includes(chartDimension)
    ? chartDimension
    : "All Account";

  const chartRows = useMemo(() => {
    return buildChartRows(model.rows, chartPeriodMode, activeChartDimension);
  }, [model.rows, chartPeriodMode, activeChartDimension]);

  const totals = useMemo(() => aggregate(periodRows), [periodRows]);

  function toggleChartKpi(kpi: ChartKpi) {
    setChartKpis((current) => {
      if (current.includes(kpi)) {
        const next = current.filter((item) => item !== kpi);
        return next.length ? next : ["spend"];
      }

      return [...current, kpi];
    });
  }

  function toggleBrandGroup(group: BrandGroup) {
    setOpenBrandGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  }

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


        <div className="gos-dynamic-chart-panel">
          <div className="gos-chart-control-row">
            <div>
              <span>Dimension</span>
              <div className="gos-chart-button-group">
                {availableChartDimensions.map((dimension) => (
                  <button
                    key={dimension}
                    type="button"
                    className={activeChartDimension === dimension ? "active" : ""}
                    onClick={() => setChartDimension(dimension)}
                  >
                    {dimension}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span>Key Metric</span>
              <div className="gos-chart-button-group">
                {CHART_KPIS.map((kpiItem) => (
                  <button
                    key={kpiItem.key}
                    type="button"
                    className={chartKpis.includes(kpiItem.key) ? "active" : ""}
                    onClick={() => toggleChartKpi(kpiItem.key)}
                  >
                    {kpiItem.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span>Time Grain</span>
              <div className="gos-chart-button-group">
                {(["daily", "weekly", "monthly"] as PeriodMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={chartPeriodMode === mode ? "active" : ""}
                    onClick={() => setChartPeriodMode(mode)}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <CampaignKpiChart
            rows={chartRows}
            dimension={activeChartDimension}
            kpis={chartKpis}
            periodMode={chartPeriodMode}
          />
        </div>


        <div className="gos-brand-summary-table">
          <div className="gos-brand-summary-title">
            <span>Brand vs Non Brand</span>
            <strong>Spend split summary</strong>
            <small>Click Brand or Non Brand to view Search and Shopping split under it.</small>
          </div>

          <div className="gos-brand-table-header">
            <span className="brand-col-main">Group</span>
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

          {brandSummaryRows.map((groupRow) => {
            const isOpen = Boolean(openBrandGroups[groupRow.group]);

            return (
              <div key={groupRow.group} className="gos-brand-group">
                <button
                  type="button"
                  className="gos-brand-parent-row"
                  onClick={() => toggleBrandGroup(groupRow.group)}
                >
                  <span className="brand-col-main brand-parent-name">
                    <b>{isOpen ? "−" : "+"}</b>
                    <strong>{groupRow.group}</strong>
                  </span>

                  <span>{groupRow.campaigns}</span>
                  <span className="red">{compactMoney(groupRow.spend)}</span>
                  <span>{pct(groupRow.share)}</span>
                  <span className="green">{compactMoney(groupRow.revenue)}</span>
                  <span className={roasClass(groupRow.roas)}>{x(groupRow.roas)}</span>
                  <span>{groupRow.purchases.toFixed(0)}</span>
                  <span>{compactMoney(groupRow.cpa)}</span>
                  <span>{pct(groupRow.ctr)}</span>
                  <span>{pct(groupRow.cvr)}</span>
                </button>

                {isOpen ? (
                  <div className="gos-brand-child-table">
                    {groupRow.rows.map((segmentRow) => (
                      <div key={segmentRow.segment} className="gos-brand-child-row">
                        <span className="brand-col-main brand-child-name">
                          <i style={{ background: SEGMENT_COLORS[segmentRow.segment] }} />
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
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
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
