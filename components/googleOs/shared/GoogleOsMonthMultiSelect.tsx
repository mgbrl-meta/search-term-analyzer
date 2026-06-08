"use client";

import { getGoogleOsChartColor, formatGoogleOsShortMonth } from "@/lib/googleOs/chartTheme";

export function GoogleOsMonthMultiSelect({
  months,
  selectedMonths,
  onChange,
}: {
  months: string[];
  selectedMonths: string[];
  onChange: (months: string[]) => void;
}) {
  const selectedSet = new Set(selectedMonths);
  const allSelected = selectedMonths.length === 0 || selectedMonths.length === months.length;

  function toggleMonth(month: string) {
    if (allSelected) {
      onChange(months.filter((item) => item !== month));
      return;
    }

    if (selectedSet.has(month)) {
      const next = selectedMonths.filter((item) => item !== month);
      onChange(next.length ? next : months);
      return;
    }

    onChange([...selectedMonths, month].sort());
  }

  return (
    <div className="gos-month-multi-select">
      <button
        type="button"
        className={`gos-month-chip all ${allSelected ? "active" : ""}`}
        onClick={() => onChange(months)}
      >
        All Months
      </button>

      {months.map((month, index) => (
        <button
          key={month}
          type="button"
          className={`gos-month-chip ${allSelected || selectedSet.has(month) ? "active" : ""}`}
          onClick={() => toggleMonth(month)}
        >
          <i style={{ background: getGoogleOsChartColor(index) }} />
          {formatGoogleOsShortMonth(month)}
        </button>
      ))}
    </div>
  );
}
