"use client";

import { useMemo } from "react";
import type { GoogleOsModel, GoogleOsRow } from "../../../lib/googleOs/types";
import { compactInt, compactMoney, money, pct, safeDiv, x } from "../../../lib/googleOs/format";
import { GoogleOsKpi } from "../shared/GoogleOsKpi";
import { GoogleOsTable } from "../shared/GoogleOsTable";

type DailyRow = {
  date: string;
  cost: number;
  revenue: number;
  impressions: number;
  clicks: number;
  purchases: number;
  ctr: number;
  cvr: number;
  cpa: number;
  roas: number;
  avgCpc: number;
};

function buildDailyRows(rows: GoogleOsRow[]): DailyRow[] {
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    if (!groups.has(row.date)) groups.set(row.date, []);
    groups.get(row.date)!.push(row);
  });

  return Array.from(groups.entries())
    .map(([date, dayRows]) => {
      const cost = dayRows.reduce((sum, row) => sum + row.cost, 0);
      const revenue = dayRows.reduce((sum, row) => sum + row.conversionValue, 0);
      const impressions = dayRows.reduce((sum, row) => sum + row.impressions, 0);
      const clicks = dayRows.reduce((sum, row) => sum + row.clicks, 0);
      const purchases = dayRows.reduce((sum, row) => sum + row.conversions, 0);

      return {
        date,
        cost,
        revenue,
        impressions,
        clicks,
        purchases,
        ctr: safeDiv(clicks, impressions),
        cvr: safeDiv(purchases, clicks),
        cpa: safeDiv(cost, purchases),
        roas: safeDiv(revenue, cost),
        avgCpc: safeDiv(cost, clicks),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function dateLabel(date: string) {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}`;
}

function maxOf(rows: DailyRow[], key: keyof DailyRow) {
  return Math.max(...rows.map((row) => Number(row[key]) || 0), 1);
}

function TrendChart({
  rows,
  leftKey,
  rightKey,
  title,
  leftLabel,
  rightLabel,
  leftFormatter,
  rightFormatter,
  mode = "line-line",
}: {
  rows: DailyRow[];
  leftKey: keyof DailyRow;
  rightKey: keyof DailyRow;
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftFormatter: (value: number) => string;
  rightFormatter: (value: number) => string;
  mode?: "line-line" | "bar-line";
}) {
  const chartRows = rows.slice(-45);
  const width = 1000;
  const height = 320;
  const padding = { left: 58, right: 58, top: 34, bottom: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxLeft = maxOf(chartRows, leftKey);
  const maxRight = maxOf(chartRows, rightKey);

  function xScale(index: number) {
    if (chartRows.length <= 1) return padding.left;
    return padding.left + (index / (chartRows.length - 1)) * innerW;
  }

  function yLeft(value: number) {
    return padding.top + innerH - (value / maxLeft) * innerH;
  }

  function yRight(value: number) {
    return padding.top + innerH - (value / maxRight) * innerH;
  }

  const leftPath = chartRows
    .map((row, index) => `${index === 0 ? "M" : "L"} ${xScale(index)} ${yLeft(Number(row[leftKey]) || 0)}`)
    .join(" ");

  const rightPath = chartRows
    .map((row, index) => `${index === 0 ? "M" : "L"} ${xScale(index)} ${yRight(Number(row[rightKey]) || 0)}`)
    .join(" ");

  const areaPath = `${leftPath} L ${xScale(chartRows.length - 1)} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;
  const barWidth = Math.max(6, innerW / Math.max(chartRows.length, 1) - 7);

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="gos-spend-chart">
      <div className="gos-chart-title-row">
        <h2>{title}</h2>
        <span>{leftLabel} / {rightLabel}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="gos-svg-chart">
        {yTicks.map((ratio) => {
          const leftValue = maxLeft * ratio;
          const rightValue = maxRight * ratio;
          const y = padding.top + innerH - ratio * innerH;

          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="gos-grid-line"
              />
              <text x={8} y={y + 4} className="gos-chart-axis">
                {leftFormatter(leftValue)}
              </text>
              <text x={width - 6} y={y + 4} textAnchor="end" className="gos-chart-axis">
                {rightFormatter(rightValue)}
              </text>
            </g>
          );
        })}

        {mode === "bar-line" ? (
          chartRows.map((row, index) => {
            const value = Number(row[leftKey]) || 0;
            const y = yLeft(value);
            const h = height - padding.bottom - y;

            return (
              <rect
                key={row.date}
                x={xScale(index) - barWidth / 2}
                y={y}
                width={barWidth}
                height={h}
                rx={4}
                className="gos-chart-bar"
              >
                <title>
                  {`${row.date}\n${leftLabel}: ${leftFormatter(value)}\n${rightLabel}: ${rightFormatter(Number(row[rightKey]) || 0)}`}
                </title>
              </rect>
            );
          })
        ) : (
          <>
            <path d={areaPath} className="gos-area-blue" />
            <path d={leftPath} className="gos-line-blue" />
          </>
        )}

        {mode === "line-line" ? <path d={rightPath} className="gos-line-green" /> : null}
        {mode === "bar-line" ? <path d={rightPath} className="gos-line-blue" /> : null}

        {chartRows.map((row, index) => {
          if (index % Math.ceil(chartRows.length / 8) !== 0 && index !== chartRows.length - 1) return null;

          return (
            <text
              key={`x-${row.date}`}
              x={xScale(index)}
              y={height - 14}
              textAnchor="middle"
              className="gos-chart-axis"
            >
              {dateLabel(row.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function SpendSummaryTab({ model }: { model: GoogleOsModel }) {
  const dailyRows = useMemo(() => buildDailyRows(model.rows), [model.rows]);

  const totals = useMemo(() => {
    const cost = dailyRows.reduce((sum, row) => sum + row.cost, 0);
    const revenue = dailyRows.reduce((sum, row) => sum + row.revenue, 0);
    const impressions = dailyRows.reduce((sum, row) => sum + row.impressions, 0);
    const clicks = dailyRows.reduce((sum, row) => sum + row.clicks, 0);
    const purchases = dailyRows.reduce((sum, row) => sum + row.purchases, 0);

    return {
      cost,
      revenue,
      impressions,
      clicks,
      purchases,
      roas: safeDiv(revenue, cost),
      cpa: safeDiv(cost, purchases),
      ctr: safeDiv(clicks, impressions),
      cvr: safeDiv(purchases, clicks),
      avgCpc: safeDiv(cost, clicks),
    };
  }, [dailyRows]);

  return (
    <section className="gos-page spend-summary-page">
      <div className="gos-hero">
        <div>
          <span>Spend Summary</span>
          <h1>Daily spend and efficiency trends</h1>
          <p>
            Visual summary of spend, revenue, CPA, ROAS, clicks, impressions, and purchases from the connected Google Ads dataset.
          </p>
        </div>
      </div>

      <div className="gos-kpi-grid">
        <GoogleOsKpi label="Spend" value={compactMoney(totals.cost)} tone="red" />
        <GoogleOsKpi label="Revenue" value={compactMoney(totals.revenue)} tone="green" />
        <GoogleOsKpi label="ROAS" value={x(totals.roas)} tone={totals.roas >= 3 ? "green" : totals.roas < 1 ? "red" : "amber"} />
        <GoogleOsKpi label="CPA" value={compactMoney(totals.cpa)} />
        <GoogleOsKpi label="Purchases" value={compactInt(totals.purchases)} tone="green" />
        <GoogleOsKpi label="CTR" value={pct(totals.ctr)} />
        <GoogleOsKpi label="Impressions" value={compactInt(totals.impressions)} />
        <GoogleOsKpi label="Clicks" value={compactInt(totals.clicks)} />
      </div>

      <div className="gos-chart-grid">
        <div className="gos-panel">
          <TrendChart
            rows={dailyRows}
            leftKey="cost"
            rightKey="revenue"
            title="Daily Spend & Revenue Trend"
            leftLabel="Spend"
            rightLabel="Revenue"
            leftFormatter={compactMoney}
            rightFormatter={compactMoney}
          />
        </div>

        <div className="gos-panel">
          <TrendChart
            rows={dailyRows}
            leftKey="cpa"
            rightKey="roas"
            title="Daily CPA & ROAS Trend"
            leftLabel="CPA"
            rightLabel="ROAS"
            leftFormatter={compactMoney}
            rightFormatter={(value) => value.toFixed(1)}
            mode="bar-line"
          />
        </div>
      </div>

      <div className="gos-panel spend-daily-table">
        <div className="gos-panel-head">
          <div>
            <span>Daily Table</span>
            <h2>Day-wise Google Ads performance</h2>
            <p>Sorted latest first. Use this to check daily movement behind the charts.</p>
          </div>
        </div>

        <GoogleOsTable
          rows={dailyRows.slice().reverse() as unknown as Record<string, unknown>[]}
          columns={[
            { key: "date", label: "Date" },
            { key: "cost", label: "Spend", right: true, render: (row) => compactMoney(row.cost) },
            { key: "revenue", label: "Revenue", right: true, render: (row) => compactMoney(row.revenue) },
            { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
            { key: "purchases", label: "Purchases", right: true, render: (row) => compactInt(row.purchases) },
            { key: "cpa", label: "CPA", right: true, render: (row) => compactMoney(row.cpa) },
            { key: "impressions", label: "Impr.", right: true, render: (row) => compactInt(row.impressions) },
            { key: "clicks", label: "Clicks", right: true, render: (row) => compactInt(row.clicks) },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "cvr", label: "CVR", right: true, render: (row) => pct(row.cvr) },
            { key: "avgCpc", label: "Avg CPC", right: true, render: (row) => compactMoney(row.avgCpc) },
          ]}
          empty="No daily data available."
        />
      </div>
    </section>
  );
}
