export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;

  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    return fallback;
  }

  const cleaned = String(value)
    .replace(/[₹,%x]/g, "")
    .replace(/,/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function str(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const output = String(value).trim();
  return output || fallback;
}

export function int(value: unknown): string {
  return Math.round(num(value)).toLocaleString("en-IN");
}

export function money(value: unknown): string {
  return `₹${Math.round(num(value)).toLocaleString("en-IN")}`;
}

export function pct(value: unknown): string {
  const n = num(value);
  return `${(n * 100).toFixed(2)}%`;
}

export function x(value: unknown): string {
  return `${num(value).toFixed(2)}x`;
}

export function normalizeTerm(term: unknown): string {
  return str(term).toLowerCase().replace(/\s+/g, " ").trim();
}

export function negativeSyntax(term: string, matchType: "exact" | "phrase" | "broad"): string {
  const cleaned = normalizeTerm(term);
  if (!cleaned) return "";

  if (matchType === "exact") return `[${cleaned}]`;
  if (matchType === "phrase") return `"${cleaned}"`;
  return cleaned;
}
