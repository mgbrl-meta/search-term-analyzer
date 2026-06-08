"use client";

import { useMemo, useState } from "react";
import type { GoogleOsRow } from "@/lib/googleOs/types";
import {
  buildTooltipLines,
  buildWeeklyPoints,
  filterPointsByMonths,
  formatMoney,
  getAvailableMonths,
  getMax,
  getMin,
  getMonthColor,
  type WeeklyPoint,
} from "@/lib/googleOs/monthlyChartToolkit";

type HoverState = {
  x: number;
  y: number;
  point: WeeklyPoint;
  title: string;
} | null;

function AxisTooltip({ hover }: { hover: HoverState }) {
  if (!hover) return null;

  return (
    <div
      className="gos-chart-tooltip"
      style={{
        left: hover.x,
        top: hover.y,
      }}
    >
      <strong>{hover.title}</strong>

      {buildTooltipLines(hover.point).map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

function MonthSelector({
  months,
  selectedMonths,
  setSelectedMonths,
}: {
  months: { key: string; label: string }[];
  selectedMonths: string[];
  setSelectedMonths: (months: string[]) => void;
}) {
  const allActive = selectedMonths.length === 0;

  function toggleMonth(month: string) {
    if (selectedMonths.includes(month)) {
      setSelectedMonths(selectedMonths.filter((item) => item !== month));
      return;
    }

    setSelectedMonths([...selectedMonths, month]);
  }

  return (
    <div className="gos-month-selector">
      <button
        type="button"
        className={allActive ? "active" : ""}
        onClick={() => setSelectedMonths([])}
      >
        All Months
      </button>

      {months.map((month) => (
        <button
          key={month.key}
          type="button"
          className={selectedMonths.includes(month.key) ? "active" : ""}
          onClick={() => toggleMonth(month.key)}
        >
          <i style={{ background: getMonthColor(month.key) }} />
          {month.label}
        </button>
      ))}
    </div>
  );
}

function WeeklySpendCpaChart({
  points,
}: {
  points: WeeklyPoint[];
}) {
  const [hover, setHover] = useState<HoverState>(null);

  const width = 1200;
  const height = 360;
  const left = 74;
  const right = 64;
  const top = 38;
  const bottom = 58;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const maxSpend = getMax(points.map((point) => point.spend));
  const maxCpa = getMax(points.map((point) => point.cpa));
  const minCpa = getMin(points.map((point) => point.cpa));
  const cpaRange = Math.max(maxCpa - minCpa, 1);

  const barGap = 5;
  const barWidth = points.length ? Math.max(7, chartWidth / points.length - barGap) : 0;

  function getX(index: number) {
    if (points.length <= 1) return left + chartWidth / 2;
    return left + (index / (points.length - 1)) * chartWidth;
  }

  function getBarX(index: number) {
    return left + index * (chartWidth / Math.max(points.length, 1)) + barGap / 2;
  }

  function getSpendHeight(spend: number) {
    return (spend / maxSpend) * chartHeight;
  }

  function getCpaY(cpa: number) {
    return top + chartHeight - ((cpa - minCpa) / cpaRange) * chartHeight;
  }

  const cpaLine = points.map((point, index) => `${getX(index)},${getCpaY(point.cpa)}`).join(" ");

  const xTickEvery = points.length <= 10 ? 1 : Math.ceil(points.length / 7);
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="gos-chart-card">
      <div className="gos-chart-card-head">
        <div>
          <span>Lifetime Weekly Trend</span>
          <h3>Weekly Spend vs CPA</h3>
          <p>Hover any bar or line point to see exact spend, CPA, revenue, purchases, CTR and CVR.</p>
        </div>
        <strong>Bar: Spend · Line: CPA · Color: Month</strong>
      </div>

      <div className="gos-chart-stage">
        <svg viewBox={`0 0 ${width} ${height}`} className="gos-chart-svg">
          {yTicks.map((tick) => {
            const y = top + chartHeight * tick;
            const spendValue = maxSpend * (1 - tick);
            const cpaValue = minCpa + cpaRange * (1 - tick);

            return (
              <g key={tick}>
                <line x1={left} x2={width - right} y1={y} y2={y} className="gos-chart-grid" />
                <text x={left - 12} y={y + 4} textAnchor="end" className="gos-chart-axis-text">
                  {formatMoney(spendValue)}
                </text>
                <text x={width - right + 12} y={y + 4} textAnchor="start" className="gos-chart-axis-text">
                  {formatMoney(cpaValue)}
                </text>
              </g>
            );
          })}

          <line x1={left} x2={left} y1={top} y2={top + chartHeight} className="gos-chart-axis" />
          <line x1={left} x2={width - right} y1={top + chartHeight} y2={top + chartHeight} className="gos-chart-axis" />

          {points.map((point, index) => {
            const h = getSpendHeight(point.spend);
            const x = getBarX(index);
            const y = top + chartHeight - h;
            const fill = getMonthColor(point.monthKey);

            return (
              <rect
                key={point.weekKey}
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx="4"
                fill={fill}
                className="gos-chart-bar"
                onMouseMove={(event) => {
                  const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();

                  setHover({
                    x: event.clientX - rect.left + 14,
                    y: event.clientY - rect.top + 14,
                    point,
                    title: "Weekly Spend",
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          {cpaLine ? <polyline points={cpaLine} className="gos-chart-line red" /> : null}

          {points.map((point, index) => {
            const x = getX(index);
            const y = getCpaY(point.cpa);

            return (
              <circle
                key={`${point.weekKey}-cpa`}
                cx={x}
                cy={y}
                r="4.5"
                className="gos-chart-dot red"
                onMouseMove={(event) => {
                  const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();

                  setHover({
                    x: event.clientX - rect.left + 14,
                    y: event.clientY - rect.top + 14,
                    point,
                    title: "Weekly CPA",
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          {points.map((point, index) => {
            if (index !== 0 && index !== points.length - 1 && index % xTickEvery !== 0) return null;

            return (
              <text
                key={`${point.weekKey}-axis`}
                x={getX(index)}
                y={height - 20}
                textAnchor="middle"
                className="gos-chart-axis-text x"
              >
                {point.weekLabel}
              </text>
            );
          })}
        </svg>

        <AxisTooltip hover={hover} />
      </div>
    </div>
  );
}

function WeeklyScatterChart({
  points,
}: {
  points: WeeklyPoint[];
}) {
  const [hover, setHover] = useState<HoverState>(null);

  const width = 1200;
  const height = 360;
  const left = 74;
  const right = 42;
  const top = 34;
  const bottom = 62;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const maxSpend = getMax(points.map((point) => point.spend));
  const maxCpa = getMax(points.map((point) => point.cpa));
  const minCpa = getMin(points.map((point) => point.cpa));
  const cpaRange = Math.max(maxCpa - minCpa, 1);

  function getX(spend: number) {
    return left + (spend / maxSpend) * chartWidth;
  }

  function getY(cpa: number) {
    return top + chartHeight - ((cpa - minCpa) / cpaRange) * chartHeight;
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="gos-chart-card">
      <div className="gos-chart-card-head">
        <div>
          <span>Weekly Scale Efficiency</span>
          <h3>Weekly Spend vs Weekly CPA Scatter</h3>
          <p>Hover any dot to inspect that week. Use month filters above to compare selected months.</p>
        </div>
        <strong>X: Weekly Spend · Y: Weekly CPA · Dot: Week</strong>
      </div>

      <div className="gos-chart-stage">
        <svg viewBox={`0 0 ${width} ${height}`} className="gos-chart-svg">
          {ticks.map((tick) => {
            const x = left + chartWidth * tick;
            const y = top + chartHeight * tick;
            const spendValue = maxSpend * tick;
            const cpaValue = minCpa + cpaRange * (1 - tick);

            return (
              <g key={tick}>
                <line x1={x} x2={x} y1={top} y2={top + chartHeight} className="gos-chart-grid" />
                <line x1={left} x2={width - right} y1={y} y2={y} className="gos-chart-grid" />
                <text x={x} y={height - 24} textAnchor="middle" className="gos-chart-axis-text">
                  {formatMoney(spendValue)}
                </text>
                <text x={left - 12} y={y + 4} textAnchor="end" className="gos-chart-axis-text">
                  {formatMoney(cpaValue)}
                </text>
              </g>
            );
          })}

          <line x1={left} x2={left} y1={top} y2={top + chartHeight} className="gos-chart-axis" />
          <line x1={left} x2={width - right} y1={top + chartHeight} y2={top + chartHeight} className="gos-chart-axis" />

          {points.map((point) => (
            <circle
              key={point.weekKey}
              cx={getX(point.spend)}
              cy={getY(point.cpa)}
              r="6"
              fill={getMonthColor(point.monthKey)}
              className="gos-chart-scatter-dot"
              onMouseMove={(event) => {
                const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();

                setHover({
                  x: event.clientX - rect.left + 14,
                  y: event.clientY - rect.top + 14,
                  point,
                  title: "Weekly Point",
                });
              }}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        <AxisTooltip hover={hover} />
      </div>
    </div>
  );
}

export function GoogleOsMonthlyCharts({ rows }: { rows: GoogleOsRow[] }) {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const allPoints = useMemo(() => buildWeeklyPoints(rows), [rows]);
  const months = useMemo(() => getAvailableMonths(allPoints), [allPoints]);
  const visiblePoints = useMemo(
    () => filterPointsByMonths(allPoints, selectedMonths),
    [allPoints, selectedMonths]
  );

  return (
    <div className="gos-monthly-chart-toolkit">
      <MonthSelector
        months={months}
        selectedMonths={selectedMonths}
        setSelectedMonths={setSelectedMonths}
      />

      <WeeklySpendCpaChart points={visiblePoints} />
      <WeeklyScatterChart points={visiblePoints} />
    </div>
  );
}
