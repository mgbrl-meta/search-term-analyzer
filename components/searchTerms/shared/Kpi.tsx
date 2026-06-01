import type { ReactNode } from "react";

export function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "green" | "red" | "blue" | "amber";
}) {
  return (
    <div className={`st-kpi st-kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
