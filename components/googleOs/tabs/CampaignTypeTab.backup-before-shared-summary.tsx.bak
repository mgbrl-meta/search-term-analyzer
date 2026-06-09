"use client";

import { useMemo, useState } from "react";
import type { GoogleOsModel, GoogleOsRow, GoogleOsStatus } from "../../../lib/googleOs/types";
import { compactMoney, pct, safeDiv, x } from "../../../lib/googleOs/format";
import { GoogleOsTable } from "../shared/GoogleOsTable";
import { formatGoogleOsMonthLabel } from "../../../lib/googleOs/dateFilter";

type CampaignTypeName = "Search" | "Shopping" | "Demand Gen" | "Video";

type ViewMode = "latest_month" | "month_compare" | "quarter";

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
  rawRows: GoogleOsRow[];
};

type AdGroupRow = {
  key: string;
  adGroup: string;
  adGroupStatus: string;
  cost: number;
  conversionValue: number;
  roas: number;
  conversions: number;
  cpa: number;
  ctr: number;
  cvr: number;
  avgCpc: number;
};

function getCampaignType(row: GoogleOsRow) {
  const raw = String(row.campaignType || row.campaign || "").trim().toLowerCase();

  if (raw.includes("search")) return "Search";
  if (raw.includes("shopping")) return "Shopping";
  if (raw.includes("demand")) return "Demand Gen";
  if (raw.includes("video")) return "Video";

  return "Other";
}

function getAvailableMonths(rows: GoogleOsRow[]) {
  return Array.from(
    new Set(rows.map((row) => row.date?.slice(0, 7)).filter(Boolean))
  ).sort();
}

function getAvailableQuarters(rows: GoogleOsRow[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => {
          if (!row.date) return "";
          const [year, month] = row.date.slice(0, 7).split("-");
          return `${year}-Q${Math.ceil(Number(month) / 3)}`;
        })
        .filter(Boolean)
    )
  ).sort();
}

function rowQuarter(row: GoogleOsRow) {
  const [year, month] = row.date.slice(0, 7).split("-");
  return `${year}-Q${Math.ceil(Number(month) / 3)}`;
}

function filterRowsByMonth(rows: GoogleOsRow[], month: string) {
  if (!month) return [];
  return rows.filter((row) => row.date.startsWith(month));
}

function filterRowsByQuarter(rows: GoogleOsRow[], quarter: string) {
  if (!quarter) return [];
  return rows.filter((row) => rowQuarter(row) === quarter);
}

function pctDelta(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous && current) return 100;
  return ((current - previous) / previous) * 100;
}

function decide(row: Omit<CampaignRow, "status" | "action" | "reason" | "rawRows">): Pick<CampaignRow, "status" | "action" | "reason"> {
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

function buildCampaignRows(rows: GoogleOsRow[], type: CampaignTypeName) {
  const filteredRows = rows.filter((row) => getCampaignType(row) === type);
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
      const cost = groupRows.reduce((sum, row) => sum + row.cost, 0);
      const conversionValue = groupRows.reduce((sum, row) => sum + row.conversionValue, 0);
      const impressions = groupRows.reduce((sum, row) => sum + row.impressions, 0);
      const clicks = groupRows.reduce((sum, row) => sum + row.clicks, 0);
      const conversions = groupRows.reduce((sum, row) => sum + row.conversions, 0);
      const first = groupRows[0];

      const base = {
        key,
        label: first.campaign,
        campaignType: type,
        campaignStatus: first.campaignStatus || "-",
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
        rawRows: groupRows,
      };
    })
    .sort((a, b) => b.cost - a.cost);
}

function buildAdGroupRows(rows: GoogleOsRow[]) {
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    const key = row.adGroupId || row.adGroup || "Unknown";
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

      return {
        key,
        adGroup: first.adGroup || "Unknown",
        adGroupStatus: first.adGroupStatus || "-",
        cost,
        conversionValue,
        roas: safeDiv(conversionValue, cost),
        conversions,
        cpa: safeDiv(cost, conversions),
        ctr: safeDiv(clicks, impressions),
        cvr: safeDiv(conversions, clicks),
        avgCpc: safeDiv(cost, clicks),
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
  return goodWhenPositive ? (value > 0 ? "green" : "red") : value > 0 ? "red" : "green";
}

function statusTone(status: unknown) {
  const s = String(status || "");
  if (s === "SCALE" || s === "KEEP") return "green";
  if (s === "PAUSE" || s === "REDUCE") return "red";
  if (s === "WATCH") return "amber";
  return "neutral";
}

function TypeIcon({ type }: { type: CampaignTypeName }) {
  const cls =
    type === "Search"
      ? "search"
      : type === "Shopping"
        ? "shopping"
        : type === "Demand Gen"
          ? "demand"
          : "video";

  return <span className={`campaign-type-icon ${cls}`} />;
}


function getMaxDateFromRows(rows: GoogleOsRow[]) {
  return Array.from(new Set(rows.map((row) => row.date).filter(Boolean))).sort().at(-1) || "";
}

function getLast7RowsFromRows(rows: GoogleOsRow[]) {
  const maxDate = getMaxDateFromRows(rows);
  if (!maxDate) return [];

  const end = new Date(`${maxDate}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return rows.filter((row) => {
    const d = new Date(`${row.date}T00:00:00`);
    return d >= start && d <= end;
  });
}

function aggregateTypeRows(rows: GoogleOsRow[], type: CampaignTypeName) {
  const filteredRows = rows.filter((row) => getCampaignType(row) === type);
  const cost = filteredRows.reduce((sum, row) => sum + row.cost, 0);
  const conversionValue = filteredRows.reduce((sum, row) => sum + row.conversionValue, 0);
  const conversions = filteredRows.reduce((sum, row) => sum + row.conversions, 0);
  const impressions = filteredRows.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = filteredRows.reduce((sum, row) => sum + row.clicks, 0);

  return {
    cost,
    conversionValue,
    conversions,
    roas: safeDiv(conversionValue, cost),
    cpa: safeDiv(cost, conversions),
    ctr: safeDiv(clicks, impressions),
    cvr: safeDiv(conversions, clicks),
  };
}


export function CampaignTypeTab({
  model,
  type,
}: {
  model: GoogleOsModel;
  type: CampaignTypeName;
}) {
  const months = useMemo(() => getAvailableMonths(model.rows), [model.rows]);
  const quarters = useMemo(() => getAvailableQuarters(model.rows), [model.rows]);

  const latestMonth = months[months.length - 1] || "";
  const previousMonth = months[months.length - 2] || "";
  const latestQuarter = quarters[quarters.length - 1] || "";

  const [viewMode, setViewMode] = useState<ViewMode>("latest_month");
  const [selectedMonth, setSelectedMonth] = useState(latestMonth);
  const [compareMonth, setCompareMonth] = useState(previousMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(latestQuarter);
  const [openCampaign, setOpenCampaign] = useState("");

  const activeMonth = selectedMonth || latestMonth;
  const activeCompareMonth = compareMonth || previousMonth;
  const activeQuarter = selectedQuarter || latestQuarter;

  const selectedRows = useMemo(() => {
    if (viewMode === "quarter") return filterRowsByQuarter(model.rows, activeQuarter);
    return filterRowsByMonth(model.rows, activeMonth);
  }, [model.rows, viewMode, activeMonth, activeQuarter]);

  const compareRows = useMemo(() => {
    if (viewMode !== "month_compare") return [];
    return filterRowsByMonth(model.rows, activeCompareMonth);
  }, [model.rows, viewMode, activeCompareMonth]);

  const campaignRows = useMemo(() => buildCampaignRows(selectedRows, type), [selectedRows, type]);
  const compareCampaignRows = useMemo(() => buildCampaignRows(compareRows, type), [compareRows, type]);

  const last7Metrics = useMemo(() => {
    return aggregateTypeRows(getLast7RowsFromRows(model.rows), type);
  }, [model.rows, type]);

  const allTimeMetrics = useMemo(() => {
    return aggregateTypeRows(model.rows, type);
  }, [model.rows, type]);

  const compareMap = useMemo(() => {
    const map = new Map<string, CampaignRow>();
    compareCampaignRows.forEach((row) => map.set(row.key, row));
    return map;
  }, [compareCampaignRows]);

  const tableRows = useMemo(() => {
    return campaignRows.map((row) => {
      const prev = compareMap.get(row.key);

      return {
        ...row,
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
  }, [campaignRows, compareMap]);

  const totalSpend = tableRows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const totalRevenue = tableRows.reduce((sum, row) => sum + Number(row.conversionValue || 0), 0);
  const totalPurchases = tableRows.reduce((sum, row) => sum + Number(row.conversions || 0), 0);

  const title =
    viewMode === "quarter"
      ? activeQuarter
      : viewMode === "month_compare"
        ? `${formatGoogleOsMonthLabel(activeMonth)} vs ${formatGoogleOsMonthLabel(activeCompareMonth)}`
        : formatGoogleOsMonthLabel(activeMonth);

  return (
    <section className="gos-page campaign-type-main-tab">
      <div className="gos-panel">
        <div className="gos-panel-head campaign-filter-head">
          <div>
            <span>{type}</span>
            <h2>{type} campaign performance</h2>
            <p>
              Showing {title}. Click any campaign to open ad groups inside it.
            </p>
          </div>

          <div className="campaign-filter-bar">
            <label>
              View
              <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}>
                <option value="latest_month">Latest Month</option>
                <option value="month_compare">Compare Months</option>
                <option value="quarter">Quarter View</option>
              </select>
            </label>

            {viewMode !== "quarter" ? (
              <label>
                Month
                <select value={activeMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                  {months.slice().reverse().map((month) => (
                    <option key={month} value={month}>
                      {formatGoogleOsMonthLabel(month)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {viewMode === "month_compare" ? (
              <label>
                Compare
                <select value={activeCompareMonth} onChange={(event) => setCompareMonth(event.target.value)}>
                  {months.slice().reverse().map((month) => (
                    <option key={month} value={month}>
                      {formatGoogleOsMonthLabel(month)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {viewMode === "quarter" ? (
              <label>
                Quarter
                <select value={activeQuarter} onChange={(event) => setSelectedQuarter(event.target.value)}>
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

        <div className="campaign-type-summary-strip benchmark">
          <div>
            <TypeIcon type={type} />
            <span>Campaigns</span>
            <strong>{tableRows.length}</strong>
          </div>
          <div>
            <span>Selected Spend</span>
            <strong className="red">{compactMoney(totalSpend)}</strong>
          </div>
          <div>
            <span>Selected ROAS</span>
            <strong className={roasTone(safeDiv(totalRevenue, totalSpend))}>{x(safeDiv(totalRevenue, totalSpend))}</strong>
          </div>
          <div>
            <span>Purchases</span>
            <strong>{totalPurchases.toFixed(0)}</strong>
          </div>
          <div>
            <span>CPA</span>
            <strong>{compactMoney(safeDiv(totalSpend, totalPurchases))}</strong>
          </div>
          <div>
            <span>Last 7D Spend</span>
            <strong className="red">{compactMoney(last7Metrics.cost)}</strong>
          </div>
          <div>
            <span>Last 7D ROAS</span>
            <strong className={roasTone(last7Metrics.roas)}>{x(last7Metrics.roas)}</strong>
          </div>
          <div>
            <span>All Time Spend</span>
            <strong className="red">{compactMoney(allTimeMetrics.cost)}</strong>
          </div>
          <div>
            <span>All Time ROAS</span>
            <strong className={roasTone(allTimeMetrics.roas)}>{x(allTimeMetrics.roas)}</strong>
          </div>
        </div>

        <div className="campaign-accordion">
          {tableRows.length ? (
            tableRows.map((row) => {
              const isOpen = openCampaign === row.key;
              const adGroups = buildAdGroupRows(row.rawRows);

              return (
                <div key={row.key} className={`campaign-accordion-item ${isOpen ? "open" : ""}`}>
                  <button
                    type="button"
                    className="campaign-accordion-row"
                    onClick={() => setOpenCampaign(isOpen ? "" : String(row.key))}
                  >
                    <span className="campaign-name">
                      <i>{isOpen ? "−" : "+"}</i>
                      <strong>{String(row.label)}</strong>
                      <small>{type} · {String(row.campaignStatus || "-")}</small>
                    </span>

                    <span><em>Spend</em><b className="red">{compactMoney(row.cost)}</b></span>
                    <span><em>Revenue</em><b className="green">{compactMoney(row.conversionValue)}</b></span>
                    <span><em>ROAS</em><b className={roasTone(Number(row.roas || 0))}>{x(row.roas)}</b></span>
                    <span><em>Purch.</em><b>{Number(row.conversions || 0).toFixed(0)}</b></span>
                    <span><em>CPA</em><b className={cpaTone(row)}>{compactMoney(row.cpa)}</b></span>
                    <span><em>Share</em><b>{pct(row.spendShare)}</b></span>
                    <span><em>Decision</em><b className={statusTone(row.status)}>{String(row.status)}</b></span>
                  </button>

                  {viewMode === "month_compare" ? (
                    <div className="campaign-delta-strip">
                      <span>Spend Δ <b className={deltaTone(Number(row.spendDelta || 0), false)}>{compactMoney(row.spendDelta)}</b></span>
                      <span>Spend Δ% <b className={deltaTone(Number(row.spendDeltaPct || 0), false)}>{Number(row.spendDeltaPct || 0).toFixed(1)}%</b></span>
                      <span>Revenue Δ <b className={deltaTone(Number(row.revenueDelta || 0), true)}>{compactMoney(row.revenueDelta)}</b></span>
                      <span>ROAS Δ <b className={deltaTone(Number(row.roasDelta || 0), true)}>{x(row.roasDelta)}</b></span>
                      <span>CPA Δ <b className={deltaTone(Number(row.cpaDelta || 0), false)}>{compactMoney(row.cpaDelta)}</b></span>
                    </div>
                  ) : null}

                  {isOpen ? (
                    <div className="campaign-adgroups-box">
                      <div className="campaign-adgroups-head">
                        <strong>Ad groups inside this campaign</strong>
                        <small>{adGroups.length} ad groups</small>
                      </div>

                      <GoogleOsTable
                        rows={adGroups as unknown as Record<string, unknown>[]}
                        columns={[
                          { key: "adGroup", label: "Ad Group" },
                          { key: "adGroupStatus", label: "Status" },
                          { key: "cost", label: "Spend", right: true, render: (r) => <Metric value={compactMoney(r.cost)} tone="red" /> },
                          { key: "conversionValue", label: "Revenue", right: true, render: (r) => <Metric value={compactMoney(r.conversionValue)} tone="green" /> },
                          { key: "roas", label: "ROAS", right: true, render: (r) => <Metric value={x(r.roas)} tone={roasTone(Number(r.roas || 0))} /> },
                          { key: "conversions", label: "Purch.", right: true, render: (r) => Number(r.conversions || 0).toFixed(0) },
                          { key: "cpa", label: "CPA", right: true, render: (r) => <Metric value={compactMoney(r.cpa)} tone={cpaTone(r)} /> },
                          { key: "ctr", label: "CTR", right: true, render: (r) => pct(r.ctr) },
                          { key: "cvr", label: "CVR", right: true, render: (r) => pct(r.cvr) },
                          { key: "avgCpc", label: "CPC", right: true, render: (r) => compactMoney(r.avgCpc) },
                        ]}
                        empty="No ad group data available."
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="campaign-empty-state">
              No {type} campaigns found for this selected period.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
