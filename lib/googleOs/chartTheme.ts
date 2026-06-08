export const GOOGLE_OS_CHART_COLORS = [
  "#4285F4",
  "#34A853",
  "#FBBC04",
  "#EA4335",
  "#8B5CF6",
  "#06B6D4",
  "#F97316",
  "#22C55E",
  "#EF4444",
  "#A855F7",
  "#14B8A6",
  "#EAB308",
];

export function getGoogleOsChartColor(index: number) {
  return GOOGLE_OS_CHART_COLORS[index % GOOGLE_OS_CHART_COLORS.length];
}

export function getMonthKeyFromDate(date: string) {
  return String(date || "").slice(0, 7);
}

export function formatGoogleOsShortMonth(month: string) {
  const [year, monthNum] = String(month || "").split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const label = names[Number(monthNum) - 1] || monthNum || "";
  return year ? `${label}-${year.slice(2)}` : month;
}

export function getAvailableMonthKeysFromRows<T extends { date?: string }>(rows: T[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => getMonthKeyFromDate(row.date || ""))
        .filter(Boolean)
    )
  ).sort();
}

export function filterRowsBySelectedMonths<T extends { date?: string }>(
  rows: T[],
  selectedMonths: string[]
) {
  if (!selectedMonths.length) return rows;

  const selected = new Set(selectedMonths);
  return rows.filter((row) => selected.has(getMonthKeyFromDate(row.date || "")));
}
