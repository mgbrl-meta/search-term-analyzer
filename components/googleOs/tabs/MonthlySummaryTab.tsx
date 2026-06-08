"use client";

import { useMemo, useState } from "react";
import type { GoogleOsModel, GoogleOsRow } from "../../../lib/googleOs/types";
import { compactInt, compactMoney, money, pct, safeDiv, x } from "../../../lib/googleOs/format";
import { GoogleOsKpi } from "../shared/GoogleOsKpi";
import { GoogleOsTable } from "../shared/GoogleOsTable";

type MonthlyRow = {
  month: string;
  days: number;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpc: number;
  costPerImpression: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  cvr: number;
  aov: number;
  incrementalSpend: number;
  incrementalSpendPct: number;
  incrementalRevenue: number;
  incrementalRevenuePct: number;
  incrementalPurchases: number;
  incrementalPurchasesPct: number;
  incrementalCpa: number;
  incrementalCpaPct: number;
  marginalRoas: number;
};

type WeeklyRow = {
  week: string;
  month: string;
  cost: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cvr: number;
};

const MONTH_COLORS = [
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#e11d48",
  "#0f766e",
  "#7c3aed",
  "#65a30d",
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#eab308",
  "#14b8a6",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
];

function monthKey(date: string) {
  if (!date) return "Unknown";
  return date.slice(0, 7);
}

function parseDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function weekKey(date: string) {
  const d = parseDate(date);
  const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = temp.getUTCDay() || 7;

  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function changePct(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous && current) return 100;
  return ((current - previous) / previous) * 100;
}

function formatLakhs(value: number) {
  const abs = Math.abs(value);

  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${Math.round(value / 1000)}K`;

  return money(value);
}

function buildMonthlyRows(rows: GoogleOsRow[]): MonthlyRow[] {
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    const key = monthKey(row.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  const monthly = Array.from(groups.entries())
    .map(([month, monthRows]) => {
      const days = new Set(monthRows.map((row) => row.date)).size;
      const cost = monthRows.reduce((sum, row) => sum + row.cost, 0);
      const impressions = monthRows.reduce((sum, row) => sum + row.impressions, 0);
      const clicks = monthRows.reduce((sum, row) => sum + row.clicks, 0);
      const purchases = monthRows.reduce((sum, row) => sum + row.conversions, 0);
      const revenue = monthRows.reduce((sum, row) => sum + row.conversionValue, 0);

      return {
        month,
        days,
        cost,
        impressions,
        clicks,
        ctr: safeDiv(clicks, impressions),
        avgCpc: safeDiv(cost, clicks),
        costPerImpression: safeDiv(cost, impressions),
        purchases,
        revenue,
        roas: safeDiv(revenue, cost),
        cpa: safeDiv(cost, purchases),
        cvr: safeDiv(purchases, clicks),
        aov: safeDiv(revenue, purchases),
        incrementalSpend: 0,
        incrementalSpendPct: 0,
        incrementalRevenue: 0,
        incrementalRevenuePct: 0,
        incrementalPurchases: 0,
        incrementalPurchasesPct: 0,
        incrementalCpa: 0,
        incrementalCpaPct: 0,
        marginalRoas: 0,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  return monthly.map((row, index) => {
    const previous = monthly[index - 1];
    if (!previous) return row;

    const incrementalSpend = row.cost - previous.cost;
    const incrementalRevenue = row.revenue - previous.revenue;
    const incrementalPurchases = row.purchases - previous.purchases;
    const incrementalCpa = row.cpa - previous.cpa;

    return {
      ...row,
      incrementalSpend,
      incrementalSpendPct: changePct(row.cost, previous.cost),
      incrementalRevenue,
      incrementalRevenuePct: changePct(row.revenue, previous.revenue),
      incrementalPurchases,
      incrementalPurchasesPct: changePct(row.purchases, previous.purchases),
      incrementalCpa,
      incrementalCpaPct: changePct(row.cpa, previous.cpa),
      marginalRoas: incrementalSpend !== 0 ? incrementalRevenue / incrementalSpend : 0,
    };
  });
}

function buildWeeklyRows(rows: GoogleOsRow[]): WeeklyRow[] {
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    const key = weekKey(row.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries())
    .map(([week, weekRows]) => {
      const cost = weekRows.reduce((sum, row) => sum + row.cost, 0);
      const impressions = weekRows.reduce((sum, row) => sum + row.impressions, 0);
      const clicks = weekRows.reduce((sum, row) => sum + row.clicks, 0);
      const purchases = weekRows.reduce((sum, row) => sum + row.conversions, 0);
      const revenue = weekRows.reduce((sum, row) => sum + row.conversionValue, 0);
      const firstDate = weekRows.slice().sort((a, b) => a.date.localeCompare(b.date))[0]?.date || "";

      return {
        week,
        month: monthKey(firstDate),
        cost,
        impressions,
        clicks,
        purchases,
        revenue,
        roas: safeDiv(revenue, cost),
        cpa: safeDiv(cost, purchases),
        ctr: safeDiv(clicks, impressions),
        cvr: safeDiv(purchases, clicks),
      };
    })
    .filter((row) => row.cost > 0)
    .sort((a, b) => a.week.localeCompare(b.week));
}

function getMonthColor(month: string, months: string[]) {
  const index = months.indexOf(month);
  return MONTH_COLORS[index % MONTH_COLORS.length];
}

function ScatterChart({
  rows,
  months,
  selectedMonth,
}: {
  rows: WeeklyRow[];
  months: string[];
  selectedMonth: string;
}) {
  const filtered = selectedMonth === "all" ? rows : rows.filter((row) => row.month === selectedMonth);
  const maxSpend = Math.max(...rows.map((row) => row.cost), 1);
  const maxCpa = Math.max(...rows.map((row) => row.cpa), 1);

  const width = 1120;
  const height = 340;
  const padding = { left: 62, right: 28, top: 22, bottom: 48 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  function xScale(value: number) {
    return padding.left + (value / maxSpend) * innerW;
  }

  function yScale(value: number) {
    return padding.top + innerH - (value / maxCpa) * innerH;
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => maxCpa * ratio);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => maxSpend * ratio);

  return (
    <div className="gos-chart-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} className="gos-svg-chart gos-responsive-svg" preserveAspectRatio="xMidYMid meet" role="img">
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              className="gos-grid-line"
            />
            <text x={8} y={yScale(tick) + 4} className="gos-chart-axis">
              {money(tick)}
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={padding.top}
              y2={height - padding.bottom}
              className="gos-grid-line vertical"
            />
            <text x={xScale(tick)} y={height - 16} className="gos-chart-axis" textAnchor="middle">
              {formatLakhs(tick)}
            </text>
          </g>
        ))}

        {filtered.map((row) => (
          <circle
            key={row.week}
            cx={xScale(row.cost)}
            cy={yScale(row.cpa)}
            r={5.2}
            fill={getMonthColor(row.month, months)}
            className="gos-dot"
          >
            <title>
              {`${row.week} · ${row.month}\nSpend: ${money(row.cost)}\nCPA: ${money(row.cpa)}\nPurchases: ${row.purchases.toFixed(2)}\nROAS: ${x(row.roas)}`}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function WeeklyTrendChart({
  rows,
  months,
  selectedMonth,
}: {
  rows: WeeklyRow[];
  months: string[];
  selectedMonth: string;
}) {
  const filtered = selectedMonth === "all" ? rows : rows.filter((row) => row.month === selectedMonth);
  const maxSpend = Math.max(...filtered.map((row) => row.cost), 1);
  const maxCpa = Math.max(...filtered.map((row) => row.cpa), 1);

  const width = Math.max(1120, filtered.length * 28 + 120);
  const height = 350;
  const padding = { left: 62, right: 64, top: 28, bottom: 52 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const barW = Math.max(8, innerW / Math.max(filtered.length, 1) - 5);

  function xScale(index: number) {
    return padding.left + index * (innerW / Math.max(filtered.length, 1)) + 2;
  }

  function spendY(value: number) {
    const minLog = Math.log10(1);
    const maxLog = Math.log10(maxSpend + 1);
    const valueLog = Math.log10(value + 1);
    return padding.top + innerH - ((valueLog - minLog) / Math.max(maxLog - minLog, 1)) * innerH;
  }

  function cpaY(value: number) {
    return padding.top + innerH - (value / maxCpa) * innerH;
  }

  const linePath = filtered
    .map((row, index) => `${index === 0 ? "M" : "L"} ${xScale(index) + barW / 2} ${cpaY(row.cpa)}`)
    .join(" ");

  return (
    <div className="gos-chart-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} className="gos-svg-chart gos-responsive-svg wide" preserveAspectRatio="xMidYMid meet" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const cpaTick = maxCpa * ratio;
          return (
            <g key={`cpa-${ratio}`}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={cpaY(cpaTick)}
                y2={cpaY(cpaTick)}
                className="gos-grid-line"
              />
              <text x={width - padding.right + 8} y={cpaY(cpaTick) + 4} className="gos-chart-axis">
                {money(cpaTick)}
              </text>
            </g>
          );
        })}

        {filtered.map((row, index) => {
          const y = spendY(row.cost);
          const h = height - padding.bottom - y;

          return (
            <rect
              key={row.week}
              x={xScale(index)}
              y={y}
              width={barW}
              height={h}
              rx={3}
              fill={getMonthColor(row.month, months)}
              opacity={0.95}
            >
              <title>
                {`${row.week} · ${row.month}\nSpend: ${money(row.cost)}\nCPA: ${money(row.cpa)}\nROAS: ${x(row.roas)}`}
              </title>
            </rect>
          );
        })}

        <path d={linePath} fill="none" stroke="#ef4444" strokeWidth={2.5} />

        {filtered.map((row, index) => (
          <circle
            key={`${row.week}-line`}
            cx={xScale(index) + barW / 2}
            cy={cpaY(row.cpa)}
            r={2.8}
            fill="#ef4444"
          />
        ))}

        {filtered[0] ? (
          <text x={padding.left} y={height - 18} className="gos-chart-axis">
            {filtered[0].month}
          </text>
        ) : null}

        {filtered[filtered.length - 1] ? (
          <text x={width - padding.right} y={height - 18} textAnchor="end" className="gos-chart-axis">
            {filtered[filtered.length - 1].month}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function MonthChips({
  months,
  selectedMonth,
  onSelect,
}: {
  months: string[];
  selectedMonth: string;
  onSelect: (month: string) => void;
}) {
  return (
    <div className="gos-month-chips">
      <button
        type="button"
        className={selectedMonth === "all" ? "active" : ""}
        onClick={() => onSelect("all")}
      >
        All Months
      </button>

      {months.map((month) => (
        <button
          key={month}
          type="button"
          className={selectedMonth === month ? "active" : ""}
          onClick={() => onSelect(month)}
        >
          <span style={{ background: getMonthColor(month, months) }} />
          {month}
        </button>
      ))}
    </div>
  );
}

function DeltaValue({
  value,
  type = "money",
}: {
  value: number;
  type?: "money" | "number" | "pct" | "x";
}) {
  const positive = value >= 0;
  let formatted = "";

  if (type === "money") formatted = compactMoney(value);
  if (type === "number") formatted = compactInt(value);
  if (type === "pct") formatted = `${value.toFixed(1)}%`;
  if (type === "x") formatted = x(value);

  return <strong className={positive ? "gos-pos" : "gos-neg"}>{formatted}</strong>;
}

export function MonthlySummaryTab({ model }: { model: GoogleOsModel }) {
  const [selectedMonth, setSelectedMonth] = useState("all");

  const monthlyRows = useMemo(() => buildMonthlyRows(model.rows), [model.rows]);
  const weeklyRows = useMemo(() => buildWeeklyRows(model.rows), [model.rows]);
  const months = useMemo(() => Array.from(new Set(weeklyRows.map((row) => row.month))).sort(), [weeklyRows]);

  const latest = monthlyRows[monthlyRows.length - 1];
  const previous = monthlyRows[monthlyRows.length - 2];

  return (
    <section className="gos-page monthly-summary-page">
      <div className="gos-hero">
        <div>
          <span>Monthly Summary</span>
          <h1>Scale efficiency over time</h1>
          <p>
            Monthly MoM table, weekly spend-vs-CPA scatter, and lifetime weekly trend based on all connected Google Ads data.
          </p>
        </div>
      </div>

      {latest ? (
        <div className="gos-kpi-grid">
          <GoogleOsKpi label="Latest Month" value={latest.month} />
          <GoogleOsKpi label="Spend" value={compactMoney(latest.cost)} tone="red" />
          <GoogleOsKpi label="Revenue" value={compactMoney(latest.revenue)} tone="green" />
          <GoogleOsKpi label="ROAS" value={x(latest.roas)} tone={latest.roas >= 3 ? "green" : latest.roas < 1 ? "red" : "amber"} />
          <GoogleOsKpi label="Purchases" value={latest.purchases.toFixed(2)} />
          <GoogleOsKpi label="CPA" value={compactMoney(latest.cpa)} />
          <GoogleOsKpi label="Incremental Spend" value={<DeltaValue value={latest.incrementalSpend} />} />
          <GoogleOsKpi label="Marginal ROAS" value={<DeltaValue value={latest.marginalRoas} type="x" />} />
        </div>
      ) : null}

      {latest && previous ? (
        <div className="gos-insight-grid">
          <div className="gos-insight-card">
            <span>Incremental Revenue</span>
            <p>
              {latest.month} generated <b>{money(latest.incrementalRevenue)}</b> incremental revenue versus {previous.month}.
            </p>
          </div>

          <div className="gos-insight-card">
            <span>Incremental Spend</span>
            <p>
              Spend changed by <b>{money(latest.incrementalSpend)}</b>, a {latest.incrementalSpendPct.toFixed(1)}% movement versus previous month.
            </p>
          </div>

          <div className="gos-insight-card">
            <span>Marginal Efficiency</span>
            <p>
              Marginal ROAS is <b>{x(latest.marginalRoas)}</b>. Incremental CPA moved by <b>{money(latest.incrementalCpa)}</b>.
            </p>
          </div>
        </div>
      ) : null}

      <div className="gos-panel monthly-table-panel">
        <div className="gos-panel-head">
          <div>
            <span>Monthly MoM Table</span>
            <h2>Month-level performance and incremental economics</h2>
            <p>
              Includes incremental spend, incremental revenue, incremental purchases, incremental CPA, and marginal ROAS.
            </p>
          </div>
        </div>

        <GoogleOsTable
          className="monthly-wide-table"
          rows={monthlyRows.slice().reverse() as unknown as Record<string, unknown>[]}
          columns={[
            { key: "month", label: "Month" },
            { key: "cost", label: "Spend", right: true, render: (row) => compactMoney(row.cost) },
            { key: "impressions", label: "Impr.", right: true, render: (row) => compactInt(row.impressions) },
            { key: "clicks", label: "Clicks", right: true, render: (row) => compactInt(row.clicks) },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "costPerImpression", label: "CPI", right: true, render: (row) => compactMoney(row.costPerImpression) },
            { key: "purchases", label: "Purchases", right: true, render: (row) => compactInt(row.purchases) },
            { key: "revenue", label: "Revenue", right: true, render: (row) => compactMoney(row.revenue) },
            { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
            { key: "cpa", label: "CPA", right: true, render: (row) => compactMoney(row.cpa) },
            { key: "cvr", label: "CVR", right: true, render: (row) => pct(row.cvr) },
            { key: "incrementalSpend", label: "Inc Spend", right: true, render: (row) => <DeltaValue value={Number(row.incrementalSpend || 0)} /> },
            { key: "incrementalSpendPct", label: "Inc Spend %", right: true, render: (row) => <DeltaValue value={Number(row.incrementalSpendPct || 0)} type="pct" /> },
            { key: "incrementalRevenue", label: "Inc Rev", right: true, render: (row) => <DeltaValue value={Number(row.incrementalRevenue || 0)} /> },
            { key: "incrementalPurchases", label: "Inc Purch", right: true, render: (row) => <DeltaValue value={Number(row.incrementalPurchases || 0)} type="number" /> },
            { key: "incrementalCpa", label: "Inc CPA", right: true, render: (row) => <DeltaValue value={Number(row.incrementalCpa || 0)} /> },
            { key: "incrementalCpaPct", label: "Inc CPA %", right: true, render: (row) => <DeltaValue value={Number(row.incrementalCpaPct || 0)} type="pct" /> },
            { key: "marginalRoas", label: "Marg ROAS", right: true, render: (row) => <DeltaValue value={Number(row.marginalRoas || 0)} type="x" /> },
          ]}
          empty="No monthly data available."
        />
      </div>

      <div className="gos-panel chart-panel">
        <div className="gos-panel-head">
          <div>
            <span>Weekly Scale Efficiency</span>
            <h2>Weekly Spend vs Weekly CPA Scatter</h2>
            <p>
              Each dot is one week. X-axis shows weekly spend, Y-axis shows weekly CPA. Dot color changes by month.
            </p>
          </div>
          <strong className="gos-chart-note">X: Weekly Spend · Y: Weekly CPA · Dot: Week</strong>
        </div>

        <ScatterChart rows={weeklyRows} months={months} selectedMonth={selectedMonth} />
        <MonthChips months={months} selectedMonth={selectedMonth} onSelect={setSelectedMonth} />
      </div>

      <div className="gos-panel chart-panel">
        <div className="gos-panel-head">
          <div>
            <span>Lifetime Weekly Trend</span>
            <h2>Weekly Spend vs CPA</h2>
            <p>
              Spend is shown as weekly bars on a log scale. CPA is shown as a line. Bar color changes by month.
            </p>
          </div>
          <strong className="gos-chart-note">Bar: Spend · Line: CPA · Color: Month</strong>
        </div>

        <WeeklyTrendChart rows={weeklyRows} months={months} selectedMonth={selectedMonth} />
        <MonthChips months={months} selectedMonth={selectedMonth} onSelect={setSelectedMonth} />
      </div>
    </section>
  );
}
