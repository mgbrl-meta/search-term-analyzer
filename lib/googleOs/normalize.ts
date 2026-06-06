import type { GoogleOsGroupRow, GoogleOsModel, GoogleOsRow } from "./types";
import { changePct, cleanKey, num, safeDiv, str } from "./format";
import { DEFAULT_GOOGLE_OS_SETTINGS } from "./settings";

function normalizeRawKeys(row: Record<string, unknown>) {
  const output: Record<string, unknown> = {};

  Object.entries(row).forEach(([key, value]) => {
    output[cleanKey(key)] = value;
  });

  return output;
}

function pick(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const normalized = cleanKey(key);
    if (row[normalized] !== undefined && row[normalized] !== null && row[normalized] !== "") {
      return row[normalized];
    }
  }

  return fallback;
}

function parseDate(value: unknown): string {
  const raw = str(value);

  if (!raw) return "";

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return raw;
}

function sum(rows: GoogleOsRow[], key: keyof GoogleOsRow): number {
  return rows.reduce((total, row) => total + num(row[key]), 0);
}

function uniqueDates(rows: GoogleOsRow[]) {
  return Array.from(new Set(rows.map((row) => row.date).filter(Boolean))).sort();
}

export function normalizeGoogleAdsRows(rawRows: Record<string, unknown>[]): GoogleOsRow[] {
  return rawRows
    .map((original) => {
      const row = normalizeRawKeys(original);

      const cost = num(pick(row, ["Cost"]));
      const impressions = num(pick(row, ["Impr.", "Impr", "Impressions"]));
      const clicks = num(pick(row, ["Clicks"]));
      const conversions = num(pick(row, ["Conversions"]));
      const conversionValue = num(pick(row, ["Conv. value", "Conversion value", "Conv value"]));

      const ctr = impressions > 0 ? clicks / impressions : num(pick(row, ["CTR"])) / 100;
      const avgCpc = clicks > 0 ? cost / clicks : num(pick(row, ["Avg. CPC", "Average CPC"]));
      const roas = cost > 0 ? conversionValue / cost : num(pick(row, ["Conv. value / cost", "Conversion value / cost"]));
      const cpa = conversions > 0 ? cost / conversions : num(pick(row, ["Cost / conv.", "Cost / conversion"]));
      const cvr = clicks > 0 ? conversions / clicks : num(pick(row, ["Conv. rate", "Conversion rate"])) / 100;
      const aov = conversions > 0 ? conversionValue / conversions : 0;

      return {
        date: parseDate(pick(row, ["Day", "Date"])),

        campaign: str(pick(row, ["Campaign", "Campaign name"])),
        campaignId: str(pick(row, ["Campaign ID"])),
        campaignType: str(pick(row, ["Campaign type"])),
        campaignStatus: str(pick(row, ["Campaign status"])),

        adGroup: str(pick(row, ["Ad group", "Ad group name"])),
        adGroupId: str(pick(row, ["Ad group ID"])),
        adGroupStatus: str(pick(row, ["Ad group state", "Ad group status"])),
        adGroupType: str(pick(row, ["Ad group type"])),

        avgCpc,
        cost,
        impressions,
        clicks,
        ctr,

        conversions,
        conversionValue,
        roas,
        cpa,
        cvr,
        aov,

        allConversions: num(pick(row, ["All conv.", "All conversions"])),
        allConversionValue: num(pick(row, ["All conv. value", "All conversion value"])),

        searchImpressionShare: num(pick(row, ["Search impr. share", "Search impression share"])) / 100,
        searchLostIsRank: num(pick(row, ["Search lost IS (rank)", "Search lost impression share rank"])) / 100,
        searchTopIs: num(pick(row, ["Search top IS", "Search top impression share"])) / 100,
        searchAbsTopIs: num(pick(row, ["Search abs. top IS", "Search absolute top impression share"])) / 100,

        interactions: num(pick(row, ["Interactions"])),
        interactionRate: num(pick(row, ["Interaction rate"])) / 100,

        raw: original,
      };
    })
    .filter((row) => {
      if (!row.date) return false;
      if (!row.campaign && !row.adGroup) return false;

      const label = `${row.campaign} ${row.adGroup}`.toLowerCase();
      if (label.includes("total:")) return false;

      return true;
    });
}

function getStatusAndAction(row: Omit<GoogleOsGroupRow, "status" | "action" | "reason">) {
  const settings = DEFAULT_GOOGLE_OS_SETTINGS;

  if (row.cost >= settings.zeroConversionPauseSpend && row.conversions === 0) {
    return {
      status: "PAUSE" as const,
      action: "Pause or cut bid 70%",
      reason: `₹${Math.round(row.cost).toLocaleString("en-IN")} spend with 0 conversions.`,
    };
  }

  if (row.cost >= settings.hardCutSpend && row.roas < 1) {
    return {
      status: "REDUCE" as const,
      action: "Cut bid 50–70%",
      reason: `${row.roas.toFixed(2)}x ROAS with meaningful spend.`,
    };
  }

  if (row.roas >= settings.recoveryRoas && row.conversions >= 2) {
    return {
      status: "SCALE" as const,
      action: "Increase bid 10%",
      reason: `${row.roas.toFixed(2)}x ROAS with ${row.conversions.toFixed(1)} conversions.`,
    };
  }

  if (row.roas >= 2 && row.roas < settings.recoveryRoas) {
    return {
      status: "KEEP" as const,
      action: "Hold and collect more data",
      reason: `${row.roas.toFixed(2)}x ROAS is positive but below recovery target.`,
    };
  }

  if (row.cost >= settings.minSpendForAction && row.roas > 0 && row.roas < 2) {
    return {
      status: "REDUCE" as const,
      action: "Reduce bid 20–30%",
      reason: `${row.roas.toFixed(2)}x ROAS is below target.`,
    };
  }

  if (row.clicks > 20 && row.conversions === 0) {
    return {
      status: "WATCH" as const,
      action: "Watch; inspect search terms",
      reason: `${Math.round(row.clicks)} clicks with no conversion yet.`,
    };
  }

  return {
    status: "INVESTIGATE" as const,
    action: "Review after more spend",
    reason: "Insufficient data for aggressive action.",
  };
}

function dayMetrics(rows: GoogleOsRow[], date: string) {
  const dayRows = rows.filter((row) => row.date === date);
  const cost = sum(dayRows, "cost");
  const revenue = sum(dayRows, "conversionValue");
  const impressions = sum(dayRows, "impressions");
  const clicks = sum(dayRows, "clicks");
  const conversions = sum(dayRows, "conversions");

  return {
    cost,
    revenue,
    impressions,
    clicks,
    conversions,
    roas: safeDiv(revenue, cost),
    ctr: safeDiv(clicks, impressions),
    cvr: safeDiv(conversions, clicks),
    cpc: safeDiv(cost, clicks),
  };
}

function aggregateRows(
  rows: GoogleOsRow[],
  getKey: (row: GoogleOsRow) => string,
  getLabel: (row: GoogleOsRow) => string
): GoogleOsGroupRow[] {
  const totalCost = sum(rows, "cost");
  const dates = uniqueDates(rows);
  const yesterday = dates[dates.length - 1] || "";
  const previous = dates[dates.length - 2] || "";

  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries())
    .map(([key, groupRows]) => {
      const cost = sum(groupRows, "cost");
      const impressions = sum(groupRows, "impressions");
      const clicks = sum(groupRows, "clicks");
      const conversions = sum(groupRows, "conversions");
      const conversionValue = sum(groupRows, "conversionValue");

      const yd = dayMetrics(groupRows, yesterday);
      const pd = dayMetrics(groupRows, previous);

      const first = groupRows[0];

      const base = {
        key,
        label: getLabel(first),

        campaign: first.campaign,
        campaignId: first.campaignId,
        campaignType: first.campaignType,
        campaignStatus: first.campaignStatus,

        adGroup: first.adGroup,
        adGroupId: first.adGroupId,
        adGroupStatus: first.adGroupStatus,

        dates: uniqueDates(groupRows),

        cost,
        impressions,
        clicks,
        ctr: safeDiv(clicks, impressions),
        avgCpc: safeDiv(cost, clicks),

        conversions,
        conversionValue,
        roas: safeDiv(conversionValue, cost),
        cpa: safeDiv(cost, conversions),
        cvr: safeDiv(conversions, clicks),
        aov: safeDiv(conversionValue, conversions),

        spendShare: safeDiv(cost, totalCost),

        yesterdayCost: yd.cost,
        previousCost: pd.cost,
        costDodPct: changePct(yd.cost, pd.cost),

        yesterdayRevenue: yd.revenue,
        previousRevenue: pd.revenue,
        revenueDodPct: changePct(yd.revenue, pd.revenue),

        yesterdayRoas: yd.roas,
        previousRoas: pd.roas,
        roasDodPct: changePct(yd.roas, pd.roas),

        yesterdayCtr: yd.ctr,
        previousCtr: pd.ctr,
        ctrDodPct: changePct(yd.ctr, pd.ctr),

        yesterdayCvr: yd.cvr,
        previousCvr: pd.cvr,
        cvrDodPct: changePct(yd.cvr, pd.cvr),

        yesterdayCpc: yd.cpc,
        previousCpc: pd.cpc,
        cpcDodPct: changePct(yd.cpc, pd.cpc),
      };

      return {
        ...base,
        ...getStatusAndAction(base),
      };
    })
    .sort((a, b) => b.cost - a.cost);
}

function buildSummary(rows: GoogleOsRow[], campaigns: GoogleOsGroupRow[]) {
  const dates = uniqueDates(rows);
  const startDate = dates[0] || "";
  const endDate = dates[dates.length - 1] || "";
  const previous = dates[dates.length - 2] || "";

  const cost = sum(rows, "cost");
  const impressions = sum(rows, "impressions");
  const clicks = sum(rows, "clicks");
  const conversions = sum(rows, "conversions");
  const conversionValue = sum(rows, "conversionValue");

  const yd = dayMetrics(rows, endDate);
  const pd = dayMetrics(rows, previous);

  const roas = safeDiv(conversionValue, cost);

  const worst = campaigns
    .filter((row) => row.cost > 0)
    .slice()
    .sort((a, b) => {
      const aScore = a.spendShare * Math.max(0, 3 - a.roas);
      const bScore = b.spendShare * Math.max(0, 3 - b.roas);
      return bScore - aScore;
    })[0];

  const best = campaigns
    .filter((row) => row.conversions > 0)
    .slice()
    .sort((a, b) => b.roas - a.roas)[0];

  let budgetRecommendation = "Hold budget until enough daily data is available.";

  if (roas < 1) budgetRecommendation = "Reduce/hold budget at ₹3,000/day until ROAS crosses 1x.";
  else if (roas < 2) budgetRecommendation = "Budget ceiling ₹5,000/day until ROAS crosses 2x.";
  else if (roas < 3) budgetRecommendation = "Budget ceiling ₹7,500/day until ROAS crosses 3x.";
  else if (roas < 4) budgetRecommendation = "Budget can move toward ₹10,000/day if stable for 3 days.";
  else budgetRecommendation = "Budget can move toward ₹15,000/day if stable for 5 days.";

  return {
    startDate,
    endDate,
    days: dates.length,

    cost,
    impressions,
    clicks,
    ctr: safeDiv(clicks, impressions),
    avgCpc: safeDiv(cost, clicks),

    conversions,
    conversionValue,
    roas,
    cpa: safeDiv(cost, conversions),
    cvr: safeDiv(conversions, clicks),
    aov: safeDiv(conversionValue, conversions),

    yesterdayCost: yd.cost,
    previousCost: pd.cost,
    costDodPct: changePct(yd.cost, pd.cost),

    yesterdayRevenue: yd.revenue,
    previousRevenue: pd.revenue,
    revenueDodPct: changePct(yd.revenue, pd.revenue),

    yesterdayRoas: yd.roas,
    previousRoas: pd.roas,
    roasDodPct: changePct(yd.roas, pd.roas),

    biggestIssue: worst
      ? `${worst.label} is the biggest risk: ${Math.round(worst.spendShare * 100)}% spend share at ${worst.roas.toFixed(2)}x ROAS.`
      : "No clear biggest issue yet.",

    immediateAction: worst
      ? `${worst.action} on ${worst.label}. ${best ? `Protect ${best.label} at ${best.roas.toFixed(2)}x ROAS.` : ""}`
      : "Wait for more data before aggressive action.",

    budgetRecommendation,
  };
}

export function buildGoogleOsModel(rawRows: Record<string, unknown>[]): GoogleOsModel {
  const rows = normalizeGoogleAdsRows(rawRows);

  const campaigns = aggregateRows(
    rows,
    (row) => row.campaignId || row.campaign,
    (row) => row.campaign
  );

  const adGroups = aggregateRows(
    rows,
    (row) => `${row.campaignId || row.campaign}::${row.adGroupId || row.adGroup}`,
    (row) => row.adGroup || row.campaign
  );

  const summary = buildSummary(rows, campaigns);

  return {
    rows,
    campaigns,
    adGroups,
    summary,
  };
}
