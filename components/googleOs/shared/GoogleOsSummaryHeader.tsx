"use client";

import { useMemo, useState } from "react";
import type { GoogleOsRow } from "@/lib/googleOs/types";
import {
  aggregateGoogleOsRows,
  buildGoogleOsPeriodOptions,
  filterRowsByGoogleOsPeriod,
  formatCompactMoney,
  formatPercent,
  formatX,
  type GoogleOsPeriodMode,
} from "@/lib/googleOs/periodToolkit";

type GoogleOsSummaryHeaderProps = {
  kicker: string;
  title: string;
  description: string;

  /**
   * Preferred toolkit prop.
   * Use this going forward.
   */
  baseRows?: GoogleOsRow[];

  /**
   * Backward-compatible prop.
   * Existing tabs using rows={model.rows} will still work.
   */
  rows?: GoogleOsRow[];

  /**
   * Controlled mode.
   * Use when parent tab needs the same period selection for both summary + lower table.
   */
  periodMode?: GoogleOsPeriodMode;
  selectedPeriod?: string;
  onPeriodModeChange?: (mode: GoogleOsPeriodMode) => void;
  onSelectedPeriodChange?: (period: string) => void;
};

export function GoogleOsSummaryHeader({
  kicker,
  title,
  description,
  baseRows,
  rows,
  periodMode,
  selectedPeriod,
  onPeriodModeChange,
  onSelectedPeriodChange,
}: GoogleOsSummaryHeaderProps) {
  const sourceRows = baseRows || rows || [];

  const [internalPeriodMode, setInternalPeriodMode] = useState<GoogleOsPeriodMode>("daily");
  const [internalSelectedPeriodByMode, setInternalSelectedPeriodByMode] = useState<
    Record<GoogleOsPeriodMode, string>
  >({
    daily: "",
    weekly: "",
    monthly: "",
    quarterly: "",
  });

  const isControlled =
    Boolean(periodMode) &&
    Boolean(onPeriodModeChange) &&
    Boolean(onSelectedPeriodChange);

  const activePeriodMode = periodMode || internalPeriodMode;

  const periodOptions = useMemo(() => {
    return buildGoogleOsPeriodOptions(sourceRows, activePeriodMode);
  }, [sourceRows, activePeriodMode]);

  const activeSelectedPeriod =
    selectedPeriod ||
    internalSelectedPeriodByMode[activePeriodMode] ||
    periodOptions[0]?.value ||
    "";

  const filteredRows = useMemo(() => {
    return filterRowsByGoogleOsPeriod(sourceRows, activePeriodMode, activeSelectedPeriod);
  }, [sourceRows, activePeriodMode, activeSelectedPeriod]);

  const totals = useMemo(() => {
    return aggregateGoogleOsRows(filteredRows);
  }, [filteredRows]);

  function handleModeChange(mode: GoogleOsPeriodMode) {
    const nextOptions = buildGoogleOsPeriodOptions(sourceRows, mode);
    const nextPeriod = nextOptions[0]?.value || "";

    if (isControlled) {
      onPeriodModeChange?.(mode);
      onSelectedPeriodChange?.(nextPeriod);
      return;
    }

    setInternalPeriodMode(mode);
    setInternalSelectedPeriodByMode((current) => ({
      ...current,
      [mode]: nextPeriod,
    }));
  }

  function handlePeriodChange(period: string) {
    if (isControlled) {
      onSelectedPeriodChange?.(period);
      return;
    }

    setInternalSelectedPeriodByMode((current) => ({
      ...current,
      [activePeriodMode]: period,
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
            {(["daily", "weekly", "monthly", "quarterly"] as GoogleOsPeriodMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={activePeriodMode === mode ? "active" : ""}
                onClick={() => handleModeChange(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <label>
            Period
            <select value={activeSelectedPeriod} onChange={(event) => handlePeriodChange(event.target.value)}>
              {periodOptions.map((option) => (
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
          <strong>{formatCompactMoney(totals.spend)}</strong>
        </div>

        <div>
          <span>Total Revenue</span>
          <strong>{formatCompactMoney(totals.revenue)}</strong>
        </div>

        <div>
          <span>ROAS</span>
          <strong>{formatX(totals.roas)}</strong>
        </div>

        <div>
          <span>Purchases</span>
          <strong>{totals.purchases.toFixed(0)}</strong>
        </div>

        <div>
          <span>CPA</span>
          <strong>{formatCompactMoney(totals.cpa)}</strong>
        </div>

        <div>
          <span>CTR</span>
          <strong>{formatPercent(totals.ctr)}</strong>
        </div>

        <div>
          <span>CVR</span>
          <strong>{formatPercent(totals.cvr)}</strong>
        </div>
      </div>
    </div>
  );
}
