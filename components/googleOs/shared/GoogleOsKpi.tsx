import type { ReactNode } from "react";

export function GoogleOsKpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "green" | "red" | "blue" | "amber";
}) {
  return (
    <div className={`gos-kpi gos-kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}
