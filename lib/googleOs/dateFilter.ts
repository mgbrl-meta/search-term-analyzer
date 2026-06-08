import type { GoogleOsRow } from "./types";

export type GoogleOsDateMode = "last_30" | "month" | "custom";

const GOOGLE_OS_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function formatGoogleOsMonthLabel(month: string) {
  const [year, monthNum] = String(month || "").split("-");

  if (!year || !monthNum) return month || "";

  const monthIndex = Number(monthNum) - 1;
  const monthName = GOOGLE_OS_MONTHS[monthIndex] || monthNum;

  return `${monthName}-${year.slice(2)}`;
}

export function formatGoogleOsDateLabel(date: string) {
  const [year, monthNum, day] = String(date || "").split("-");

  if (!year || !monthNum || !day) return date || "";

  const monthIndex = Number(monthNum) - 1;
  const monthName = GOOGLE_OS_MONTHS[monthIndex] || monthNum;

  return `${day}-${monthName}-${year.slice(2)}`;
}

export function getAvailableMonths(rows: GoogleOsRow[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.date?.slice(0, 7))
        .filter(Boolean)
    )
  ).sort();
}

export function filterGoogleOsRows({
  rows,
  mode,
  selectedMonth,
  customStart,
  customEnd,
}: {
  rows: GoogleOsRow[];
  mode: GoogleOsDateMode;
  selectedMonth?: string;
  customStart?: string;
  customEnd?: string;
}) {
  if (!rows.length) return [];

  const dates = Array.from(new Set(rows.map((row) => row.date).filter(Boolean))).sort();
  const maxDate = dates[dates.length - 1];

  if (!maxDate) return rows;

  if (mode === "month") {
    const months = getAvailableMonths(rows);
    const month = selectedMonth || months[months.length - 1] || "";
    return rows.filter((row) => row.date.startsWith(month));
  }

  if (mode === "custom" && customStart && customEnd) {
    return rows.filter((row) => row.date >= customStart && row.date <= customEnd);
  }

  const end = new Date(`${maxDate}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);

  return rows.filter((row) => {
    const d = new Date(`${row.date}T00:00:00`);
    return d >= start && d <= end;
  });
}

export function getDateLabel({
  mode,
  selectedMonth,
  compareMonth,
  customStart,
  customEnd,
}: {
  mode: GoogleOsDateMode;
  selectedMonth?: string;
  compareMonth?: string;
  customStart?: string;
  customEnd?: string;
}) {
  if (mode === "month") {
    return compareMonth
      ? `${formatGoogleOsMonthLabel(selectedMonth || "Selected month")} vs ${formatGoogleOsMonthLabel(compareMonth)}`
      : formatGoogleOsMonthLabel(selectedMonth || "Selected month");
  }

  if (mode === "custom") {
    return customStart && customEnd
      ? `${formatGoogleOsDateLabel(customStart)} → ${formatGoogleOsDateLabel(customEnd)}`
      : "Custom date range";
  }

  return "Last 30 days";
}
