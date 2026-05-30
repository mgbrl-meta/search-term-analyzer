// lib/format.ts
// Single source of truth for defensive coercion + display formatting.
// The live backend does not always match types/api.ts, so EVERY value that
// reaches a .toLocaleString()/.toFixed()/.slice() call must pass through here
// first. `num()` is the same guard already proven in NgramsTable.

/** Coerce anything to a finite number; undefined/null/NaN/Infinity/non-coercible -> 0. */
export function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  try {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    // e.g. Symbol or objects with throwing valueOf — never happens from JSON,
    // but we guarantee num() never throws.
    return 0;
  }
}

/** Coerce anything to a trimmed string; undefined/null -> ''. */
export function str(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

/** Coerce anything to an array; non-arrays -> []. */
export function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Coerce anything to a plain object; non-objects -> {}. */
export function obj<T extends object>(v: unknown): Partial<T> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Partial<T>)
    : {};
}

/** Integer with thousands separators. */
export function fmtInt(v: unknown): string {
  return Math.round(num(v)).toLocaleString('en-IN');
}

/** Indian-format currency, rounded. */
export function fmtCurrency(v: unknown): string {
  return '₹' + Math.round(num(v)).toLocaleString('en-IN');
}

/** Compact currency for axis labels / tight spaces. */
export function fmtCurrencyShort(v: unknown): string {
  const n = num(v);
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e7) return sign + '₹' + (a / 1e7).toFixed(1) + 'Cr';
  if (a >= 1e5) return sign + '₹' + (a / 1e5).toFixed(1) + 'L';
  if (a >= 1e3) return sign + '₹' + (a / 1e3).toFixed(1) + 'K';
  return sign + '₹' + Math.round(a).toLocaleString('en-IN');
}

/** ROAS multiple, e.g. "4.23x". */
export function fmtX(v: unknown): string {
  return num(v).toFixed(2) + 'x';
}

/**
 * Percentage. Backend is inconsistent: some fields arrive as fractions (0.05)
 * and some as whole percents (5). Heuristic: a magnitude <= 1 is treated as a
 * fraction and scaled up. `digits` controls decimal places.
 */
export function fmtPct(v: unknown, digits = 2): string {
  const n = num(v);
  const val = Math.abs(n) <= 1 ? n * 100 : n;
  return val.toFixed(digits) + '%';
}
