import type { GoogleOsRow } from "@/lib/googleOs/types";
import { aggregateGoogleOsRows, safeDiv } from "@/lib/googleOs/periodToolkit";

export type WeeklyPoint = {
  weekKey: string;
  weekLabel: string;
  monthKey: string;
  monthLabel: string;
  spend: number;
  revenue: number;
  purchases: number;
  clicks: number;
  impressions: number;
  roas: number;
  cpa: number;
  ctr: number;
  cvr: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

export function getWeekStart(date: string) {
  const d = toDate(date);

  if (Number.isNaN(d.getTime())) return date;

  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateShort(date: string) {
  const d = toDate(date);

  if (Number.isNaN(d.getTime())) return date;

  return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

export function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `${MONTHS[Number(month) - 1] || month}-${String(year).slice(2)}`;
}

export function formatMoney(value: number) {
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

export function buildWeeklyPoints(rows: GoogleOsRow[]): WeeklyPoint[] {
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    if (!row.date) return;

    const weekKey = getWeekStart(row.date);

    if (!groups.has(weekKey)) groups.set(weekKey, []);
    groups.get(weekKey)!.push(row);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, weekRows]) => {
      const summary = aggregateGoogleOsRows(weekRows);
      const monthKey = weekKey.slice(0, 7);

      return {
        weekKey,
        weekLabel: formatDateShort(weekKey),
        monthKey,
        monthLabel: formatMonthKey(monthKey),
        spend: summary.spend,
        revenue: summary.revenue,
        purchases: summary.purchases,
        clicks: summary.clicks,
        impressions: summary.impressions,
        roas: summary.roas,
        cpa: summary.cpa,
        ctr: summary.ctr,
        cvr: summary.cvr,
      };
    });
}

export function getAvailableMonths(points: WeeklyPoint[]) {
  return Array.from(new Set(points.map((point) => point.monthKey)))
    .sort()
    .map((monthKey) => ({
      key: monthKey,
      label: formatMonthKey(monthKey),
    }));
}

export function filterPointsByMonths(points: WeeklyPoint[], selectedMonths: string[]) {
  if (!selectedMonths.length) return points;

  return points.filter((point) => selectedMonths.includes(point.monthKey));
}

export function getMonthColor(monthKey: string) {
  const googleColors = [
    "#4285F4",
    "#34A853",
    "#FBBC04",
    "#EA4335",
  ];

  const [year, month] = monthKey.split("-");
  const index = (Number(year) * 12 + Number(month)) % googleColors.length;

  return googleColors[index];
}

export function getMax(values: number[]) {
  return Math.max(...values.filter(Number.isFinite), 1);
}

export function getMin(values: number[]) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  return Math.min(...valid, 0);
}

export function buildTooltipLines(point: WeeklyPoint) {
  return [
    ["Week", point.weekLabel],
    ["Month", point.monthLabel],
    ["Spend", formatMoney(point.spend)],
    ["Revenue", formatMoney(point.revenue)],
    ["ROAS", formatX(point.roas)],
    ["CPA", formatMoney(point.cpa)],
    ["Purchases", point.purchases.toFixed(0)],
    ["CTR", formatPercent(point.ctr)],
    ["CVR", formatPercent(point.cvr)],
    ["Clicks", formatMoney(point.clicks)],
    ["Impressions", formatMoney(point.impressions)],
  ];
}
