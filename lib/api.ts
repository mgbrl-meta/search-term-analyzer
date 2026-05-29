// lib/api.ts — API client for the Python backend

import { AnalysisResult, Thresholds } from "@/types/analysis";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface AnalyzeOptions {
  file: File;
  thresholds: Thresholds;
}

export async function analyzeFile(opts: AnalyzeOptions): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", opts.file);

  // Append threshold settings as form fields
  const t = opts.thresholds;
  form.append("spend_threshold",        String(t.spend_threshold));
  form.append("clicks_threshold",       String(t.clicks_threshold));
  form.append("target_roas",            String(t.target_roas));
  form.append("ngram_spend_threshold",  String(t.ngram_spend_threshold));
  form.append("ngram_clicks_threshold", String(t.ngram_clicks_threshold));
  form.append("campaign_filter",        t.campaign_filter);

  const res = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  return res.json();
}

export type ExportType =
  | "search_terms"
  | "negatives_full"
  | "negatives_broad"
  | "negatives_phrase"
  | "negatives_exact"
  | "ngrams"
  | "daily_report";

export async function downloadExport(
  file: File,
  thresholds: Thresholds,
  exportType: ExportType,
  outputFilename: string
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  form.append("spend_threshold",        String(thresholds.spend_threshold));
  form.append("clicks_threshold",       String(thresholds.clicks_threshold));
  form.append("target_roas",            String(thresholds.target_roas));
  form.append("ngram_spend_threshold",  String(thresholds.ngram_spend_threshold));
  form.append("ngram_clicks_threshold", String(thresholds.ngram_clicks_threshold));
  form.append("campaign_filter",        thresholds.campaign_filter);

  const res = await fetch(`${API_URL}/api/export/${exportType}`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Export failed" }));
    throw new Error(err.error || "Export failed");
  }

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = outputFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Lightweight client-side CSV export (for tables already in memory)
export function exportTableToCSV(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines   = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const val = String(r[h] ?? "").replace(/"/g, '""');
        return val.includes(",") ? `"${val}"` : val;
      }).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
