"use client";

import { useMemo, useState } from "react";
import type { GoogleOsModel, GoogleOsRow } from "../../../lib/googleOs/types";
import { compactInt, compactMoney, pct, safeDiv, x } from "../../../lib/googleOs/format";
import { GoogleOsKpi } from "../shared/GoogleOsKpi";
import { GoogleOsTable } from "../shared/GoogleOsTable";
import type { GoogleOsDateMode } from "../../../lib/googleOs/dateFilter";
import { getDateLabel } from "../../../lib/googleOs/dateFilter";

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
  spendChangePct: number;
  revenueChangePct: number;
  purchasesChangePct: number;
  roasChangePct: number;
  cpaChangePct: number;
  ctrChangePct: number;
  cvrChangePct: number;
  cpcChangePct: number;
};

type TooltipState = {
  x: number;
  y: number;
  row: DailyRow;
} | null;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function changePct(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous && current) return 100;
  return ((current - previous) / previous) * 100;
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}-${MONTHS[Number(month) - 1]}-${year.slice(2)}`;
}

function shortDateLabel(date: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}`;
}

function buildDailyRows(rows: GoogleOsRow[]): DailyRow[] {
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    if (!row.date) return;
    if (!groups.has(row.date)) groups.set(row.date, []);
    groups.get(row.date)!.push(row);
  });

  const baseRows = Array.from(groups.entries())
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
        spendChangePct: 0,
        revenueChangePct: 0,
        purchasesChangePct: 0,
        roasChangePct: 0,
        cpaChangePct: 0,
        ctrChangePct: 0,
        cvrChangePct: 0,
        cpcChangePct: 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return baseRows.map((row, index) => {
    const previous = baseRows[index - 1];
    if (!previous) return row;

    return {
      ...row,
      spendChangePct: changePct(row.cost, previous.cost),
      revenueChangePct: changePct(row.revenue, previous.revenue),
      purchasesChangePct: changePct(row.purchases, previous.purchases),
      roasChangePct: changePct(row.roas, previous.roas),
      cpaChangePct: changePct(row.cpa, previous.cpa),
      ctrChangePct: changePct(row.ctr, previous.ctr),
      cvrChangePct: changePct(row.cvr, previous.cvr),
      cpcChangePct: changePct(row.avgCpc, previous.avgCpc),
    };
  });
}

function last30DailyRows(rows: DailyRow[]) {
  return rows.slice(-30);
}

function maxOf(rows: DailyRow[], key: keyof DailyRow) {
  return Math.max(...rows.map((row) => Number(row[key]) || 0), 1);
}

function Delta({
  value,
  goodWhenPositive = true,
}: {
  value: number;
  goodWhenPositive?: boolean;
}) {
  const tone =
    value === 0
      ? "neutral"
      : goodWhenPositive
        ? value > 0
          ? "green"
          : "red"
        : value > 0
          ? "red"
          : "green";

  const sign = value > 0 ? "+" : "";

  return <span className={`gos-metric ${tone}`}>{sign}{value.toFixed(1)}%</span>;
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

function ChartTooltip({ tooltip }: { tooltip: TooltipState }) {
  if (!tooltip) return null;

  const row = tooltip.row;

  return (
    <div
      className="gos-chart-tooltip"
      style={{
        left: tooltip.x,
        top: tooltip.y,
      }}
    >
      <strong>{formatDateLabel(row.date)}</strong>
      <div><span>Spend</span><b>{compactMoney(row.cost)}</b></div>
      <div><span>Revenue</span><b>{compactMoney(row.revenue)}</b></div>
      <div><span>ROAS</span><b>{x(row.roas)}</b></div>
      <div><span>CPA</span><b>{compactMoney(row.cpa)}</b></div>
      <div><span>Purchases</span><b>{compactInt(row.purchases)}</b></div>
      <div><span>Impr.</span><b>{compactInt(row.impressions)}</b></div>
      <div><span>Clicks</span><b>{compactInt(row.clicks)}</b></div>
      <div><span>CTR</span><b>{pct(row.ctr)}</b></div>
      <div><span>CVR</span><b>{pct(row.cvr)}</b></div>
    </div>
  );
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
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const chartRows = rows.slice(-30);
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
  const hoverWidth = Math.max(22, innerW / Math.max(chartRows.length, 1));

  return (
    <div
      className="gos-spend-chart gos-chart-with-tooltip"
      onMouseLeave={() => setTooltip(null)}
    >
      <div className="gos-chart-title-row">
        <h2>{title}</h2>
        <span>{leftLabel} / {rightLabel}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="gos-svg-chart gos-responsive-svg" preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
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
              />
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
              {shortDateLabel(row.date)}
            </text>
          );
        })}

        {chartRows.map((row, index) => {
          const xValue = xScale(index);
          const leftY = yLeft(Number(row[leftKey]) || 0);
          const rightY = yRight(Number(row[rightKey]) || 0);

          return (
            <g
              key={`hover-${row.date}`}
              onMouseMove={(event) => {
                const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (!rect) return;

                setTooltip({
                  x: event.clientX - rect.left + 14,
                  y: event.clientY - rect.top + 14,
                  row,
                });
              }}
            >
              <rect
                x={xValue - hoverWidth / 2}
                y={padding.top}
                width={hoverWidth}
                height={innerH}
                className="gos-chart-hover-zone"
              />

              {mode === "line-line" ? (
                <circle
                  cx={xValue}
                  cy={leftY}
                  r={3.6}
                  className="gos-chart-point blue"
                />
              ) : null}

              <circle
                cx={xValue}
                cy={rightY}
                r={3.6}
                className={mode === "line-line" ? "gos-chart-point green" : "gos-chart-point blue"}
              />
            </g>
          );
        })}
      </svg>

      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}

export function SpendSummaryTab({
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
  const sourceRows = inputRows || model.rows;
  const allDailyRows = useMemo(() => buildDailyRows(sourceRows), [sourceRows]);
  const dailyRows = useMemo(() => last30DailyRows(allDailyRows), [allDailyRows]);

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
            {getDateLabel({ mode: dateMode, selectedMonth, compareMonth, customStart, customEnd })}. Day-wise table below always shows the latest 30 dates from this selected view.
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
            <h2>Day-wise Google Ads performance — latest 30 days</h2>
            <p>
              Most recent date appears first. Green/red values show day-over-day % change versus the previous available date.
            </p>
          </div>
        </div>

        <GoogleOsTable
          rows={dailyRows.slice().reverse() as unknown as Record<string, unknown>[]}
          columns={[
            { key: "date", label: "Date", render: (row) => formatDateLabel(String(row.date || "")) },
            { key: "cost", label: "Spend", right: true, render: (row) => <Metric value={compactMoney(row.cost)} tone="red" /> },
            { key: "spendChangePct", label: "Spend Δ", right: true, render: (row) => <Delta value={Number(row.spendChangePct || 0)} goodWhenPositive={false} /> },
            { key: "revenue", label: "Revenue", right: true, render: (row) => <Metric value={compactMoney(row.revenue)} tone="green" /> },
            { key: "revenueChangePct", label: "Revenue Δ", right: true, render: (row) => <Delta value={Number(row.revenueChangePct || 0)} /> },
            { key: "roas", label: "ROAS", right: true, render: (row) => <Metric value={x(row.roas)} tone={roasTone(Number(row.roas || 0))} /> },
            { key: "roasChangePct", label: "ROAS Δ", right: true, render: (row) => <Delta value={Number(row.roasChangePct || 0)} /> },
            { key: "purchases", label: "Purch.", right: true, render: (row) => compactInt(row.purchases) },
            { key: "purchasesChangePct", label: "Purch. Δ", right: true, render: (row) => <Delta value={Number(row.purchasesChangePct || 0)} /> },
            { key: "cpa", label: "CPA", right: true, render: (row) => <Metric value={compactMoney(row.cpa)} tone={cpaTone(row)} /> },
            { key: "cpaChangePct", label: "CPA Δ", right: true, render: (row) => <Delta value={Number(row.cpaChangePct || 0)} goodWhenPositive={false} /> },
            { key: "impressions", label: "Impr.", right: true, render: (row) => compactInt(row.impressions) },
            { key: "clicks", label: "Clicks", right: true, render: (row) => compactInt(row.clicks) },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "ctrChangePct", label: "CTR Δ", right: true, render: (row) => <Delta value={Number(row.ctrChangePct || 0)} /> },
            { key: "cvr", label: "CVR", right: true, render: (row) => pct(row.cvr) },
            { key: "cvrChangePct", label: "CVR Δ", right: true, render: (row) => <Delta value={Number(row.cvrChangePct || 0)} /> },
            { key: "avgCpc", label: "CPC", right: true, render: (row) => compactMoney(row.avgCpc) },
            { key: "cpcChangePct", label: "CPC Δ", right: true, render: (row) => <Delta value={Number(row.cpcChangePct || 0)} goodWhenPositive={false} /> },
          ]}
          empty="No daily data available."
        />
      </div>
    </section>
  );
}
