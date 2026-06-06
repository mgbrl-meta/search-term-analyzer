export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  let raw = String(value).trim();

  if (raw === "--" || raw === "-") return fallback;

  raw = raw
    .replace(/[₹,%x]/g, "")
    .replace(/,/g, "")
    .trim();

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function str(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const output = String(value).trim();
  return output || fallback;
}

export function cleanKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function money(value: unknown): string {
  return `₹${Math.round(num(value)).toLocaleString("en-IN")}`;
}

export function int(value: unknown): string {
  return Math.round(num(value)).toLocaleString("en-IN");
}

export function pct(value: unknown): string {
  return `${(num(value) * 100).toFixed(2)}%`;
}

export function pctChange(value: unknown): string {
  const n = num(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function x(value: unknown): string {
  return `${num(value).toFixed(2)}x`;
}

export function safeDiv(a: number, b: number): number {
  return b ? a / b : 0;
}

export function changePct(current: number, previous: number): number {
  if (!previous && !current) return 0;
  if (!previous && current) return 100;
  return ((current - previous) / previous) * 100;
}
