"use client";

import { useMemo } from "react";
import type { GoogleOsModel, GoogleOsRow } from "../../../lib/googleOs/types";
import { int, money, pct, x, safeDiv } from "../../../lib/googleOs/format";
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
  incrementalRevenue: number;
  incrementalPurchases: number;
  marginalRoas: number;
};

function monthKey(date: string) {
  if (!date) return "Unknown";
  return date.slice(0, 7);
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
        incrementalRevenue: 0,
        incrementalPurchases: 0,
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

    return {
      ...row,
      incrementalSpend,
      incrementalRevenue,
      incrementalPurchases,
      marginalRoas: incrementalSpend !== 0 ? incrementalRevenue / incrementalSpend : 0,
    };
  });
}

export function MonthlySummaryTab({ model }: { model: GoogleOsModel }) {
  const rows = useMemo(() => buildMonthlyRows(model.rows), [model.rows]);
  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];

  return (
    <section className="gos-page">
      <div className="gos-hero">
        <div>
          <span>Monthly Summary</span>
          <h1>Monthly performance movement</h1>
          <p>
            Month-level spend, traffic, purchases, revenue, ROAS, and incremental efficiency.
          </p>
        </div>
      </div>

      {latest ? (
        <div className="gos-kpi-grid">
          <GoogleOsKpi label="Latest Month" value={latest.month} />
          <GoogleOsKpi label="Spend" value={money(latest.cost)} tone="red" />
          <GoogleOsKpi label="Revenue" value={money(latest.revenue)} tone="green" />
          <GoogleOsKpi label="ROAS" value={x(latest.roas)} tone={latest.roas >= 3 ? "green" : latest.roas < 1 ? "red" : "amber"} />
          <GoogleOsKpi label="Purchases" value={latest.purchases.toFixed(2)} />
          <GoogleOsKpi label="CPA" value={money(latest.cpa)} />
          <GoogleOsKpi label="Incremental Spend" value={money(latest.incrementalSpend)} tone={latest.incrementalSpend > 0 ? "red" : "green"} />
          <GoogleOsKpi label="Incremental Revenue" value={money(latest.incrementalRevenue)} tone={latest.incrementalRevenue >= 0 ? "green" : "red"} />
        </div>
      ) : null}

      {latest && previous ? (
        <div className="gos-insight-grid">
          <div className="gos-insight-card">
            <span>Incremental Revenue</span>
            <p>
              {latest.month} generated {money(latest.incrementalRevenue)} incremental revenue versus {previous.month}.
            </p>
          </div>

          <div className="gos-insight-card">
            <span>Incremental Spend</span>
            <p>
              Spend changed by {money(latest.incrementalSpend)} versus previous month.
            </p>
          </div>

          <div className="gos-insight-card">
            <span>Marginal ROAS</span>
            <p>
              Marginal ROAS is {x(latest.marginalRoas)}. This shows the efficiency of incremental spend.
            </p>
          </div>
        </div>
      ) : null}

      <div className="gos-panel">
        <div className="gos-panel-head">
          <div>
            <span>Monthly Table</span>
            <h2>Month-level Google Ads performance</h2>
            <p>
              Incremental values compare each month against the previous month.
            </p>
          </div>
        </div>

        <GoogleOsTable
          rows={rows.slice().reverse() as unknown as Record<string, unknown>[]}
          columns={[
            { key: "month", label: "Month" },
            { key: "days", label: "Days", right: true, render: (row) => int(row.days) },
            { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
            { key: "impressions", label: "Impr.", right: true, render: (row) => int(row.impressions) },
            { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "avgCpc", label: "Avg CPC", right: true, render: (row) => money(row.avgCpc) },
            { key: "costPerImpression", label: "Cost / Impr.", right: true, render: (row) => money(row.costPerImpression) },
            { key: "purchases", label: "Purchases", right: true, render: (row) => Number(row.purchases || 0).toFixed(2) },
            { key: "revenue", label: "Revenue", right: true, render: (row) => money(row.revenue) },
            { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
            { key: "cpa", label: "CPA", right: true, render: (row) => money(row.cpa) },
            { key: "cvr", label: "CVR", right: true, render: (row) => pct(row.cvr) },
            { key: "aov", label: "AOV", right: true, render: (row) => money(row.aov) },
            { key: "incrementalSpend", label: "Incr. Spend", right: true, render: (row) => money(row.incrementalSpend) },
            { key: "incrementalRevenue", label: "Incr. Revenue", right: true, render: (row) => money(row.incrementalRevenue) },
            { key: "incrementalPurchases", label: "Incr. Purchases", right: true, render: (row) => Number(row.incrementalPurchases || 0).toFixed(2) },
            { key: "marginalRoas", label: "Marginal ROAS", right: true, render: (row) => x(row.marginalRoas) },
          ]}
          empty="No monthly data available."
        />
      </div>
    </section>
  );
}
