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

const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: "brief", label: "Action Brief", short: "Brief" },
  { key: "spend_wasters", label: "Spend Wasters", short: "Wasters" },
  { key: "negative_keywords", label: "Negative Keywords", short: "Negatives" },
  { key: "ngram_waste", label: "N-Gram Waste", short: "N-Grams" },
  { key: "pdp_issues", label: "PDP / Offer Issues", short: "PDP Issues" },
  { key: "scale", label: "Scale Signals", short: "Scale" },
  { key: "intent_brand", label: "Intent / Brand", short: "Intent" },
  { key: "raw_terms", label: "Raw Terms", short: "Terms" },
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
  if (n <= 1) return `${(n * 100).toFixed(1)}%`;
  return `${n.toFixed(1)}%`;
}

function priorityRank(priority: any) {
  const p = str(priority);
  if (p === "Critical") return 0;
  if (p === "High") return 1;
  if (p === "Medium") return 2;
  if (p === "Low") return 3;
  return 9;
}

function getTerms(rec: AnyObj): string[] {
  const affected = arr<string>(rec.affected_terms);
  if (affected.length) return affected;
  return arr<string>(rec.terms);
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
    return (
      type.includes("negative") ||
      type.includes("zero") ||
      type.includes("low_roas") ||
      type.includes("ngram")
    );
  }

  if (tab === "ngram_waste") return type.includes("ngram");
  if (tab === "pdp_issues") return type.includes("pdp") || type.includes("investigate_pdp");
  if (tab === "scale") return type.includes("scale");
  if (tab === "intent_brand") {
    return (
      type.includes("intent") ||
      type.includes("brand") ||
      title.includes("informational") ||
      title.includes("marketplace")
    );
  }

  return false;
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

function exportCsv(filename: string, rows: AnyObj[]) {
  if (!rows.length) return;

  const headerSet = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => headerSet.add(key));
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

function KpiCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "blue" | "red" | "green" | "yellow";
}) {
  return (
    <div className="sta-kpi">
      <div className="sta-kpi-label">{label}</div>
      <div className={`sta-kpi-value tone-${tone}`}>{value}</div>
    </div>
  );
}

function Pill({
  children,
  color = GOOGLE.blue,
}: {
  children: any;
  color?: string;
}) {
  return (
    <span className="sta-pill" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
      {children}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="sta-empty">
      <div className="sta-empty-icon">✓</div>
      <div className="sta-empty-title">No {label.toLowerCase()} found</div>
      <div className="sta-empty-copy">
        The engine did not find high-confidence actions for this section using the current thresholds.
      </div>
    </div>
  );
}

function RecommendationsTable({ rows, label }: { rows: AnyObj[]; label: string }) {
  if (!rows.length) return <EmptyState label={label} />;

  return (
    <div className="sta-table-wrap">
      <div className="sta-table-scroll">
        <table className="sta-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Type</th>
              <th>Match</th>
              <th>Keywords / Phrases</th>
              <th className="right">Impact</th>
              <th>Action</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rec, index) => {
              const terms = getTerms(rec);
              const match = getMatchType(rec);
              const priority = str(rec.priority, "Low");

              return (
                <tr key={rec.id || `${rec.type}-${index}`}>
                  <td>
                    <Pill
                      color={
                        priority === "Critical"
                          ? GOOGLE.red
                          : priority === "High"
                          ? GOOGLE.yellow
                          : GOOGLE.blue
                      }
                    >
                      {priority}
                    </Pill>
                  </td>
                  <td className="strong">{str(rec.type, "action")}</td>
                  <td>
                    <Pill
                      color={
                        match === "EXACT"
                          ? GOOGLE.blue
                          : match === "PHRASE"
                          ? GOOGLE.yellow
                          : match === "BROAD"
                          ? GOOGLE.red
                          : GOOGLE.green
                      }
                    >
                      {match}
                    </Pill>
                  </td>
                  <td>
                    <div className="sta-term-list">
                      {terms.slice(0, 8).map((term, i) => (
                        <span key={`${term}-${i}`} className="sta-term-chip">
                          {term}
                        </span>
                      ))}
                      {terms.length > 8 ? (
                        <span className="sta-term-chip muted">+{terms.length - 8}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="right strong">{money(rec.impact)}</td>
                  <td>{str(rec.recommended_action, "Review manually")}</td>
                  <td>{str(rec.reason, str(rec.description)).slice(0, 170)}</td>
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
  if (!rows.length) return <EmptyState label="N-gram waste" />;

  return (
    <div className="sta-table-wrap">
      <div className="sta-table-scroll">
        <table className="sta-table">
          <thead>
            <tr>
              <th>N-gram</th>
              <th className="right">Terms</th>
              <th className="right">Spend</th>
              <th className="right">Revenue</th>
              <th className="right">ROAS</th>
              <th className="right">Waste</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 150).map((row, index) => (
              <tr key={`${row.ngram}-${index}`}>
                <td className="strong">{str(row.ngram)}</td>
                <td className="right">{int(row.term_count)}</td>
                <td className="right">{money(row.cost)}</td>
                <td className="right">{money(row.revenue)}</td>
                <td className="right">{x(row.roas)}</td>
                <td className="right strong">{money(row.aggregate_wasted_spend || row.waste_score)}</td>
                <td>
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
  if (!rows.length) return <EmptyState label="search terms" />;

  return (
    <div className="sta-table-wrap">
      <div className="sta-table-scroll">
        <table className="sta-table">
          <thead>
            <tr>
              <th>Search term</th>
              <th>Tier</th>
              <th>Intent</th>
              <th>Segment</th>
              <th className="right">Spend</th>
              <th className="right">Revenue</th>
              <th className="right">ROAS</th>
              <th className="right">Conv.</th>
              <th className="right">Clicks</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((row, index) => (
              <tr key={`${row.search_term}-${index}`}>
                <td className="strong">{str(row.search_term)}</td>
                <td>
                  <Pill
                    color={
                      str(row.tier) === "Drain"
                        ? GOOGLE.red
                        : str(row.tier) === "Star"
                        ? GOOGLE.green
                        : GOOGLE.blue
                    }
                  >
                    {str(row.tier, "Untested")}
                  </Pill>
                </td>
                <td>{str(row.intent)}</td>
                <td>{str(row.segment, row.is_brand ? "Brand" : "Non-brand")}</td>
                <td className="right">{money(row.cost)}</td>
                <td className="right">{money(row.revenue ?? row.conv_value)}</td>
                <td className="right">{x(row.roas)}</td>
                <td className="right">{num(row.conversions).toFixed(2)}</td>
                <td className="right">{int(row.clicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IntentPanel({
  intentSummary,
  rows,
}: {
  intentSummary: AnyObj[];
  rows: AnyObj[];
}) {
  return (
    <div className="sta-two-col">
      <div className="sta-panel">
        <div className="sta-section-kicker">Intent mix</div>
        <div className="sta-intent-list">
          {intentSummary.map((row, index) => (
            <div key={index} className="sta-intent-row">
              <div>
                <div className="sta-intent-name">
                  {str(pick(row, ["intent", "name", "label"], "Unknown"))}
                </div>
                <div className="sta-intent-meta">
                  {money(pick(row, ["cost", "spend", "total_cost"], 0))} spend ·{" "}
                  {money(pick(row, ["revenue", "conv_value", "total_revenue"], 0))} revenue
                </div>
              </div>
              <div className="sta-intent-roas">
                {x(pick(row, ["roas", "blended_roas"], 0))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <RecommendationsTable rows={rows} label="intent / brand actions" />
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

  const terms = useMemo(() => {
    return arr<AnyObj>(data?.terms)
      .slice()
      .sort((a, b) => num(b.cost) - num(a.cost));
  }, [data]);

  const ngramRows = useMemo<AnyObj[]>(() => {
    const ngrams = (data?.ngrams || {}) as AnyObj;

    const rows: AnyObj[] = [
      ...arr<AnyObj>(ngrams["1"]).map((r): AnyObj => ({ ...r, n: 1 })),
      ...arr<AnyObj>(ngrams["2"]).map((r): AnyObj => ({ ...r, n: 2 })),
      ...arr<AnyObj>(ngrams["3"]).map((r): AnyObj => ({ ...r, n: 3 })),
    ];

    return rows.sort(
      (a, b) =>
        num(b.waste_score || b.aggregate_wasted_spend || b.cost) -
        num(a.waste_score || a.aggregate_wasted_spend || a.cost)
    );
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
      <main className="sta-app-shell">
        <style jsx global>{globalStyles}</style>

        <header className="sta-home-header">
          <div>
            <h1>Search Term Analyzer</h1>
            <p>Upload a Google Shopping search-terms report for operator-grade actions.</p>
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
    <main className="sta-app-shell">
      <style jsx global>{globalStyles}</style>

      <header className="sta-result-header">
        <div className="sta-result-header-inner">
          <div className="sta-result-title">
            <h1>Search Term Analyzer</h1>
            <p>
              {fileName} · {int(summary.unique_terms || terms.length)} terms analyzed
              {summary.break_even_roas ? ` · Break-even ${x(summary.break_even_roas)}` : ""}
            </p>
          </div>

          <div className="sta-header-actions">
            <button
              type="button"
              className="sta-secondary-button"
              onClick={() => exportCsv("operator-action-sheet.csv", flattenRecommendations(recommendations))}
            >
              Export actions
            </button>

            <button
              type="button"
              className="sta-primary-button"
              onClick={() => {
                setResult(null);
                setFileName("");
              }}
            >
              New upload
            </button>

            <ThemeToggle />
          </div>
        </div>

        <nav className="sta-tab-bar">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={active ? "active" : ""}
              >
                <span>{tab.short}</span>
                <em>{tabCounts[tab.key] || 0}</em>
              </button>
            );
          })}
        </nav>
      </header>

      <div className="sta-result-body">
        <section className="sta-kpi-grid">
          <KpiCard label="Spend" value={money(summary.total_cost)} />
          <KpiCard label="Revenue" value={money(summary.total_revenue)} tone="green" />
          <KpiCard
            label="ROAS"
            value={x(summary.blended_roas)}
            tone={num(summary.blended_roas) >= num(summary.break_even_roas, 2.5) ? "green" : "red"}
          />
          <KpiCard label="CPA" value={money(summary.blended_cpa)} tone="yellow" />
          <KpiCard label="Clicks" value={int(summary.total_clicks)} tone="blue" />
          <KpiCard label="Conv." value={num(summary.total_conversions).toFixed(2)} />
          <KpiCard label="Wasted" value={money(summary.wasted_spend)} tone="red" />
          <KpiCard label="NB ROAS" value={x(summary.non_brand_roas || summary.true_acquisition_roas)} tone="blue" />
        </section>

        <section className="sta-top-grid">
          <div className="sta-panel">
            <div className="sta-panel-head">
              <div>
                <div className="sta-section-kicker">Dynamic view</div>
                <h2>Spend vs revenue</h2>
              </div>

              <select value={chartMode} onChange={(e) => setChartMode(e.target.value as "category" | "intent")}>
                <option value="intent">By intent</option>
                <option value="category">By category</option>
              </select>
            </div>

            <div className="sta-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sta-chart-grid)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--sta-muted)" }}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--sta-muted)" }}
                    tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => money(value)}
                    contentStyle={{
                      background: "var(--sta-panel-2)",
                      border: "1px solid var(--sta-border)",
                      borderRadius: 14,
                      color: "var(--sta-text)",
                    }}
                  />
                  <Bar dataKey="spend" fill={GOOGLE.blue} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="revenue" fill={GOOGLE.green} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="sta-panel">
            <div className="sta-panel-head">
              <div>
                <div className="sta-section-kicker">Selected analysis</div>
                <h2>{TABS.find((tab) => tab.key === activeTab)?.label}</h2>
              </div>

              <select value={activeTab} onChange={(e) => setActiveTab(e.target.value as TabKey)}>
                {TABS.map((tab) => (
                  <option key={tab.key} value={tab.key}>
                    {tab.label} ({tabCounts[tab.key] || 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="sta-mini-brief">
              <div>
                <span>Current view</span>
                <strong>{tabCounts[activeTab] || 0}</strong>
              </div>
              <div>
                <span>Actions</span>
                <strong>{recommendations.length}</strong>
              </div>
              <div>
                <span>Terms</span>
                <strong>{int(terms.length)}</strong>
              </div>
            </div>

            <p className="sta-panel-copy">
              Use the header tabs to switch between operator decisions. Export actions when the current view is ready.
            </p>
          </div>
        </section>

        <section className="sta-main-section">
          {activeTab === "ngram_waste" ? (
            <NgramTable rows={ngramRows} />
          ) : activeTab === "raw_terms" ? (
            <TermsTable rows={terms} />
          ) : activeTab === "intent_brand" ? (
            <IntentPanel intentSummary={intentSummary} rows={filteredRecommendations} />
          ) : activeTab === "brief" ? (
            <div className="sta-two-col">
              <RecommendationsTable rows={filteredRecommendations} label="action brief" />

              <div className="sta-side-stack">
                <div className="sta-panel">
                  <div className="sta-section-kicker">Efficiency diagnosis</div>
                  <div className="sta-diagnosis">
                    <div><span>Break-even ROAS</span><strong>{x(summary.break_even_roas || 2.5)}</strong></div>
                    <div><span>Brand ROAS</span><strong>{x(summary.brand_roas)}</strong></div>
                    <div><span>Non-brand ROAS</span><strong>{x(summary.non_brand_roas || summary.true_acquisition_roas)}</strong></div>
                    <div><span>Wasted spend %</span><strong>{pct(summary.wasted_spend_pct)}</strong></div>
                    <div><span>Significant terms</span><strong>{int(summary.significant_terms)}</strong></div>
                  </div>
                </div>

                <button
                  type="button"
                  className="sta-wide-button"
                  onClick={() =>
                    exportCsv(
                      "spend-wasters-and-negative-keywords.csv",
                      flattenRecommendations(recommendations.filter((r) => recMatchesTab(r, "spend_wasters")))
                    )
                  }
                >
                  Export spend wasters
                </button>
              </div>
            </div>
          ) : (
            <RecommendationsTable rows={filteredRecommendations} label={TABS.find((tab) => tab.key === activeTab)?.label || "actions"} />
          )}
        </section>
      </div>
    </main>
  );
}

const globalStyles = `
:root,
html[data-theme="light"] {
  --sta-bg: #f8fafc;
  --sta-bg-2: #eef3f8;
  --sta-panel: rgba(255, 255, 255, 0.82);
  --sta-panel-2: #ffffff;
  --sta-panel-3: #f8fafc;
  --sta-text: #0f172a;
  --sta-text-2: #334155;
  --sta-text-3: #64748b;
  --sta-muted: #94a3b8;
  --sta-border: rgba(15, 23, 42, 0.1);
  --sta-border-2: rgba(15, 23, 42, 0.16);
  --sta-shadow: 0 14px 36px rgba(15, 23, 42, 0.07);
  --sta-chart-grid: rgba(148, 163, 184, 0.22);
}

html[data-theme="dark"] {
  --sta-bg: #050816;
  --sta-bg-2: #07101f;
  --sta-panel: rgba(15, 23, 42, 0.82);
  --sta-panel-2: #111827;
  --sta-panel-3: #0b1220;
  --sta-text: #f8fafc;
  --sta-text-2: #dbe4ef;
  --sta-text-3: #a7b4c6;
  --sta-muted: #7b8aa1;
  --sta-border: rgba(148, 163, 184, 0.18);
  --sta-border-2: rgba(226, 232, 240, 0.28);
  --sta-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
  --sta-chart-grid: rgba(148, 163, 184, 0.18);
}

body {
  background: var(--sta-bg) !important;
  font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}

.font-serif,
.display {
  font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}

.sta-app-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 0%, rgba(66, 133, 244, 0.10), transparent 28%),
    radial-gradient(circle at 82% 0%, rgba(52, 168, 83, 0.08), transparent 26%),
    var(--sta-bg);
  color: var(--sta-text);
}

.sta-home-header {
  max-width: 1280px;
  margin: 0 auto;
  padding: 22px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sta-home-header h1,
.sta-result-title h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.1;
  letter-spacing: -0.04em;
  font-weight: 650;
  color: var(--sta-text);
}

.sta-home-header p,
.sta-result-title p {
  margin: 7px 0 0;
  color: var(--sta-text-3);
  font-size: 13px;
}

.sta-result-header {
  position: sticky;
  top: 0;
  z-index: 40;
  border-bottom: 1px solid var(--sta-border);
  background: color-mix(in srgb, var(--sta-bg) 88%, transparent);
  backdrop-filter: blur(22px);
}

.sta-result-header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px 24px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.sta-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sta-primary-button,
.sta-secondary-button,
.sta-wide-button {
  border: 1px solid var(--sta-border);
  border-radius: 13px;
  padding: 9px 13px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: transform 0.14s ease, background 0.14s ease, border-color 0.14s ease;
}

.sta-primary-button {
  background: #4285f4;
  color: white;
  border-color: rgba(66, 133, 244, 0.55);
}

.sta-secondary-button,
.sta-wide-button {
  background: var(--sta-panel-2);
  color: var(--sta-text);
}

.sta-primary-button:hover,
.sta-secondary-button:hover,
.sta-wide-button:hover {
  transform: translateY(-1px);
  border-color: var(--sta-border-2);
}

.sta-tab-bar {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  overflow-x: auto;
}

.sta-tab-bar button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--sta-border);
  background: var(--sta-panel);
  color: var(--sta-text-2);
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.sta-tab-bar button.active {
  background: rgba(66, 133, 244, 0.12);
  border-color: rgba(66, 133, 244, 0.42);
  color: var(--sta-text);
}

.sta-tab-bar em {
  font-style: normal;
  color: var(--sta-muted);
  font-size: 11px;
}

.sta-result-body {
  max-width: 1280px;
  margin: 0 auto;
  padding: 18px 24px 60px;
}

.sta-kpi-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 10px;
}

.sta-kpi {
  border: 1px solid var(--sta-border);
  background: var(--sta-panel);
  color: var(--sta-text);
  border-radius: 18px;
  padding: 14px;
  box-shadow: var(--sta-shadow);
}

.sta-kpi-label {
  color: var(--sta-muted);
  font-size: 10px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.17em;
}

.sta-kpi-value {
  margin-top: 8px;
  font-size: 24px;
  line-height: 1;
  letter-spacing: -0.04em;
  font-weight: 650;
  color: var(--sta-text);
}

.tone-blue { color: #4285F4; }
.tone-red { color: #EA4335; }
.tone-green { color: #34A853; }
.tone-yellow { color: #F29900; }

.sta-top-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 14px;
}

.sta-panel {
  border: 1px solid var(--sta-border);
  background: var(--sta-panel);
  color: var(--sta-text);
  border-radius: 20px;
  padding: 16px;
  box-shadow: var(--sta-shadow);
}

.sta-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.sta-section-kicker {
  color: var(--sta-muted);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.sta-panel h2 {
  margin: 6px 0 0;
  color: var(--sta-text);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.035em;
}

.sta-panel select {
  border: 1px solid var(--sta-border);
  background: var(--sta-panel-2);
  color: var(--sta-text);
  border-radius: 12px;
  padding: 8px 10px;
  font-size: 12px;
  outline: none;
}

.sta-chart {
  height: 210px;
}

.sta-mini-brief {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.sta-mini-brief div {
  border: 1px solid var(--sta-border);
  background: var(--sta-panel-2);
  border-radius: 15px;
  padding: 12px;
}

.sta-mini-brief span {
  display: block;
  color: var(--sta-muted);
  font-size: 10px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.sta-mini-brief strong {
  display: block;
  margin-top: 5px;
  color: var(--sta-text);
  font-size: 22px;
  letter-spacing: -0.04em;
}

.sta-panel-copy {
  margin: 12px 0 0;
  color: var(--sta-text-3);
  font-size: 13px;
  line-height: 1.55;
}

.sta-main-section {
  margin-top: 14px;
}

.sta-two-col {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.75fr);
  gap: 14px;
}

.sta-side-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sta-wide-button {
  width: 100%;
  padding: 13px 16px;
}

.sta-diagnosis {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.sta-diagnosis div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--sta-text-3);
  font-size: 13px;
}

.sta-diagnosis strong {
  color: var(--sta-text);
}

.sta-table-wrap {
  border: 1px solid var(--sta-border);
  background: var(--sta-panel);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--sta-shadow);
}

.sta-table-scroll {
  max-height: 560px;
  overflow: auto;
}

.sta-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 13px;
  color: var(--sta-text-2);
}

.sta-table thead {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--sta-panel-2);
}

.sta-table th {
  padding: 13px 14px;
  text-align: left;
  color: var(--sta-muted);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--sta-border);
}

.sta-table td {
  padding: 14px;
  border-top: 1px solid var(--sta-border);
  vertical-align: top;
  color: var(--sta-text-2);
}

.sta-table .strong {
  color: var(--sta-text);
  font-weight: 600;
}

.sta-table .right {
  text-align: right;
}

.sta-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--sta-border);
  background: var(--sta-panel-2);
  color: var(--sta-text-2);
  border-radius: 999px;
  padding: 6px 9px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.sta-term-list {
  display: flex;
  max-width: 350px;
  flex-wrap: wrap;
  gap: 6px;
}

.sta-term-chip {
  display: inline-flex;
  background: var(--sta-panel-2);
  border: 1px solid var(--sta-border);
  color: var(--sta-text-2);
  border-radius: 999px;
  padding: 5px 8px;
  font-size: 11px;
}

.sta-term-chip.muted {
  color: var(--sta-muted);
}

.sta-empty {
  border: 1px solid var(--sta-border);
  background: var(--sta-panel);
  border-radius: 20px;
  padding: 42px 24px;
  text-align: center;
  color: var(--sta-text-3);
  box-shadow: var(--sta-shadow);
}

.sta-empty-icon {
  margin: 0 auto 12px;
  display: grid;
  place-items: center;
  height: 38px;
  width: 38px;
  border-radius: 999px;
  background: rgba(52, 168, 83, 0.12);
  color: #34A853;
}

.sta-empty-title {
  color: var(--sta-text);
  font-size: 18px;
  font-weight: 650;
}

.sta-empty-copy {
  margin: 8px auto 0;
  max-width: 520px;
  font-size: 13px;
  line-height: 1.6;
}

.sta-intent-list {
  display: grid;
  gap: 9px;
  margin-top: 14px;
}

.sta-intent-row {
  border: 1px solid var(--sta-border);
  background: var(--sta-panel-2);
  border-radius: 15px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.sta-intent-name {
  color: var(--sta-text);
  font-weight: 650;
}

.sta-intent-meta {
  margin-top: 4px;
  color: var(--sta-text-3);
  font-size: 12px;
}

.sta-intent-roas {
  color: var(--sta-text);
  font-weight: 700;
}

@media (max-width: 1180px) {
  .sta-kpi-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .sta-top-grid,
  .sta-two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .sta-result-header-inner {
    align-items: flex-start;
    flex-direction: column;
  }

  .sta-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sta-top-grid {
    grid-template-columns: 1fr;
  }

  .sta-mini-brief {
    grid-template-columns: 1fr;
  }
}
`;
