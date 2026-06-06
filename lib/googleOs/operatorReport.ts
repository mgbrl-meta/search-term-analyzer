import type { GoogleOsModel } from "./types";
import { int, money, pct, pctChange, x } from "./format";

export function buildGoogleOsMarkdownReport(model: GoogleOsModel) {
  const { summary } = model;

  const campaignRows = model.campaigns
    .slice(0, 12)
    .map(
      (row) =>
        `| ${row.label} | ${money(row.cost)} | ${money(row.conversionValue)} | ${x(row.roas)} | ${row.conversions.toFixed(2)} | ${money(row.cpa)} | ${pct(row.cvr)} | ${row.status} | ${row.action} |`
    )
    .join("\n");

  const adGroupRows = model.adGroups
    .slice(0, 20)
    .map(
      (row) =>
        `| ${row.campaign || "-"} | ${row.label} | ${money(row.cost)} | ${money(row.conversionValue)} | ${x(row.roas)} | ${row.conversions.toFixed(2)} | ${money(row.cpa)} | ${pct(row.cvr)} | ${row.status} | ${row.action} |`
    )
    .join("\n");

  const actionRows = model.adGroups
    .filter((row) => ["PAUSE", "REDUCE", "SCALE"].includes(row.status))
    .slice(0, 15)
    .map(
      (row, index) =>
        `| ${index + 1} | ${row.action} | ${row.label} | ${row.reason} |`
    )
    .join("\n");

  return `# Google OS Operator Report

## 1. Executive Summary

| Metric | Value |
|---|---:|
| Date range | ${summary.startDate} → ${summary.endDate} |
| Days | ${int(summary.days)} |
| Spend | ${money(summary.cost)} |
| Revenue | ${money(summary.conversionValue)} |
| ROAS | ${x(summary.roas)} |
| Conversions | ${summary.conversions.toFixed(2)} |
| CPA | ${money(summary.cpa)} |
| AOV | ${money(summary.aov)} |
| CVR | ${pct(summary.cvr)} |
| CTR | ${pct(summary.ctr)} |
| Avg CPC | ${money(summary.avgCpc)} |

**Biggest issue:** ${summary.biggestIssue}

**Immediate action:** ${summary.immediateAction}

**Budget recommendation:** ${summary.budgetRecommendation}

## 2. Day-over-Day Movement

| Metric | Yesterday | Previous Day | Change |
|---|---:|---:|---:|
| Spend | ${money(summary.yesterdayCost)} | ${money(summary.previousCost)} | ${pctChange(summary.costDodPct)} |
| Revenue | ${money(summary.yesterdayRevenue)} | ${money(summary.previousRevenue)} | ${pctChange(summary.revenueDodPct)} |
| ROAS | ${x(summary.yesterdayRoas)} | ${x(summary.previousRoas)} | ${pctChange(summary.roasDodPct)} |

## 3. Campaign Diagnosis

| Campaign | Spend | Revenue | ROAS | Conv. | CPA | CVR | Status | Action |
|---|---:|---:|---:|---:|---:|---:|---|---|
${campaignRows || "| No campaign data | - | - | - | - | - | - | - | - |"}

## 4. Ad Group Diagnosis

| Campaign | Ad Group | Spend | Revenue | ROAS | Conv. | CPA | CVR | Status | Action |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
${adGroupRows || "| No ad group data | - | - | - | - | - | - | - | - | - |"}

## 5. 30-Minute Action Plan

| Priority | Action | Entity | Reason |
|---:|---|---|---|
${actionRows || "| 1 | Hold | All | No strong action signal yet |"}

## 6. Next Review Rule

Review after fresh spend of ₹5,000 or after 3 new days of data, whichever comes first.

Scale only if ROAS stays above 2x for 3 consecutive days.

Cut or pause any ad group that spends ₹2,000+ below 1x ROAS or spends ₹2,000+ with zero conversions.
`;
}
