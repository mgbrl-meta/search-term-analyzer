import type { GoogleOsRow } from "@/lib/googleOs/types";

export type GoogleOsPeriodMode = "daily" | "weekly" | "monthly" | "quarterly";

export type GoogleOsCampaignType =
  | "Search"
  | "Shopping"
  | "Demand Gen"
  | "Video"
  | "Other";

export type GoogleOsSummary = {
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  roas: number;
  cpa: number;
  ctr: number;
  cvr: number;
};

export type GoogleOsPeriodOption = {
  value: string;
  label: string;
};

export type GoogleOsCampaignSummary = GoogleOsSummary & {
  campaignKey: string;
  campaignName: string;
  campaignType: GoogleOsCampaignType;
  status: string;
  share: number;
  decision: string;
};

export type GoogleOsAdGroupSummary = GoogleOsSummary & {
  adGroupKey: string;
  adGroupName: string;
  status: string;
  cpc: number;
};

export function safeDiv(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function readRowField(row: GoogleOsRow, key: string) {
  return String((row as unknown as Record<string, unknown>)[key] || "");
}

function readFirstRowField(row: GoogleOsRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = readRowField(row, key);
    if (value) return value;
  }

  return fallback;
}

export function aggregateGoogleOsRows(rows: GoogleOsRow[]): GoogleOsSummary {
  const spend = rows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const revenue = rows.reduce((sum, row) => sum + Number(row.conversionValue || 0), 0);
  const purchases = rows.reduce((sum, row) => sum + Number(row.conversions || 0), 0);
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);

  return {
    spend,
    revenue,
    purchases,
    impressions,
    clicks,
    roas: safeDiv(revenue, spend),
    cpa: safeDiv(spend, purchases),
    ctr: safeDiv(clicks, impressions),
    cvr: safeDiv(purchases, clicks),
  };
}

export function getGoogleOsCampaignType(row: GoogleOsRow): GoogleOsCampaignType {
  const raw = [
    readRowField(row, "campaignType"),
    readRowField(row, "advertisingChannelType"),
    readRowField(row, "channelType"),
    readRowField(row, "campaign"),
    readRowField(row, "campaignName"),
    readRowField(row, "campaign_name"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (raw.includes("shopping")) return "Shopping";
  if (raw.includes("demand gen") || raw.includes("demandgen")) return "Demand Gen";
  if (raw.includes("video") || raw.includes("youtube") || raw.includes("yt")) return "Video";
  if (raw.includes("search")) return "Search";

  return "Other";
}

export function filterRowsByCampaignType(rows: GoogleOsRow[], type: GoogleOsCampaignType) {
  return rows.filter((row) => getGoogleOsCampaignType(row) === type);
}

function toDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
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

  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function getGoogleOsPeriodKey(row: GoogleOsRow, mode: GoogleOsPeriodMode) {
  const date = String(row.date || "");

  if (!date) return "";

  if (mode === "daily") return date;
  if (mode === "weekly") return getWeekStart(date);
  if (mode === "monthly") return date.slice(0, 7);
  if (mode === "quarterly") return getQuarterKey(date);

  return date;
}

export function formatGoogleOsDate(date: string) {
  const d = toDate(date);

  if (Number.isNaN(d.getTime())) return date;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return `${pad(d.getDate())}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

export function formatGoogleOsPeriodLabel(period: string, mode: GoogleOsPeriodMode) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (mode === "daily") return formatGoogleOsDate(period);
  if (mode === "weekly") return `Week of ${formatGoogleOsDate(period)}`;

  if (mode === "monthly") {
    const [year, month] = period.split("-");
    return `${months[Number(month) - 1] || month}-${String(year).slice(2)}`;
  }

  if (mode === "quarterly") {
    const [year, quarter] = period.split("-Q");
    return `Q${quarter}-${String(year).slice(2)}`;
  }

  return period;
}

export function buildGoogleOsPeriodOptions(rows: GoogleOsRow[], mode: GoogleOsPeriodMode): GoogleOsPeriodOption[] {
  return Array.from(
    new Set(rows.map((row) => getGoogleOsPeriodKey(row, mode)).filter(Boolean))
  )
    .sort()
    .reverse()
    .map((period) => ({
      value: period,
      label: formatGoogleOsPeriodLabel(period, mode),
    }));
}

export function filterRowsByGoogleOsPeriod(
  rows: GoogleOsRow[],
  mode: GoogleOsPeriodMode,
  selectedPeriod: string
) {
  if (!selectedPeriod) return rows;

  return rows.filter((row) => getGoogleOsPeriodKey(row, mode) === selectedPeriod);
}

export function groupRowsByCampaign(rows: GoogleOsRow[]): GoogleOsCampaignSummary[] {
  const total = aggregateGoogleOsRows(rows);
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    const key = readFirstRowField(row, ["campaignId", "campaign_id", "campaign", "campaignName", "campaign_name"], "Unknown Campaign");

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries())
    .map(([campaignKey, campaignRows]) => {
      const first = campaignRows[0];
      const summary = aggregateGoogleOsRows(campaignRows);
      const campaignName = readFirstRowField(first, ["campaign", "campaignName", "campaign_name"], campaignKey);
      const status = readFirstRowField(first, ["status", "campaignStatus", "campaign_status"], "");

      return {
        campaignKey,
        campaignName,
        campaignType: getGoogleOsCampaignType(first),
        status,
        ...summary,
        share: safeDiv(summary.spend, total.spend),
        decision: getGoogleOsDecision(summary),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

export function groupRowsByAdGroup(rows: GoogleOsRow[], campaignKey: string): GoogleOsAdGroupSummary[] {
  const campaignRows = rows.filter((row) => {
    const key = readFirstRowField(row, ["campaignId", "campaign_id", "campaign", "campaignName", "campaign_name"], "Unknown Campaign");
    return key === campaignKey;
  });

  const groups = new Map<string, GoogleOsRow[]>();

  campaignRows.forEach((row) => {
    const key = readFirstRowField(row, ["adGroupId", "ad_group_id", "adGroup", "adGroupName", "ad_group", "ad_group_name"], "Unknown Ad Group");

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries())
    .map(([adGroupKey, adGroupRows]) => {
      const first = adGroupRows[0];
      const summary = aggregateGoogleOsRows(adGroupRows);

      return {
        adGroupKey,
        adGroupName: readFirstRowField(first, ["adGroup", "adGroupName", "ad_group", "ad_group_name"], adGroupKey),
        status: readFirstRowField(first, ["adGroupStatus", "ad_group_status", "status"], ""),
        ...summary,
        cpc: safeDiv(summary.spend, summary.clicks),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

export function getRowsForCampaign(rows: GoogleOsRow[], campaignKey: string) {
  return rows.filter((row) => {
    const key = readFirstRowField(row, ["campaignId", "campaign_id", "campaign", "campaignName", "campaign_name"], "Unknown Campaign");
    return key === campaignKey;
  });
}

export function getGoogleOsDecision(summary: GoogleOsSummary) {
  if (summary.spend > 0 && summary.purchases === 0) return "INVESTIGATE";
  if (summary.roas >= 3) return "SCALE";
  if (summary.roas >= 2) return "KEEP";
  if (summary.roas >= 1) return "WATCH";
  return "REDUCE";
}

export function formatCompactMoney(value: number) {
  const abs = Math.abs(value);

  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(value / 1000).toFixed(1)}K`;

  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatX(value: number) {
  return `${value.toFixed(2)}x`;
}
