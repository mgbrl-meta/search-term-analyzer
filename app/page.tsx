"use client";

import { useMemo, useState } from "react";
import FileUpload from "@/components/FileUpload";
import ThemeToggle from "@/components/ThemeToggle";
import type { AnalyzeResponse } from "@/types/api";

type AnyObj = Record<string, any>;

type TabKey =
  | "waste_spender"
  | "spend_mix"
  | "fragmentation"
  | "pattern_waste"
  | "kill_list"
  | "watch_list"
  | "winners"
  | "action_plan";

const TABS: { key: TabKey; label: string }[] = [
  { key: "waste_spender", label: "Waste Spender" },
  { key: "spend_mix", label: "Spend Mix" },
  { key: "fragmentation", label: "Fragmentation" },
  { key: "pattern_waste", label: "Pattern Waste" },
  { key: "kill_list", label: "Kill List" },
  { key: "watch_list", label: "Watch List" },
  { key: "winners", label: "Winners" },
  { key: "action_plan", label: "Action Plan" },
];

const GOOGLE = {
  blue: "#4285F4",
  red: "#EA4335",
  yellow: "#FBBC04",
  green: "#34A853",
};

const COMPETITORS = [
  "traya",
  "olaplex",
  "anomaly",
  "ybera",
  "loreal",
  "krone",
  "mamaearth",
  "minimalist",
  "wishcare",
  "bare anatomy",
  "plum",
  "biotique",
  "wow",
];

const MARKETPLACES = ["amazon", "flipkart", "nykaa", "myntra", "meesho", "snapdeal"];

const OFF_PRODUCT = [
  "oil",
  "serum",
  "conditioner",
  "lotion",
  "cream",
  "gel",
  "soap",
  "face wash",
  "capsule",
  "gummies",
  "hair colour",
  "hair color",
];

const INFO_WORDS = [
  "how to",
  "home remedy",
  "remedy",
  "naturally",
  "get rid",
  "cure",
  "why",
  "what causes",
  "at home",
  "meaning",
  "benefits",
];

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

function money(value: any) {
  return `₹${Math.round(num(value)).toLocaleString("en-IN")}`;
}

function int(value: any) {
  return Math.round(num(value)).toLocaleString("en-IN");
}

function x(value: any) {
  return `${num(value).toFixed(2)}x`;
}

function syntax(term: string, matchType: "exact" | "phrase" | "broad") {
  const clean = term.trim();
  if (!clean) return "";
  if (matchType === "exact") return `[${clean}]`;
  if (matchType === "phrase") return `"${clean}"`;
  return clean;
}

function classifyTerm(termRaw: string, conversions = 0) {
  const term = termRaw.toLowerCase();

  if (conversions > 0) return "Converters";
  if (MARKETPLACES.some((w) => term.includes(w))) return "Marketplace";
  if (COMPETITORS.some((w) => term.includes(w))) return "Competitor";
  if (INFO_WORDS.some((w) => term.includes(w))) return "Informational";
  if (OFF_PRODUCT.some((w) => term.includes(w))) return "Off-product";
  if (term.includes("hair care") || term.includes("hair products") || term.includes("best hair")) {
    return "Generic hair";
  }
  return "Core";
}

function exportCsv(filename: string, rows: AnyObj[]) {
  if (!rows.length) return;

  const headerSet = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => headerSet.add(key)));
  const headers = Array.from(headerSet);

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
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

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="wr-kpi">
      <span>{label}</span>
      <strong className={`tone-${tone}`}>{value}</strong>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  meta,
  color,
}: {
  label: string;
  value: number;
  max: number;
  meta?: string;
  color: string;
}) {
  const width = max > 0 ? Math.max(3, (value / max) * 100) : 0;

  return (
    <div className="wr-bar-row">
      <div className="wr-bar-label">
        <span>{label}</span>
        <em>{meta}</em>
      </div>
      <div className="wr-bar-track">
        <i style={{ width: `${width}%`, background: color }} />
      </div>
      <strong style={{ color }}>{money(value)}</strong>
    </div>
  );
}

function DataTable({
  rows,
  columns,
  empty,
}: {
  rows: AnyObj[];
  columns: { key: string; label: string; right?: boolean; render?: (row: AnyObj) => any }[];
  empty: string;
}) {
  if (!rows.length) {
    return (
      <div className="wr-empty">
        <strong>No data found</strong>
        <p>{empty}</p>
      </div>
    );
  }

  return (
    <div className="wr-table-wrap">
      <table className="wr-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.right ? "right" : ""}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((col) => (
                <td key={col.key} className={col.right ? "right" : ""}>
                  {col.render ? col.render(row) : str(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyBox({
  text,
  onCopy,
}: {
  text: string;
  onCopy: () => void;
}) {
  return (
    <div className="wr-copy-card">
      <div className="wr-card-head">
        <div>
          <span>Copy-ready Google Ads negatives</span>
          <h2>Negative keyword syntax</h2>
        </div>
        <button type="button" onClick={onCopy} disabled={!text}>
          Copy list
        </button>
      </div>
      <pre>{text || "No keywords in this view."}</pre>
    </div>
  );
}

function PageContent({
  result,
  fileName,
  onNewUpload,
}: {
  result: AnalyzeResponse;
  fileName: string;
  onNewUpload: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("waste_spender");
  const [threshold, setThreshold] = useState(100);
  const [matchType, setMatchType] = useState<"exact" | "phrase" | "broad">("exact");

  const data = result as AnyObj;
  const summary = (data.summary || {}) as AnyObj;

  const terms = useMemo(() => {
    return arr<AnyObj>(data.terms)
      .slice()
      .map((row) => {
        const searchTerm = str(row.search_term);
        const conversions = num(row.conversions);
        const category = classifyTerm(searchTerm, conversions);
        return {
          ...row,
          search_term: searchTerm,
          cost: num(row.cost),
          clicks: num(row.clicks),
          conversions,
          revenue: num(row.revenue ?? row.conv_value),
          roas: num(row.roas),
          category,
        };
      })
      .sort((a, b) => num(b.cost) - num(a.cost));
  }, [data]);

  const recommendations = useMemo(() => arr<AnyObj>(data.recommendations), [data]);

  const ngramRows = useMemo<AnyObj[]>(() => {
    const ngrams = (data.ngrams || {}) as AnyObj;

    return [
      ...arr<AnyObj>(ngrams["1"]).map((r): AnyObj => ({ ...r, n: 1 })),
      ...arr<AnyObj>(ngrams["2"]).map((r): AnyObj => ({ ...r, n: 2 })),
      ...arr<AnyObj>(ngrams["3"]).map((r): AnyObj => ({ ...r, n: 3 })),
    ]
      .map((row) => ({
        ...row,
        cost: num(row.cost),
        clicks: num(row.clicks),
        conversions: num(row.conversions),
        revenue: num(row.revenue ?? row.conv_value),
        roas: num(row.roas),
        waste: num(row.aggregate_wasted_spend || row.waste_score || row.cost),
      }))
      .sort((a, b) => num(b.waste) - num(a.waste));
  }, [data]);

  const wasteRows = useMemo(() => {
    return terms.filter((row) => num(row.cost) >= threshold && num(row.conversions) === 0);
  }, [terms, threshold]);

  const negativeLines = useMemo(() => {
    return wasteRows
      .map((row) => syntax(str(row.search_term), matchType))
      .filter(Boolean)
      .join("\n");
  }, [wasteRows, matchType]);

  const spendMix = useMemo(() => {
    const map = new Map<string, { category: string; spend: number; clicks: number; terms: number; conversions: number; revenue: number }>();

    terms.forEach((row) => {
      const category = str(row.category, "Unknown");
      const current = map.get(category) || {
        category,
        spend: 0,
        clicks: 0,
        terms: 0,
        conversions: 0,
        revenue: 0,
      };

      current.spend += num(row.cost);
      current.clicks += num(row.clicks);
      current.terms += 1;
      current.conversions += num(row.conversions);
      current.revenue += num(row.revenue);
      map.set(category, current);
    });

    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [terms]);

  const fragmentation = useMemo(() => {
    const buckets = [
      { label: "1 click", min: 1, max: 1, spend: 0, terms: 0, clicks: 0 },
      { label: "2–3 clicks", min: 2, max: 3, spend: 0, terms: 0, clicks: 0 },
      { label: "4–10 clicks", min: 4, max: 10, spend: 0, terms: 0, clicks: 0 },
      { label: "11+ clicks", min: 11, max: Infinity, spend: 0, terms: 0, clicks: 0 },
      { label: "Converting terms", min: 0, max: Infinity, spend: 0, terms: 0, clicks: 0 },
    ];

    terms.forEach((row) => {
      if (num(row.conversions) > 0) {
        buckets[4].spend += num(row.cost);
        buckets[4].terms += 1;
        buckets[4].clicks += num(row.clicks);
        return;
      }

      const clicks = num(row.clicks);
      const bucket = buckets.find((b, i) => i < 4 && clicks >= b.min && clicks <= b.max);
      if (bucket) {
        bucket.spend += num(row.cost);
        bucket.terms += 1;
        bucket.clicks += clicks;
      }
    });

    return buckets;
  }, [terms]);

  const killRows = useMemo(() => {
    return terms.filter((row) => {
      const category = str(row.category);
      return (
        num(row.conversions) === 0 &&
        ["Competitor", "Marketplace", "Informational", "Off-product", "Generic hair"].includes(category)
      );
    });
  }, [terms]);

  const watchRows = useMemo(() => {
    return terms
      .filter((row) => num(row.conversions) === 0 && str(row.category) === "Core" && num(row.clicks) >= 5)
      .sort((a, b) => num(b.cost) - num(a.cost));
  }, [terms]);

  const winnerRows = useMemo(() => {
    return terms
      .filter((row) => num(row.conversions) > 0)
      .sort((a, b) => num(b.roas) - num(a.roas));
  }, [terms]);

  async function copyNegatives() {
    try {
      await navigator.clipboard.writeText(negativeLines);
      alert("Negative keyword list copied.");
    } catch {
      alert("Could not copy. Please copy manually.");
    }
  }

  const totalSpend = num(summary.total_cost) || terms.reduce((sum, row) => sum + num(row.cost), 0);
  const zeroPurchaseSpend = terms
    .filter((row) => num(row.conversions) === 0)
    .reduce((sum, row) => sum + num(row.cost), 0);
  const killSpend = killRows.reduce((sum, row) => sum + num(row.cost), 0);
  const maxSpendMix = Math.max(...spendMix.map((row) => row.spend), 1);
  const maxFrag = Math.max(...fragmentation.map((row) => row.spend), 1);
  const maxPattern = Math.max(...ngramRows.slice(0, 20).map((row) => num(row.cost)), 1);

  const tabCounts: Record<TabKey, number> = {
    waste_spender: wasteRows.length,
    spend_mix: spendMix.length,
    fragmentation: fragmentation.length,
    pattern_waste: ngramRows.length,
    kill_list: killRows.length,
    watch_list: watchRows.length,
    winners: winnerRows.length,
    action_plan: recommendations.length || 6,
  };

  return (
    <main className="wr-shell">
      <style jsx global>{styles}</style>

      <header className="wr-header">
        <div>
          <h1>Search Term Analyzer</h1>
          <p>{fileName} · {int(terms.length)} spend-bearing terms analyzed</p>
        </div>

        <div className="wr-actions">
          <button
            type="button"
            onClick={() =>
              exportCsv(
                "search-term-war-room-export.csv",
                terms.map((row) => ({
                  search_term: row.search_term,
                  category: row.category,
                  cost: row.cost,
                  clicks: row.clicks,
                  conversions: row.conversions,
                  revenue: row.revenue,
                  roas: row.roas,
                }))
              )
            }
          >
            Export data
          </button>
          <button type="button" className="primary" onClick={onNewUpload}>
            New upload
          </button>
          <ThemeToggle />
        </div>
      </header>

      <nav className="wr-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? "active" : ""}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <em>{tabCounts[tab.key] || 0}</em>
          </button>
        ))}
      </nav>

      <section className="wr-kpis">
        <Kpi label="Spend" value={money(totalSpend)} />
        <Kpi label="Revenue" value={money(summary.total_revenue)} tone="green" />
        <Kpi label="ROAS" value={x(summary.blended_roas)} tone="red" />
        <Kpi label="Zero-purchase spend" value={money(zeroPurchaseSpend)} tone="red" />
        <Kpi label="Kill-list spend" value={money(killSpend)} tone="green" />
        <Kpi label="Clicks" value={int(summary.total_clicks)} tone="blue" />
      </section>

      {activeTab === "waste_spender" ? (
        <section className="wr-stack">
          <div className="wr-panel">
            <div className="wr-panel-head">
              <div>
                <span>Waste Spender</span>
                <h2>Zero-purchase search terms above spend threshold</h2>
              </div>

              <div className="wr-controls">
                <label>
                  Min spend
                  <input
                    type="number"
                    value={threshold}
                    min={0}
                    step={50}
                    onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
                  />
                </label>

                <select value={matchType} onChange={(e) => setMatchType(e.target.value as any)}>
                  <option value="exact">Exact negatives</option>
                  <option value="phrase">Phrase negatives</option>
                  <option value="broad">Broad negatives</option>
                </select>
              </div>
            </div>

            <div className="wr-presets">
              {[100, 200, 500, 1000, 2000, 5000, 10000].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={threshold === value ? "active" : ""}
                  onClick={() => setThreshold(value)}
                >
                  ₹{value.toLocaleString("en-IN")}+
                </button>
              ))}
            </div>

            <div className="wr-mini-kpis">
              <Kpi label="Filter" value={`₹${threshold.toLocaleString("en-IN")}+`} />
              <Kpi label="Terms" value={int(wasteRows.length)} />
              <Kpi label="Spend at risk" value={money(wasteRows.reduce((s, r) => s + num(r.cost), 0))} tone="red" />
              <Kpi label="Purchases" value="0" />
            </div>

            <DataTable
              rows={wasteRows}
              empty="No zero-purchase terms above the selected threshold."
              columns={[
                { key: "search_term", label: "Search term" },
                {
                  key: "syntax",
                  label: "Negative syntax",
                  render: (row) => <code>{syntax(str(row.search_term), matchType)}</code>,
                },
                { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
                { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
                { key: "conversions", label: "Conv.", right: true, render: (row) => num(row.conversions).toFixed(2) },
                { key: "category", label: "Category" },
              ]}
            />
          </div>

          <CopyBox text={negativeLines} onCopy={copyNegatives} />
        </section>
      ) : null}

      {activeTab === "spend_mix" ? (
        <section className="wr-panel">
          <div className="wr-panel-head">
            <div>
              <span>Spend Mix</span>
              <h2>Spend by intent/category cluster</h2>
            </div>
          </div>

          <div className="wr-bars">
            {spendMix.map((row) => (
              <BarRow
                key={row.category}
                label={row.category}
                value={row.spend}
                max={maxSpendMix}
                color={
                  row.category === "Converters"
                    ? GOOGLE.green
                    : row.category === "Core"
                    ? GOOGLE.blue
                    : row.category === "Competitor"
                    ? "#9b8cff"
                    : GOOGLE.red
                }
                meta={`${row.terms} terms · ${int(row.clicks)} clicks · ${num(row.conversions).toFixed(2)} conv`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "fragmentation" ? (
        <section className="wr-panel">
          <div className="wr-panel-head">
            <div>
              <span>Fragmentation</span>
              <h2>How spend is scattered by click depth</h2>
            </div>
          </div>

          <div className="wr-bars">
            {fragmentation.map((row) => (
              <BarRow
                key={row.label}
                label={row.label}
                value={row.spend}
                max={maxFrag}
                color={row.label === "Converting terms" ? GOOGLE.green : GOOGLE.red}
                meta={`${row.terms} terms · ${int(row.clicks)} clicks`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "pattern_waste" ? (
        <section className="wr-panel">
          <div className="wr-panel-head">
            <div>
              <span>Pattern Waste</span>
              <h2>Repeated query patterns creating waste</h2>
            </div>
          </div>

          <div className="wr-bars">
            {ngramRows.slice(0, 35).map((row, index) => (
              <BarRow
                key={`${row.ngram}-${index}`}
                label={`${row.ngram} · ${row.n}-word pattern`}
                value={num(row.cost)}
                max={maxPattern}
                color={num(row.conversions) > 0 ? GOOGLE.green : GOOGLE.red}
                meta={`${int(row.term_count)} terms · ${int(row.clicks)} clicks · ${num(row.conversions).toFixed(2)} conv · ${x(row.roas)}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "kill_list" ? (
        <section className="wr-stack">
          <div className="wr-panel">
            <div className="wr-panel-head">
              <div>
                <span>Kill List</span>
                <h2>Competitor, off-product, marketplace, informational drains</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  exportCsv(
                    "kill-list-negatives.csv",
                    killRows.map((row) => ({
                      search_term: row.search_term,
                      exact_negative: `[${row.search_term}]`,
                      phrase_negative: `"${row.search_term}"`,
                      category: row.category,
                      cost: row.cost,
                      clicks: row.clicks,
                    }))
                  )
                }
              >
                Export kill list
              </button>
            </div>

            <DataTable
              rows={killRows}
              empty="No kill-list terms found."
              columns={[
                { key: "search_term", label: "Search term" },
                { key: "category", label: "Category" },
                { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
                { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
                { key: "syntax", label: "Exact negative", render: (row) => <code>[{row.search_term}]</code> },
              ]}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "watch_list" ? (
        <section className="wr-panel">
          <div className="wr-panel-head">
            <div>
              <span>Watch List</span>
              <h2>Relevant search terms with clicks but no purchases</h2>
            </div>
          </div>

          <DataTable
            rows={watchRows}
            empty="No core watchlist terms found."
            columns={[
              { key: "search_term", label: "Search term" },
              { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
              { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
              { key: "conversions", label: "Conv.", right: true, render: (row) => num(row.conversions).toFixed(2) },
              { key: "action", label: "Action", render: () => "Fix PDP / offer before negative" },
            ]}
          />
        </section>
      ) : null}

      {activeTab === "winners" ? (
        <section className="wr-panel">
          <div className="wr-panel-head">
            <div>
              <span>Winners</span>
              <h2>Terms with purchases / revenue</h2>
            </div>
          </div>

          <DataTable
            rows={winnerRows}
            empty="No winner terms found."
            columns={[
              { key: "search_term", label: "Search term" },
              { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
              { key: "conversions", label: "Conv.", right: true, render: (row) => num(row.conversions).toFixed(2) },
              { key: "revenue", label: "Revenue", right: true, render: (row) => money(row.revenue) },
              { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
              { key: "action", label: "Action", render: () => "Protect / isolate / scale" },
            ]}
          />
        </section>
      ) : null}

      {activeTab === "action_plan" ? (
        <section className="wr-panel">
          <div className="wr-panel-head">
            <div>
              <span>Action Plan</span>
              <h2>Sequenced operator actions</h2>
            </div>
          </div>

          <div className="wr-steps">
            <div className="wr-step red">
              <h3>1. Add Waste Spender negatives first</h3>
              <p>Start with zero-purchase search terms above your selected spend threshold. Use exact match first.</p>
              <strong>Immediate budget cleanup</strong>
            </div>

            <div className="wr-step red">
              <h3>2. Apply Kill List clusters</h3>
              <p>Competitor, marketplace, informational, generic, and off-product terms should be blocked aggressively.</p>
              <strong>{money(killSpend)} direct leakage identified</strong>
            </div>

            <div className="wr-step yellow">
              <h3>3. Fix core watchlist terms</h3>
              <p>If a relevant term gets clicks but no purchases, it is likely a PDP, price, offer, review, or checkout issue.</p>
              <strong>{watchRows.length} core terms need investigation</strong>
            </div>

            <div className="wr-step green">
              <h3>4. Protect and scale winners</h3>
              <p>Winner terms should be isolated into controlled structures, improved in feed titles, and used for copy/PDP learning.</p>
              <strong>{winnerRows.length} converting terms found</strong>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default function Page() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [fileName, setFileName] = useState("");

  if (!result) {
    return (
      <main className="wr-shell">
        <style jsx global>{styles}</style>

        <header className="wr-header">
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
          }}
        />
      </main>
    );
  }

  return (
    <PageContent
      result={result}
      fileName={fileName}
      onNewUpload={() => {
        setResult(null);
        setFileName("");
      }}
    />
  );
}

const styles = `
:root,
html[data-theme="light"] {
  --wr-bg: #f7f9fc;
  --wr-panel: rgba(255,255,255,0.88);
  --wr-panel2: #ffffff;
  --wr-line: rgba(15,23,42,0.10);
  --wr-line2: rgba(15,23,42,0.18);
  --wr-ink: #0f172a;
  --wr-dim: #475569;
  --wr-faint: #94a3b8;
  --wr-grid: rgba(15,23,42,0.06);
  --wr-shadow: 0 18px 48px rgba(15,23,42,0.08);
}

html[data-theme="dark"] {
  --wr-bg: #050816;
  --wr-panel: rgba(15,23,42,0.82);
  --wr-panel2: rgba(17,24,39,0.94);
  --wr-line: rgba(148,163,184,0.18);
  --wr-line2: rgba(226,232,240,0.28);
  --wr-ink: #f8fafc;
  --wr-dim: #cbd5e1;
  --wr-faint: #7b8aa1;
  --wr-grid: rgba(148,163,184,0.12);
  --wr-shadow: 0 22px 60px rgba(0,0,0,0.34);
}

body {
  margin: 0;
  background: var(--wr-bg) !important;
  font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}

.wr-shell {
  min-height: 100vh;
  color: var(--wr-ink);
  background:
    radial-gradient(circle at 18% 0%, rgba(66,133,244,0.12), transparent 28%),
    radial-gradient(circle at 82% 0%, rgba(52,168,83,0.08), transparent 28%),
    var(--wr-bg);
  padding: 18px 20px 48px;
}

.wr-header {
  max-width: 1220px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.wr-header h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: -0.04em;
  line-height: 1.1;
}

.wr-header p {
  margin: 7px 0 0;
  color: var(--wr-faint);
  font-size: 13px;
}

.wr-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wr-actions button,
.wr-panel button,
.wr-copy-card button {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 12px;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.wr-actions button.primary {
  background: #4285F4;
  border-color: #4285F4;
  color: #fff;
}

.wr-tabs {
  max-width: 1220px;
  margin: 0 auto 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  overflow-x: auto;
  padding-bottom: 3px;
}

.wr-tabs button {
  flex: 0 0 auto;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  color: var(--wr-dim);
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.wr-tabs button.active {
  border-color: rgba(66,133,244,0.45);
  background: rgba(66,133,244,0.13);
  color: var(--wr-ink);
}

.wr-tabs em {
  font-style: normal;
  color: var(--wr-faint);
  margin-left: 6px;
}

.wr-kpis,
.wr-mini-kpis {
  max-width: 1220px;
  margin: 0 auto 12px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 9px;
}

.wr-mini-kpis {
  margin: 10px 0 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.wr-kpi {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  border-radius: 16px;
  padding: 11px 12px;
  box-shadow: var(--wr-shadow);
}

.wr-kpi span {
  display: block;
  color: var(--wr-faint);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.wr-kpi strong {
  display: block;
  margin-top: 6px;
  color: var(--wr-ink);
  font-size: 22px;
  line-height: 1;
  letter-spacing: -0.04em;
}

.tone-red { color: #EA4335 !important; }
.tone-green { color: #34A853 !important; }
.tone-blue { color: #4285F4 !important; }
.tone-yellow { color: #F29900 !important; }

.wr-stack,
.wr-panel,
.wr-copy-card {
  max-width: 1220px;
  margin: 0 auto;
}

.wr-stack {
  display: grid;
  gap: 10px;
}

.wr-panel,
.wr-copy-card {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  border-radius: 18px;
  padding: 14px;
  box-shadow: var(--wr-shadow);
}

.wr-panel-head,
.wr-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 10px;
}

.wr-panel-head span,
.wr-card-head span {
  color: var(--wr-faint);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.wr-panel-head h2,
.wr-card-head h2 {
  margin: 5px 0 0;
  color: var(--wr-ink);
  font-size: 17px;
  letter-spacing: -0.03em;
}

.wr-controls {
  display: flex;
  align-items: end;
  gap: 8px;
}

.wr-controls label {
  display: grid;
  gap: 5px;
  color: var(--wr-faint);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.wr-controls input,
.wr-controls select {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 11px;
  padding: 8px 10px;
  font-size: 12px;
  outline: none;
}

.wr-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 10px;
}

.wr-presets button {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-dim);
  border-radius: 999px;
  padding: 6px 9px;
  font-size: 11px;
}

.wr-presets button.active {
  color: var(--wr-ink);
  border-color: rgba(66,133,244,0.45);
  background: rgba(66,133,244,0.12);
}

.wr-table-wrap {
  border: 1px solid var(--wr-line);
  border-radius: 15px;
  overflow: hidden;
}

.wr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.wr-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--wr-panel2);
  color: var(--wr-faint);
  text-align: left;
  padding: 9px 11px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  border-bottom: 1px solid var(--wr-line);
}

.wr-table td {
  padding: 9px 11px;
  color: var(--wr-dim);
  border-top: 1px solid var(--wr-grid);
}

.wr-table .right {
  text-align: right;
}

.wr-table code {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 9px;
  padding: 5px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.wr-empty {
  border: 1px solid var(--wr-line);
  border-radius: 15px;
  padding: 38px 18px;
  text-align: center;
  color: var(--wr-dim);
}

.wr-empty strong {
  display: block;
  color: var(--wr-ink);
  font-size: 18px;
}

.wr-empty p {
  margin: 8px 0 0;
  font-size: 13px;
}

.wr-copy-card pre {
  margin: 12px 0 0;
  max-height: 210px;
  overflow: auto;
  white-space: pre-wrap;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 14px;
  padding: 13px;
  font-size: 12px;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.wr-bars {
  display: grid;
  gap: 10px;
}

.wr-bar-row {
  display: grid;
  grid-template-columns: 240px 1fr 110px;
  align-items: center;
  gap: 12px;
}

.wr-bar-label span {
  display: block;
  color: var(--wr-ink);
  font-weight: 650;
  font-size: 13px;
}

.wr-bar-label em {
  display: block;
  margin-top: 3px;
  color: var(--wr-faint);
  font-size: 11px;
  font-style: normal;
}

.wr-bar-track {
  height: 8px;
  background: var(--wr-grid);
  border-radius: 999px;
  overflow: hidden;
}

.wr-bar-track i {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.wr-bar-row strong {
  text-align: right;
}

.wr-steps {
  display: grid;
  gap: 10px;
}

.wr-step {
  border: 1px solid var(--wr-line);
  border-left: 4px solid #4285F4;
  background: var(--wr-panel2);
  border-radius: 14px;
  padding: 14px;
}

.wr-step.red { border-left-color: #EA4335; }
.wr-step.yellow { border-left-color: #FBBC04; }
.wr-step.green { border-left-color: #34A853; }

.wr-step h3 {
  margin: 0;
  color: var(--wr-ink);
  font-size: 15px;
}

.wr-step p {
  margin: 6px 0 0;
  color: var(--wr-dim);
  font-size: 13px;
}

.wr-step strong {
  display: block;
  margin-top: 8px;
  color: #34A853;
  font-size: 12px;
}

/* Full-width Waste Spender layout alignment */
.wr-stack {
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.wr-stack > .wr-panel,
.wr-stack > .wr-copy-card {
  width: 100%;
  max-width: none;
  margin: 0;
}

.wr-panel,
.wr-copy-card {
  width: 100%;
}

.wr-table-wrap {
  width: 100%;
}

.wr-table {
  width: 100%;
  min-width: 100%;
}

.wr-copy-card {
  padding: 14px;
}

.wr-copy-card pre {
  width: 100%;
  max-height: 180px;
}

.wr-panel-head,
.wr-card-head {
  width: 100%;
}

.wr-controls {
  margin-left: auto;
}


@media(max-width: 980px) {
  .wr-kpis,
  .wr-mini-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wr-bar-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .wr-controls,
  .wr-panel-head,
  .wr-card-head,
  .wr-header {
    flex-direction: column;
    align-items: stretch;
  }
}
`;
