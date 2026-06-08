"use client";

import { useMemo, useState } from "react";
import type { GoogleOsRow } from "@/lib/googleOs/types";
import { compactMoney, pct, safeDiv, x } from "@/lib/googleOs/format";

type TimeMode = "daily" | "weekly" | "monthly" | "quarterly";

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
    roas: safeDiv(revenue, spend),
    cpa: safeDiv(spend, purchases),
    ctr: safeDiv(clicks, impressions),
    cvr: safeDiv(purchases, clicks),
  };
}

function toDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateLabel(date: string) {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return date;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return `${pad(d.getDate())}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const label = months[Number(monthNumber) - 1] || monthNumber;

  return `${label}-${String(year).slice(2)}`;
}

function getWeekStart(date: string) {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return date;

  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getQuarterKey(date: string) {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return date;

  const quarter = Math.floor(d.getMonth() / 3) + 1;

  return `${d.getFullYear()}-Q${quarter}`;
}

function getPeriodKey(row: GoogleOsRow, mode: TimeMode) {
  const date = row.date || "";

  if (!date) return "";

  if (mode === "daily") return date;
  if (mode === "weekly") return getWeekStart(date);
  if (mode === "monthly") return date.slice(0, 7);
  if (mode === "quarterly") return getQuarterKey(date);

  return date;
}

function getPeriodLabel(value: string, mode: TimeMode) {
  if (mode === "daily") return formatDateLabel(value);
  if (mode === "weekly") return `Week of ${formatDateLabel(value)}`;
  if (mode === "monthly") return formatMonthLabel(value);
  if (mode === "quarterly") {
    const [year, quarter] = value.split("-Q");
    return `Q${quarter}-${String(year).slice(2)}`;
  }

  return value;
}

function buildPeriodOptions(rows: GoogleOsRow[], mode: TimeMode) {
  return Array.from(
    new Set(
      rows
        .map((row) => getPeriodKey(row, mode))
        .filter(Boolean)
    )
  )
    .sort()
    .reverse()
    .map((value) => ({
      value,
      label: getPeriodLabel(value, mode),
    }));
}

function filterRowsByPeriod(rows: GoogleOsRow[], mode: TimeMode, period: string) {
  if (!period) return rows;

  return rows.filter((row) => getPeriodKey(row, mode) === period);
}

export function GoogleOsSummaryHeader({
  kicker,
  title,
  description,
  rows,
  periodLabel = "Period",
  timeMode,
  onTimeModeChange,
  periodOptions,
  selectedPeriod,
  onPeriodChange,
}: {
  kicker: string;
  title: string;
  description: string;
  rows: GoogleOsRow[];
  periodLabel?: string;
  timeMode?: TimeMode;
  onTimeModeChange?: (mode: TimeMode) => void;
  periodOptions?: { value: string; label: string }[];
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
}) {
  const [internalTimeMode, setInternalTimeMode] = useState<TimeMode>("daily");
  const [internalPeriodByMode, setInternalPeriodByMode] = useState<Record<TimeMode, string>>({
    daily: "",
    weekly: "",
    monthly: "",
    quarterly: "",
  });

  const activeTimeMode = timeMode || internalTimeMode;

  const generatedOptions = useMemo(() => {
    return buildPeriodOptions(rows || [], activeTimeMode);
  }, [rows, activeTimeMode]);

  const activeOptions = periodOptions?.length ? periodOptions : generatedOptions;

  const activeSelectedPeriod =
    selectedPeriod ||
    internalPeriodByMode[activeTimeMode] ||
    activeOptions[0]?.value ||
    "";

  const summaryRows = useMemo(() => {
    return filterRowsByPeriod(rows || [], activeTimeMode, activeSelectedPeriod);
  }, [rows, activeTimeMode, activeSelectedPeriod]);

  const totals = aggregate(summaryRows);

  function handleTimeModeChange(mode: TimeMode) {
    if (onTimeModeChange) {
      onTimeModeChange(mode);
      return;
    }

    setInternalTimeMode(mode);
  }

  function handlePeriodChange(period: string) {
    if (onPeriodChange) {
      onPeriodChange(period);
      return;
    }

    setInternalPeriodByMode((current) => ({
      ...current,
      [activeTimeMode]: period,
    }));
  }

  return (
    <div className="gos-shared-summary-header">
      <div className="gos-shared-summary-top">
        <div>
          <span>{kicker}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="gos-shared-period-controls">
          <div className="gos-shared-time-buttons">
            {(["daily", "weekly", "monthly", "quarterly"] as TimeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={activeTimeMode === mode ? "active" : ""}
                onClick={() => handleTimeModeChange(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <label>
            {periodLabel}
            <select value={activeSelectedPeriod} onChange={(event) => handlePeriodChange(event.target.value)}>
              {activeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="gos-shared-summary-metrics">
        <div>
          <span>Total Spend</span>
          <strong>{compactMoney(totals.spend)}</strong>
        </div>
        <div>
          <span>Total Revenue</span>
          <strong>{compactMoney(totals.revenue)}</strong>
        </div>
        <div>
          <span>ROAS</span>
          <strong>{x(totals.roas)}</strong>
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
          <span>CTR</span>
          <strong>{pct(totals.ctr)}</strong>
        </div>
        <div>
          <span>CVR</span>
          <strong>{pct(totals.cvr)}</strong>
        </div>
      </div>
    </div>
  );
}
