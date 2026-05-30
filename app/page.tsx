"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FileUpload from "@/components/FileUpload";
import ThemeToggle from "@/components/ThemeToggle";
import type { AnalyzeResponse } from "@/types/api";

type AnyObj = Record<string, any>;

type TabKey =
  | "brief"
  | "spend_wasters"
  | "negative_keywords"
  | "ngram_waste"
  | "pdp_issues"
  | "scale"
  | "intent_brand"
  | "raw_terms";

const TABS: { key: TabKey; label: string; helper: string }[] = [
  {
    key: "brief",
    label: "Action Brief",
    helper: "The shortest operator summary: what to cut, fix, scale, and export.",
  },
  {
    key: "spend_wasters",
    label: "Spend Wasters",
    helper: "Terms, themes, and intents spending below break-even efficiency.",
  },
  {
    key: "negative_keywords",
    label: "Negative Keywords",
    helper: "Exact, phrase, and broad negative opportunities with reason and risk logic.",
  },
  {
    key: "ngram_waste",
    label: "N-Gram Waste",
    helper: "Repeated phrases creating inefficient spend across multiple queries.",
  },
  {
    key: "pdp_issues",
    label: "PDP / Offer Issues",
    helper: "High-interest terms failing after click. These should not be negatived first.",
  },
  {
    key: "scale",
    label: "Scale Signals",
    helper: "Profitable significant terms to isolate, feed, bid up, or scale.",
  },
  {
    key: "intent_brand",
    label: "Intent / Brand",
    helper: "Intent mix, brand vs non-brand, and marketplace/informational leakage.",
  },
  {
    key: "raw_terms",
    label: "Raw Terms",
    helper: "Cleaned searchable term table sorted by spend.",
  },
];

const GOOGLE = {
  blue: "#4285F4",
  red: "#EA4335",
  yellow: "#FBBC04",
  green: "#34A853",
};

function arr<T = AnyObj>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

function num(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: any, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function pick(row: AnyObj, keys: string[], fallback: any = "") {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return fallback;
}

function money(value: any) {
  return `₹${Math.round(num(value)).toLocaleString("en-IN")}`;
}

function int(value: any) {
  return Math.round(num(value)).toLocaleString("en-IN");
}

function x(value: any) {
  return `${num(value).toFixed(2)}x`;
}

function pct(value: any) {
  const n = num(value);
  return `${n > 1 ? n.toFixed(1) : (n * 100).toFixed(1)}%`;
}

function priorityRank(priority: any) {
  const p = str(priority);
  return p === "Critical" ? 0 : p === "High" ? 1 : p === "Medium" ? 2 : p === "Low" ? 3 : 9;
}

function getTerms(rec: AnyObj): string[] {
  return arr<string>(rec.affected_terms).length ? arr<string>(rec.affected_terms) : arr<string>(rec.terms);
}

function getMatchType(rec: AnyObj) {
  const raw = str(rec.match_type).toUpperCase();
  if (raw.includes("EXACT")) return "EXACT";
  if (raw.includes("PHRASE")) return "PHRASE";
  if (raw.includes("BROAD")) return "BROAD";
  if (raw.includes("NONE")) return "NONE";

  const type = str(rec.type).toLowerCase();
  if (type.includes("ngram")) return Number(rec.metadata?.n) === 1 ? "BROAD" : "PHRASE";
  if (type.includes("negative") || type.includes("zero") || type.includes("low_roas")) return "EXACT";
  if (type.includes("pdp") || type.includes("scale")) return "NONE";
  return "REVIEW";
}

function recMatchesTab(rec: AnyObj, tab: TabKey) {
  const type = str(rec.type).toLowerCase();
  const title = str(rec.title).toLowerCase();
  const reason = str(rec.reason).toLowerCase();

  if (tab === "brief") return true;

  if (tab === "spend_wasters") {
    return (
      type.includes("negative") ||
      type.includes("zero") ||
      type.includes("low_roas") ||
      type.includes("ngram") ||
      type.includes("intent_waste") ||
      title.includes("waste") ||
      reason.includes("below break-even")
    );
  }

  if (tab === "negative_keywords") {
    return type.includes("negative") || type.includes("zero") || type.includes("low_roas") || type.includes("ngram");
  }

  if (tab === "ngram_waste") return type.includes("ngram");
  if (tab === "pdp_issues") return type.includes("pdp") || type.includes("investigate_pdp");
  if (tab === "scale") return type.includes("scale");
  if (tab === "intent_brand") return type.includes("intent") || type.includes("brand") || title.includes("informational") || title.includes("marketplace");

  return false;
}

function exportCsv(filename: string, rows: AnyObj[]) {
  if (!rows.length) return;

  const headerSet = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      headerSet.add(key);
    });
  });

  const headers = Array.from(headerSet);

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          return `"${String(value).replaceAll('"', '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function flattenRecommendations(recommendations: AnyObj[]) {
  const rows: AnyObj[] = [];

  recommendations.forEach((rec) => {
    const terms = getTerms(rec);
    const base = {
      priority: str(rec.priority),
      type: str(rec.type),
      match_type: getMatchType(rec),
      severity: str(rec.severity),
      impact: num(rec.impact),
      reason: str(rec.reason),
      recommended_action: str(rec.recommended_action),
      title: str(rec.title),
      description: str(rec.description),
    };

    if (!terms.length) {
      rows.push({ ...base, keyword_or_phrase: "" });
      return;
    }

    terms.forEach((term) => {
      rows.push({ ...base, keyword_or_phrase: term });
    });
  });

  return rows;
}

function KpiCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue" | "red" | "green" | "yellow";
}) {
  const colors = {
    slate: "text-slate-950 dark:text-white",
    blue: "text-[#4285F4]",
    red: "text-[#EA4335]",
    green: "text-[#34A853]",
    yellow: "text-[#F29900]",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className={`mt-2 text-[24px] font-semibold tracking-[-0.04em] ${colors[tone]}`}>
        {value}
      </div>
    </div>
  );
}

function Pill({ children, color = "slate" }: { children: any; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white"
      style={color !== "slate" ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined}
    >
      {children}
    </span>
  );
}

function RecommendationsTable({ rows }: { rows: AnyObj[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/8 dark:text-slate-400">
        No high-confidence actions found for this section.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/8">
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 text-left text-[10px] uppercase tracking-[0.16em] text-slate-400 backdrop-blur dark:bg-slate-950/95">
            <tr>
              <th className="px-4 py-3 font-semibold">Priority</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Match</th>
              <th className="px-4 py-3 font-semibold">Keywords / Phrases</th>
              <th className="px-4 py-3 text-right font-semibold">Impact</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rec, index) => {
              const terms = getTerms(rec);
              return (
                <tr key={rec.id || index} className="border-t border-slate-100 align-top dark:border-white/10">
                  <td className="px-4 py-4">
                    <Pill color={str(rec.priority) === "Critical" ? GOOGLE.red : str(rec.priority) === "High" ? GOOGLE.yellow : GOOGLE.blue}>
                      {str(rec.priority, "Low")}
                    </Pill>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800 dark:text-white">
                    {str(rec.type, "action")}
                  </td>
                  <td className="px-4 py-4">
                    <Pill color={getMatchType(rec) === "EXACT" ? GOOGLE.blue : getMatchType(rec) === "PHRASE" ? GOOGLE.yellow : getMatchType(rec) === "BROAD" ? GOOGLE.red : GOOGLE.green}>
                      {getMatchType(rec)}
                    </Pill>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex max-w-[340px] flex-wrap gap-1.5">
                      {terms.slice(0, 8).map((term, i) => (
                        <span key={`${term}-${i}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200">
                          {term}
                        </span>
                      ))}
                      {terms.length > 8 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-white/10">
                          +{terms.length - 8}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-950 dark:text-white">
                    {money(rec.impact)}
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                    {str(rec.recommended_action, "Review manually")}
                  </td>
                  <td className="px-4 py-4 text-slate-500 dark:text-slate-400">
                    {str(rec.reason, str(rec.description)).slice(0, 180)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NgramTable({ rows }: { rows: AnyObj[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/8">
        No n-gram waste found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/8">
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 bg-slate-50/95 text-left text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:bg-slate-950/95">
            <tr>
              <th className="px-4 py-3">N-gram</th>
              <th className="px-4 py-3 text-right">Terms</th>
              <th className="px-4 py-3 text-right">Spend</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-right">ROAS</th>
              <th className="px-4 py-3 text-right">Waste</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 120).map((row, index) => (
              <tr key={`${row.ngram}-${index}`} className="border-t border-slate-100 dark:border-white/10">
                <td className="px-4 py-3 font-medium text-slate-950 dark:text-white">{str(row.ngram)}</td>
                <td className="px-4 py-3 text-right">{int(row.term_count)}</td>
                <td className="px-4 py-3 text-right">{money(row.cost)}</td>
                <td className="px-4 py-3 text-right">{money(row.revenue)}</td>
                <td className="px-4 py-3 text-right">{x(row.roas)}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(row.aggregate_wasted_spend || row.waste_score)}</td>
                <td className="px-4 py-3">
                  <Pill color={num(row.n) === 1 ? GOOGLE.red : GOOGLE.yellow}>
                    negative {num(row.n) === 1 ? "broad" : "phrase"}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TermsTable({ rows }: { rows: AnyObj[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/8">
        No search terms available.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/8">
      <div className="max-h-[540px] overflow-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="sticky top-0 bg-slate-50/95 text-left text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:bg-slate-950/95">
            <tr>
              <th className="px-4 py-3">Search term</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Intent</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3 text-right">Spend</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-right">ROAS</th>
              <th className="px-4 py-3 text-right">Conv.</th>
              <th className="px-4 py-3 text-right">Clicks</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((row, index) => (
              <tr key={`${row.search_term}-${index}`} className="border-t border-slate-100 dark:border-white/10">
                <td className="px-4 py-3 font-medium text-slate-950 dark:text-white">{str(row.search_term)}</td>
                <td className="px-4 py-3"><Pill color={str(row.tier) === "Drain" ? GOOGLE.red : str(row.tier) === "Star" ? GOOGLE.green : GOOGLE.blue}>{str(row.tier, "Untested")}</Pill></td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{str(row.intent)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{str(row.segment, row.is_brand ? "Brand" : "Non-brand")}</td>
                <td className="px-4 py-3 text-right">{money(row.cost)}</td>
                <td className="px-4 py-3 text-right">{money(row.revenue ?? row.conv_value)}</td>
                <td className="px-4 py-3 text-right">{x(row.roas)}</td>
                <td className="px-4 py-3 text-right">{num(row.conversions).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{int(row.clicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [fileName, setFileName] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("brief");
  const [chartMode, setChartMode] = useState<"category" | "intent">("intent");

  const data = result as AnyObj | null;
  const summary = (data?.summary || {}) as AnyObj;

  const recommendations = useMemo(() => {
    return arr<AnyObj>(data?.recommendations)
      .slice()
      .sort((a, b) => {
        const p = priorityRank(a.priority) - priorityRank(b.priority);
        if (p !== 0) return p;
        return num(b.impact) - num(a.impact);
      });
  }, [data]);

  const categorySummary = useMemo(() => arr<AnyObj>(data?.category_summary || data?.categories), [data]);
  const intentSummary = useMemo(() => arr<AnyObj>(data?.intent_summary || data?.intents), [data]);
  const terms = useMemo(() => arr<AnyObj>(data?.terms).slice().sort((a, b) => num(b.cost) - num(a.cost)), [data]);

  const ngramRows = useMemo(() => {
    const ngrams = data?.ngrams || {};
    const rows = [
      ...arr<AnyObj>(ngrams["1"]).map((r) => ({ ...r, n: 1 })),
      ...arr<AnyObj>(ngrams["2"]).map((r) => ({ ...r, n: 2 })),
      ...arr<AnyObj>(ngrams["3"]).map((r) => ({ ...r, n: 3 })),
    ];
    return rows.sort((a, b) => num(b.waste_score || b.aggregate_wasted_spend || b.cost) - num(a.waste_score || a.aggregate_wasted_spend || a.cost));
  }, [data]);

  const filteredRecommendations = useMemo(() => {
    if (activeTab === "brief") return recommendations.slice(0, 8);
    return recommendations.filter((rec) => recMatchesTab(rec, activeTab));
  }, [recommendations, activeTab]);

  const chartData = useMemo(() => {
    const source = chartMode === "intent" ? intentSummary : categorySummary;
    return source.slice(0, 8).map((row) => ({
      name: str(pick(row, ["intent", "category", "name", "label"], "Unknown")),
      spend: num(pick(row, ["cost", "spend", "total_cost"], 0)),
      revenue: num(pick(row, ["revenue", "conv_value", "total_revenue"], 0)),
    }));
  }, [chartMode, intentSummary, categorySummary]);

  const tabCounts = useMemo(() => {
    return {
      brief: recommendations.length,
      spend_wasters: recommendations.filter((r) => recMatchesTab(r, "spend_wasters")).length,
      negative_keywords: recommendations.filter((r) => recMatchesTab(r, "negative_keywords")).length,
      ngram_waste: recommendations.filter((r) => recMatchesTab(r, "ngram_waste")).length + ngramRows.length,
      pdp_issues: recommendations.filter((r) => recMatchesTab(r, "pdp_issues")).length,
      scale: recommendations.filter((r) => recMatchesTab(r, "scale")).length,
      intent_brand: recommendations.filter((r) => recMatchesTab(r, "intent_brand")).length + intentSummary.length,
      raw_terms: terms.length,
    } as Record<TabKey, number>;
  }, [recommendations, ngramRows, intentSummary, terms]);

  if (!result) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.04em]">Search Term Analyzer</h1>
            <p className="mt-1 text-sm text-slate-500">Upload a Google Shopping search-terms report for operator-grade actions.</p>
          </div>
          <ThemeToggle />
        </header>

        <FileUpload
          onResult={(res, name) => {
            setResult(res);
            setFileName(name);
            setActiveTab("brief");
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(66,133,244,0.10),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(52,168,83,0.08),transparent_26%)]" />

      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/88 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.04em]">Search Term Analyzer</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{fileName}</span>
              <span>·</span>
              <span>{int(summary.unique_terms || terms.length)} terms analyzed</span>
              {summary.break_even_roas ? (
                <>
                  <span>·</span>
                  <span>Break-even {x(summary.break_even_roas)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => exportCsv("operator-action-sheet.csv", flattenRecommendations(recommendations))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              Export actions
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setFileName("");
              }}
              className="rounded-xl bg-[#4285F4] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#3367d6]"
            >
              New upload
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <KpiCard label="Spend" value={money(summary.total_cost)} />
          <KpiCard label="Revenue" value={money(summary.total_revenue)} tone="green" />
          <KpiCard label="ROAS" value={x(summary.blended_roas)} tone={num(summary.blended_roas) >= num(summary.break_even_roas, 2.5) ? "green" : "red"} />
          <KpiCard label="CPA" value={money(summary.blended_cpa)} tone="yellow" />
          <KpiCard label="Clicks" value={int(summary.total_clicks)} tone="blue" />
          <KpiCard label="Conv." value={num(summary.total_conversions).toFixed(2)} />
          <KpiCard label="Wasted" value={money(summary.wasted_spend)} tone="red" />
          <KpiCard label="NB ROAS" value={x(summary.non_brand_roas || summary.true_acquisition_roas)} tone="blue" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dynamic view</p>
                <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.035em]">Spend vs revenue</h2>
              </div>
              <select
                value={chartMode}
                onChange={(e) => setChartMode(e.target.value as "category" | "intent")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
              >
                <option value="intent">By intent</option>
                <option value="category">By category</option>
              </select>
            </div>

            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.25)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} angle={-18} textAnchor="end" height={54} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(value: any) => money(value)} />
                  <Bar dataKey="spend" fill={GOOGLE.blue} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="revenue" fill={GOOGLE.green} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Navigation</p>
                <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.035em]">Analytical tabs</h2>
              </div>

              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as TabKey)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none dark:border-white/10 dark:bg-white/10 dark:text-white"
              >
                {TABS.map((tab) => (
                  <option key={tab.key} value={tab.key}>
                    {tab.label} ({tabCounts[tab.key] || 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={[
                      "rounded-2xl border px-3 py-3 text-left transition",
                      active
                        ? "border-[#4285F4]/40 bg-[#4285F4]/10 text-slate-950 dark:text-white"
                        : "border-slate-200 bg-white/70 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-white/8 dark:text-slate-300",
                    ].join(" ")}
                  >
                    <div className="text-[12px] font-semibold tracking-[-0.02em]">{tab.label}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{tabCounts[tab.key] || 0} items</div>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {TABS.find((tab) => tab.key === activeTab)?.helper}
            </p>
          </div>
        </section>

        <section>
          {activeTab === "brief" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.72fr]">
              <RecommendationsTable rows={filteredRecommendations} />

              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/8">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Efficiency diagnosis</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Break-even ROAS</span>
                      <strong>{x(summary.break_even_roas || 2.5)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Brand ROAS</span>
                      <strong>{x(summary.brand_roas)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Non-brand ROAS</span>
                      <strong>{x(summary.non_brand_roas || summary.true_acquisition_roas)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Wasted spend %</span>
                      <strong>{pct(summary.wasted_spend_pct)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Significant terms</span>
                      <strong>{int(summary.significant_terms)}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => exportCsv("spend-wasters-and-negative-keywords.csv", flattenRecommendations(recommendations.filter((r) => recMatchesTab(r, "spend_wasters"))))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white"
                >
                  Export spend wasters
                </button>
              </div>
            </div>
          ) : activeTab === "ngram_waste" ? (
            <NgramTable rows={ngramRows} />
          ) : activeTab === "raw_terms" ? (
            <TermsTable rows={terms} />
          ) : activeTab === "intent_brand" ? (
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Intent mix</p>
                <div className="mt-4 space-y-2">
                  {intentSummary.map((row, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/8">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{str(pick(row, ["intent", "name", "label"], "Unknown"))}</span>
                        <span className="font-semibold">{x(pick(row, ["roas", "blended_roas"], 0))}</span>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-slate-500">
                        <span>{money(pick(row, ["cost", "spend", "total_cost"], 0))} spend</span>
                        <span>{money(pick(row, ["revenue", "conv_value", "total_revenue"], 0))} revenue</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <RecommendationsTable rows={filteredRecommendations} />
            </div>
          ) : (
            <RecommendationsTable rows={filteredRecommendations} />
          )}
        </section>
      </div>
    </main>
  );
}
