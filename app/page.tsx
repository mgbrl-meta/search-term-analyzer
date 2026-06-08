"use client";

import { CommandCenterTab } from "@/components/googleOs/tabs/CommandCenterTab";
import { CampaignsTab } from "@/components/googleOs/tabs/CampaignsTab";
import { AdGroupsTab } from "@/components/googleOs/tabs/AdGroupsTab";
import { MonthlySummaryTab } from "@/components/googleOs/tabs/MonthlySummaryTab";
import { AiOperatorReportTab } from "@/components/googleOs/tabs/AiOperatorReportTab";
import { SettingsTab } from "@/components/googleOs/tabs/SettingsTab";
import { CompactSearchTermUpload } from "@/components/googleOs/shared/CompactSearchTermUpload";
import { parseCsv } from "@/lib/googleOs/csv";
import { buildGoogleOsModel } from "@/lib/googleOs/normalize";
import type { GoogleOsModel } from "@/lib/googleOs/types";

import { AiBrainTab } from "@/components/searchTerms/tabs/AiBrainTab";
import { KeywordCategoryCardsTab } from "@/components/searchTerms/tabs/KeywordCategoryCardsTab";
import { normalizeAnalyzeResponse } from "@/lib/searchTerms/normalize";

import { useEffect, useMemo, useState } from "react";
import FileUpload from "@/components/FileUpload";
import ThemeToggle from "@/components/ThemeToggle";
import type { AnalyzeResponse } from "@/types/api";

type AnyObj = Record<string, any>;

type TabKey =
  | "command_center"
  | "campaigns"
  | "ad_groups"
  | "search_terms"
  | "ai_operator_report"
  | "actions"
  | "settings"
  | "waste_spender"
  | "keyword_category_cards"
  | "ai_brain"
  | "pattern_waste"
  | "action_plan";

const TABS: { key: TabKey; label: string }[] = [
  { key: "command_center", label: "Command Center" },
  { key: "campaigns", label: "Campaigns" },
  { key: "ad_groups", label: "Ad Groups" },
  { key: "search_terms", label: "Search Terms" },
  { key: "ai_operator_report", label: "AI Operator Report" },
  { key: "actions", label: "Actions" },
  { key: "settings", label: "Settings" },
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

function reportPct(value: any) {
  const n = num(value);
  return `${(n > 1 ? n : n * 100).toFixed(2)}%`;
}

function ctrPct(value: any) {
  const n = num(value);
  return `${(n > 1 ? n : n * 100).toFixed(2)}%`;
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

  if (
    term.includes("diy") ||
    term.includes("home remedy") ||
    term.includes("remedy") ||
    term.includes("how to") ||
    term.includes("at home") ||
    term.includes("naturally") ||
    term.includes("why") ||
    term.includes("what causes") ||
    term.includes("benefits") ||
    term.includes("cure")
  ) {
    return "DIY / Informational";
  }

  if (
    term.includes("treatment") ||
    term.includes("kit") ||
    term.includes("solution") ||
    term.includes("control") ||
    term.includes("therapy") ||
    term.includes("scalp") ||
    term.includes("anti dandruff") ||
    term.includes("dandruff shampoo") ||
    term.includes("hair fall") ||
    term.includes("hair growth")
  ) {
    return "Treatment";
  }

  if (
    term.includes("oil") ||
    term.includes("serum") ||
    term.includes("conditioner") ||
    term.includes("lotion") ||
    term.includes("cream") ||
    term.includes("gel") ||
    term.includes("soap") ||
    term.includes("face wash") ||
    term.includes("capsule") ||
    term.includes("gummies") ||
    term.includes("hair colour") ||
    term.includes("hair color")
  ) {
    return "Off-product";
  }

  if (
    term.includes("hair care") ||
    term.includes("hair products") ||
    term.includes("best hair") ||
    term.includes("hair shampoo") ||
    term.includes("best shampoo")
  ) {
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

function getCategoryRecommendation(category: string, metrics: AnyObj) {
  const spend = num(metrics.spend);
  const conversions = num(metrics.conversions);
  const roas = spend > 0 ? num(metrics.revenue) / spend : 0;

  if (category === "Converters") {
    return {
      tone: "green",
      title: "Protect and scale",
      body: "These terms have generated purchases. Do not add negatives here. Use them for feed titles, ad copy, and campaign isolation.",
    };
  }

  if (category === "Competitor") {
    return {
      tone: "red",
      title: "Add negatives aggressively",
      body: "Competitor traffic is usually expensive and low-control. Add exact negatives first. Use phrase negatives only when the competitor theme is clearly irrelevant.",
    };
  }

  if (category === "Marketplace") {
    return {
      tone: "red",
      title: "Block marketplace leakage",
      body: "Marketplace-intent users are usually looking for Amazon, Flipkart, Nykaa, Myntra, or other platforms. Add negatives if purchases are zero.",
    };
  }

  if (category === "DIY / Informational") {
    return {
      tone: "yellow",
      title: "Reduce research-stage waste",
      body: "DIY and informational searches are usually low-buying-intent. Keep only if they assist conversion; otherwise add phrase negatives like how to, remedy, at home.",
    };
  }

  if (category === "Off-product") {
    return {
      tone: "red",
      title: "Stop off-product spend",
      body: "Queries around oil, serum, conditioner, lotion, or unrelated formats should be blocked unless the product being advertised matches that intent.",
    };
  }

  if (category === "Generic hair") {
    return {
      tone: "yellow",
      title: "Tighten relevance",
      body: "Generic hair-care traffic is broad and usually weak. Review terms with spend and no purchases; use exact negatives first.",
    };
  }

  if (category === "Treatment" && conversions === 0 && spend > 0) {
    return {
      tone: "yellow",
      title: "Relevant but not converting",
      body: "Treatment intent is relevant. If it has clicks but no purchases, check PDP, claim, price, reviews, offer, stock, and checkout before adding broad negatives.",
    };
  }

  if (category === "Core" && conversions === 0 && spend > 0) {
    return {
      tone: "yellow",
      title: "Investigate before blocking",
      body: "Core terms are relevant but not converting. This is likely a PDP, pricing, offer, trust, or checkout issue. Use exact negatives only for clear waste.",
    };
  }

  if (roas > 0) {
    return {
      tone: "green",
      title: "Monitor and refine",
      body: "This category has some revenue signal. Avoid broad negatives; prune only non-converting search terms with enough spend.",
    };
  }

  return {
    tone: "neutral",
    title: "Review manually",
    body: "Not enough signal for a strong decision. Continue collecting data or use exact negatives only for obvious irrelevant queries.",
  };
}

function CategorySpendMixPanel({
  terms,
  categoryRows,
  matchType,
  setMatchType,
  minSpend,
  setMinSpend,
  selectedCategory,
  setSelectedCategory,
}: {
  terms: AnyObj[];
  categoryRows: AnyObj[];
  matchType: "exact" | "phrase" | "broad";
  setMatchType: (value: "exact" | "phrase" | "broad") => void;
  minSpend: number;
  setMinSpend: (value: number) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
}) {
  const categoryColors: Record<string, string> = {
    Core: GOOGLE.blue,
    Treatment: GOOGLE.blue,
    Converters: GOOGLE.green,
    Competitor: "#9b8cff",
    Marketplace: GOOGLE.red,
    "DIY / Informational": GOOGLE.yellow,
    "Off-product": GOOGLE.red,
    "Generic hair": GOOGLE.yellow,
  };

  const activeCategory = selectedCategory || str(categoryRows[0]?.category, "");
  const activeMetrics = categoryRows.find((row) => str(row.category) === activeCategory) || categoryRows[0];

  const categoryTerms = terms.filter((row) => str(row.category) === activeCategory);

  const negativeTerms = categoryTerms
    .filter((row) => num(row.conversions) === 0 && num(row.cost) >= minSpend)
    .sort((a, b) => num(b.cost) - num(a.cost));

  const negativeLines = negativeTerms
    .map((row) => syntax(str(row.search_term), matchType))
    .filter(Boolean)
    .join("\n");

  const recommendation = getCategoryRecommendation(activeCategory, activeMetrics || {});
  const activeRoas = num(activeMetrics?.spend) > 0 ? num(activeMetrics?.revenue) / num(activeMetrics?.spend) : 0;
  const maxSpend = Math.max(...categoryRows.map((row) => num(row.spend)), 1);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      alert("Copied.");
    } catch {
      alert("Could not copy. Please copy manually.");
    }
  }

  if (!categoryRows.length) {
    return (
      <section className="wr-category-page">
        <div className="wr-panel">
          <div className="wr-empty">
            <strong>No categories found</strong>
            <p>Upload data does not contain enough search-term rows to classify.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="wr-category-page">
      <div className="wr-panel wr-category-control">
        <div className="wr-panel-head">
          <div>
            <span>Category Spend Mix</span>
            <h2>Spend mix summary by keyword category</h2>
          </div>

          <div className="wr-controls">
            <label>
              Select category
              <select
                value={activeCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categoryRows.map((row) => (
                  <option key={str(row.category)} value={str(row.category)}>
                    {str(row.category)} — {money(row.spend)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Negative min spend
              <input
                type="number"
                min={0}
                step={50}
                value={minSpend}
                onChange={(e) => setMinSpend(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>

            <select value={matchType} onChange={(e) => setMatchType(e.target.value as "exact" | "phrase" | "broad")}>
              <option value="exact">Exact negatives</option>
              <option value="phrase">Phrase negatives</option>
              <option value="broad">Broad negatives</option>
            </select>
          </div>
        </div>

        <div className="wr-category-summary-strip">
          {categoryRows.map((category) => {
            const categoryName = str(category.category, "Unknown");
            const isActive = categoryName === activeCategory;
            const color = categoryColors[categoryName] || GOOGLE.blue;
            const width = Math.max(3, (num(category.spend) / maxSpend) * 100);
            const roas = num(category.spend) > 0 ? num(category.revenue) / num(category.spend) : 0;

            return (
              <button
                type="button"
                key={categoryName}
                className={isActive ? "active" : ""}
                onClick={() => setSelectedCategory(categoryName)}
              >
                <div className="wr-category-summary-top">
                  <span>
                    <i style={{ backgroundColor: color }} />
                    {categoryName}
                  </span>
                  <strong>{money(category.spend)}</strong>
                </div>

                <div className="wr-category-summary-bar">
                  <b style={{ width: `${width}%`, backgroundColor: color }} />
                </div>

                <div className="wr-category-summary-meta">
                  {int(category.terms)} terms · {int(category.clicks)} clicks · {ctrPct(category.ctr)} CTR · {num(category.conversions).toFixed(2)} purch · {x(roas)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="wr-category-detail-grid">
        <div className="wr-panel">
          <div className="wr-category-detail-head">
            <div>
              <span className="wr-category-dot" style={{ background: categoryColors[activeCategory] || GOOGLE.blue }} />
              <h2>{activeCategory}</h2>
              <p>{recommendation.body}</p>
            </div>

            <em className={`tone-${recommendation.tone}`}>{recommendation.title}</em>
          </div>

          <div className="wr-category-metrics compact">
            <div>
              <span>Terms</span>
              <strong>{int(activeMetrics?.terms)}</strong>
            </div>
            <div>
              <span>Spend</span>
              <strong>{money(activeMetrics?.spend)}</strong>
            </div>
            <div>
              <span>Clicks</span>
              <strong>{int(activeMetrics?.clicks)}</strong>
            </div>
            <div>
              <span>Purchases</span>
              <strong>{num(activeMetrics?.conversions).toFixed(2)}</strong>
            </div>
            <div>
              <span>Revenue</span>
              <strong>{money(activeMetrics?.revenue)}</strong>
            </div>
            <div>
              <span>ROAS</span>
              <strong>{x(activeRoas)}</strong>
            </div>
          </div>

          <DataTable
            rows={negativeTerms.slice(0, 80)}
            empty="No negative candidates in this category at the selected spend threshold."
            columns={[
              { key: "search_term", label: "Search term" },
              { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
              { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
              { key: "conversions", label: "Purch.", right: true, render: (row) => num(row.conversions).toFixed(2) },
              { key: "syntax", label: "Syntax", render: (row) => <code>{syntax(str(row.search_term), matchType)}</code> },
            ]}
          />
        </div>

        <div className="wr-panel wr-category-copy-panel">
          <div className="wr-category-negative-head">
            <div>
              <span>Copy-ready negatives</span>
              <strong>{negativeTerms.length} terms from {activeCategory}</strong>
            </div>

            <button
              type="button"
              onClick={() => copyText(negativeLines)}
              disabled={!negativeLines}
            >
              Copy
            </button>
          </div>

          <pre className="wr-category-copybox large">
            {negativeLines || "No negative keywords in this category at the selected spend threshold."}
          </pre>

          <p className="wr-category-help">
            Exact negatives are safest. Use phrase or broad only when the whole theme is irrelevant and does not overlap with winner terms.
          </p>
        </div>
      </div>
    </section>
  );
}



function getCategoryCardRecommendation(category: string, metrics: AnyObj) {
  const spend = num(metrics.spend);
  const conversions = num(metrics.conversions);
  const revenue = num(metrics.revenue);
  const roas = spend > 0 ? revenue / spend : 0;

  if (category === "Converters") {
    return {
      tone: "green",
      title: "Protect and scale",
      body: "These terms have generated purchases. Do not add negatives here. Use these terms for feed titles, PDP language, ad copy, and campaign isolation.",
    };
  }

  if (category === "Competitor") {
    return {
      tone: "red",
      title: "Add negatives aggressively",
      body: "Competitor traffic is usually expensive and low-control. Start with exact negatives. Use phrase only when the competitor theme has no profitable overlap.",
    };
  }

  if (category === "Marketplace") {
    return {
      tone: "red",
      title: "Block marketplace leakage",
      body: "Marketplace-intent users are looking for Amazon, Flipkart, Nykaa, Myntra, or similar platforms. If purchases are zero, add negatives.",
    };
  }

  if (category === "DIY / Informational") {
    return {
      tone: "yellow",
      title: "Reduce research-stage waste",
      body: "DIY and informational queries are low buying intent. Keep only if they assist conversion. Otherwise add exact or phrase negatives like remedy, how to, at home.",
    };
  }

  if (category === "Off-product") {
    return {
      tone: "red",
      title: "Stop off-product spend",
      body: "These terms are around product formats or needs that may not match the advertised SKU. Add exact negatives unless you sell that exact product type.",
    };
  }

  if (category === "Generic hair") {
    return {
      tone: "yellow",
      title: "Tighten broad generic spend",
      body: "Generic hair-care traffic is broad. Review zero-purchase terms and add exact negatives first. Do not use broad negatives unless the theme is clearly irrelevant.",
    };
  }

  if (category === "Treatment" && conversions === 0 && spend > 0) {
    return {
      tone: "yellow",
      title: "Relevant but not converting",
      body: "Treatment intent is relevant. If clicks are high but purchases are zero, check PDP claim, offer, pricing, reviews, delivery promise, and checkout before blocking broadly.",
    };
  }

  if (category === "Core" && conversions === 0 && spend > 0) {
    return {
      tone: "yellow",
      title: "Investigate before blocking",
      body: "Core terms are relevant but not converting. Use exact negatives only for clear waste. Otherwise investigate PDP, offer, and feed relevance.",
    };
  }

  if (roas > 0) {
    return {
      tone: "green",
      title: "Monitor and refine",
      body: "This category has some revenue signal. Avoid broad negatives. Prune only non-converting search terms with enough spend.",
    };
  }

  return {
    tone: "neutral",
    title: "Collect more signal",
    body: "Not enough signal for a strong decision. Continue collecting data or use exact negatives only for obvious irrelevant queries.",
  };
}

function CategorySpendMixCardsPanel({
  terms,
  categoryRows,
}: {
  terms: AnyObj[];
  categoryRows: AnyObj[];
}) {
  const [minSpend, setMinSpend] = useState(0);
  const [matchType, setMatchType] = useState<"exact" | "phrase" | "broad">("exact");
  const [openCategory, setOpenCategory] = useState<string>("");
  const [viewMode, setViewMode] = useState<"summary" | "terms" | "negatives">("summary");

  const categoryColors: Record<string, string> = {
    "Converters": GOOGLE.green,
    "Marketplace Intent": GOOGLE.red,
    "Competitor Intent": "#9b8cff",
    "DIY / Informational": GOOGLE.yellow,
    "Problem / Treatment": GOOGLE.yellow,
    "High Purchase Intent": GOOGLE.green,
    "Product Format Intent": GOOGLE.blue,
    "Broad Category Intent": GOOGLE.blue,
    "Unclassified / Other": "#94a3b8",
    "Core": GOOGLE.blue,
    "Treatment": GOOGLE.yellow,
    "Competitor": "#9b8cff",
    "Marketplace": GOOGLE.red,
    "Off-product": GOOGLE.red,
    "Generic hair": GOOGLE.yellow,
  };

  const totalSpend = categoryRows.reduce((sum, row) => sum + num(row.spend), 0);
  const maxSpend = Math.max(...categoryRows.map((row) => num(row.spend)), 1);
  const activeCategory = openCategory || str(categoryRows[0]?.category, "");

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      alert("Copied.");
    } catch {
      alert("Could not copy. Please copy manually.");
    }
  }

  if (!categoryRows.length) {
    return (
      <section className="wr-category-page">
        <div className="wr-panel">
          <div className="wr-empty">
            <strong>No categories found</strong>
            <p>Upload data does not contain enough search-term rows to classify.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="wr-category-page compact">
      <div className="wr-panel wr-category-control">
        <div className="wr-panel-head">
          <div>
            <span>Category Spend Mix</span>
            <h2>Category-level keyword classification</h2>
            <p className="wr-category-help">
              Each category is collapsed by default. Open a category to review specific search terms,
              recommendation logic, and copy-ready negative keywords.
            </p>
          </div>

          <div className="wr-controls">
            <label>
              Negative min spend
              <input
                type="number"
                min={0}
                step={50}
                value={minSpend}
                onChange={(e) => setMinSpend(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>

            <select value={matchType} onChange={(e) => setMatchType(e.target.value as "exact" | "phrase" | "broad")}>
              <option value="exact">Exact negatives</option>
              <option value="phrase">Phrase negatives</option>
              <option value="broad">Broad negatives</option>
            </select>
          </div>
        </div>

        <div className="wr-category-summary-strip compact">
          {categoryRows.map((category) => {
            const categoryName = str(category.category, "Unknown");
            const color = categoryColors[categoryName] || GOOGLE.blue;
            const spend = num(category.spend);
            const roas = spend > 0 ? num(category.revenue) / spend : 0;
            const width = Math.max(3, (spend / maxSpend) * 100);
            const isActive = categoryName === activeCategory;

            return (
              <button
                type="button"
                key={categoryName}
                className={isActive ? "active" : ""}
                onClick={() => {
                  setOpenCategory(categoryName);
                  setViewMode("summary");
                }}
              >
                <div className="wr-category-summary-top">
                  <span>
                    <i style={{ backgroundColor: color }} />
                    {categoryName}
                  </span>
                  <strong>{money(spend)}</strong>
                </div>

                <div className="wr-category-summary-bar">
                  <b style={{ width: `${width}%`, backgroundColor: color }} />
                </div>

                <div className="wr-category-summary-meta">
                  {int(category.terms)} terms · {int(category.clicks)} clicks · {ctrPct(category.ctr)} CTR · {num(category.conversions).toFixed(2)} purch · {x(roas)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="wr-category-accordion">
        {categoryRows.map((category) => {
          const categoryName = str(category.category, "Unknown");
          const color = categoryColors[categoryName] || GOOGLE.blue;
          const isOpen = categoryName === activeCategory;
          const categoryTerms = terms
            .filter((row) => str(row.category) === categoryName)
            .sort((a, b) => num(b.cost) - num(a.cost));

          const negativeTerms = categoryTerms
            .filter((row) => num(row.conversions) === 0 && num(row.cost) >= minSpend)
            .sort((a, b) => num(b.cost) - num(a.cost));

          const negativeLines = negativeTerms
            .map((row) => syntax(str(row.search_term), matchType))
            .filter(Boolean)
            .join("\n");

          const recommendation = getCategoryCardRecommendation(categoryName, category);
          const roas = num(category.spend) > 0 ? num(category.revenue) / num(category.spend) : 0;
          const spendShare = totalSpend > 0 ? (num(category.spend) / totalSpend) * 100 : 0;

          return (
            <div className={`wr-category-accordion-card ${isOpen ? "open" : ""}`} key={categoryName}>
              <button
                type="button"
                className="wr-category-accordion-head"
                onClick={() => {
                  setOpenCategory(isOpen ? "" : categoryName);
                  setViewMode("summary");
                }}
              >
                <div className="wr-category-title-block">
                  <span className="wr-category-dot" style={{ backgroundColor: color }} />
                  <div>
                    <h3>{categoryName}</h3>
                    <p>{int(category.terms)} terms · {money(category.spend)} spend · {int(category.clicks)} clicks · {ctrPct(category.ctr)} CTR · {num(category.conversions).toFixed(2)} purchases · {x(roas)} ROAS</p>
                  </div>
                </div>

                <div className="wr-category-head-metrics">
                  <span>{spendShare.toFixed(1)}% spend share</span>
                  <strong className={`tone-${recommendation.tone}`}>{recommendation.title}</strong>
                  <em className="wr-arrow-button" aria-label={isOpen ? "Collapse category" : "Expand category"}>
                    {isOpen ? "↑" : "↓"}
                  </em>
                </div>
              </button>

              {isOpen ? (
                <div className="wr-category-accordion-body">
                  <div className="wr-category-view-tabs">
                    {[
                      ["summary", "Summary"],
                      ["terms", `Search Terms (${categoryTerms.length})`],
                      ["negatives", `Negatives (${negativeTerms.length})`],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={viewMode === key ? "active" : ""}
                        onClick={() => setViewMode(key as "summary" | "terms" | "negatives")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {viewMode === "summary" ? (
                    <div className="wr-category-summary-detail">
                      <div className="wr-category-metrics compact">
                        <div>
                          <span>Search terms</span>
                          <strong>{int(category.terms)}</strong>
                        </div>
                        <div>
                          <span>Spend</span>
                          <strong>{money(category.spend)}</strong>
                        </div>
                        <div>
                          <span>Clicks</span>
                          <strong>{int(category.clicks)}</strong>
                        </div>
                        <div>
                          <span>Purchases</span>
                          <strong>{num(category.conversions).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span>CTR</span>
                          <strong>{ctrPct(category.ctr)}</strong>
                        </div>
                        <div>
                          <span>Revenue</span>
                          <strong>{money(category.revenue)}</strong>
                        </div>
                        <div>
                          <span>ROAS</span>
                          <strong>{x(roas)}</strong>
                        </div>
                      </div>

                      <div className="wr-category-reco-card">
                        <span className={`tone-${recommendation.tone}`}>{recommendation.title}</span>
                        <p>{recommendation.body}</p>
                      </div>
                    </div>
                  ) : null}

                  {viewMode === "terms" ? (
                    <DataTable
                      rows={categoryTerms.slice(0, 150)}
                      empty="No search terms found in this category."
                      columns={[
                        { key: "search_term", label: "Search term" },
                        { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
                        { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
                        { key: "ctr", label: "CTR", right: true, render: (row) => ctrPct(row.ctr) },
                        { key: "conversions", label: "Purch.", right: true, render: (row) => num(row.conversions).toFixed(2) },
                        { key: "revenue", label: "Revenue", right: true, render: (row) => money(row.revenue) },
                        { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
                      ]}
                    />
                  ) : null}

                  {viewMode === "negatives" ? (
                    <div className="wr-category-negative-layout">
                      <div>
                        <DataTable
                          rows={negativeTerms.slice(0, 150)}
                          empty="No negative candidates in this category at the selected spend threshold."
                          columns={[
                            { key: "search_term", label: "Search term" },
                            { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
                            { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
                            { key: "ctr", label: "CTR", right: true, render: (row) => ctrPct(row.ctr) },
                            { key: "syntax", label: "Syntax", render: (row) => <code>{syntax(str(row.search_term), matchType)}</code> },
                          ]}
                        />
                      </div>

                      <div className="wr-category-copy-panel compact">
                        <div className="wr-category-negative-head">
                          <div>
                            <span>Copy-ready negatives</span>
                            <strong>{negativeTerms.length} candidates</strong>
                          </div>

                          <button
                            type="button"
                            onClick={() => copyText(negativeLines)}
                            disabled={!negativeLines}
                          >
                            Copy
                          </button>
                        </div>

                        <pre className="wr-category-copybox compact">
                          {negativeLines || "No negative keywords in this category at the selected spend threshold."}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}



function NgramTabPanel({
  ngramRows,
}: {
  ngramRows: AnyObj[];
}) {
  const [matchType, setMatchType] = useState<"exact" | "phrase" | "broad">("phrase");
  const [minSpend, setMinSpend] = useState(100);
  const [activeN, setActiveN] = useState<1 | 2 | 3>(1);

  const grouped = [1, 2, 3].map((n) => {
    const rows = ngramRows
      .filter((row) => num(row.n) === n)
      .sort((a, b) => num(b.cost) - num(a.cost));

    const spend = rows.reduce((sum, row) => sum + num(row.cost), 0);
    const clicks = rows.reduce((sum, row) => sum + num(row.clicks), 0);
    const impressions = rows.reduce((sum, row) => sum + num(row.impressions), 0);
    const purchases = rows.reduce((sum, row) => sum + num(row.conversions), 0);
    const revenue = rows.reduce((sum, row) => sum + num(row.revenue), 0);
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const roas = spend > 0 ? revenue / spend : 0;

    return {
      n,
      label: `${n}-gram`,
      rows,
      spend,
      clicks,
      impressions,
      ctr,
      purchases,
      revenue,
      roas,
    };
  });

  const activeGroup = grouped.find((group) => group.n === activeN) || grouped[0];

  const negativeCandidates = ngramRows
    .filter((row) => {
      const n = num(row.n);
      const spend = num(row.cost);
      const purchases = num(row.conversions);
      const roas = num(row.roas);
      return spend >= minSpend && purchases === 0 && roas <= 0.1 && (n === 1 || n === 2 || n === 3);
    })
    .sort((a, b) => num(b.cost) - num(a.cost));

  const negativeLines = negativeCandidates
    .map((row) => syntax(str(row.ngram), matchType))
    .filter(Boolean)
    .join("\n");

  async function copyNegatives() {
    try {
      await navigator.clipboard.writeText(negativeLines);
      alert("N-gram negative list copied.");
    } catch {
      alert("Could not copy. Please copy manually.");
    }
  }

  function recommendationForGroup(group: AnyObj) {
    if (num(group.spend) <= 0) {
      return "No material spend in this n-gram layer.";
    }

    if (num(group.purchases) === 0 && num(group.spend) >= minSpend) {
      return "This n-gram layer has spend without purchases. Review repeated terms and add exact/phrase negatives carefully.";
    }

    if (num(group.roas) > 0 && num(group.roas) < 1) {
      return "This n-gram layer has weak revenue efficiency. Prune non-converting repeated patterns first.";
    }

    if (num(group.purchases) > 0) {
      return "This layer contains conversion signal. Do not broadly block all patterns; only negative specific zero-purchase groups.";
    }

    return "Review manually. Use exact negatives first unless the pattern is clearly irrelevant.";
  }

  return (
    <section className="wr-ngram-page">
      <div className="wr-panel wr-ngram-control">
        <div className="wr-panel-head">
          <div>
            <span>N-gram Analysis</span>
            <h2>Search-term word pattern analysis</h2>
            <p className="wr-ngram-help">
              This finds repeated 1-word, 2-word, and 3-word query patterns that consume spend across many search terms.
              Use it to identify phrase-level waste, broad themes, and copy-ready negative keyword candidates.
            </p>
          </div>

          <div className="wr-controls">
            <label>
              Negative min spend
              <input
                type="number"
                min={0}
                step={50}
                value={minSpend}
                onChange={(e) => setMinSpend(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>

            <select value={matchType} onChange={(e) => setMatchType(e.target.value as "exact" | "phrase" | "broad")}>
              <option value="exact">Exact negatives</option>
              <option value="phrase">Phrase negatives</option>
              <option value="broad">Broad negatives</option>
            </select>
          </div>
        </div>
      </div>

      <div className="wr-ngram-card-grid">
        {grouped.map((group) => (
          <button
            key={group.n}
            type="button"
            className={activeN === group.n ? "active" : ""}
            onClick={() => setActiveN(group.n as 1 | 2 | 3)}
          >
            <div className="wr-ngram-card-head">
              <span>{group.label}</span>
              <strong>{int(group.rows.length)} groups</strong>
            </div>

            <div className="wr-ngram-metrics">
              <div>
                <span>Spend</span>
                <strong>{money(group.spend)}</strong>
              </div>
              <div>
                <span>Clicks</span>
                <strong>{int(group.clicks)}</strong>
              </div>
              <div>
                <span>CTR</span>
                <strong>{ctrPct(group.ctr)}</strong>
              </div>
              <div>
                <span>Purch.</span>
                <strong>{num(group.purchases).toFixed(2)}</strong>
              </div>
              <div>
                <span>Conv. value / cost</span>
                <strong>{x(group.roas)}</strong>
              </div>
            </div>

            <p>{recommendationForGroup(group)}</p>
          </button>
        ))}
      </div>

      <div className="wr-ngram-detail-grid">
        <div className="wr-panel">
          <div className="wr-panel-head">
            <div>
              <span>{activeGroup.label} details</span>
              <h2>Groups by cumulative spend</h2>
            </div>
          </div>

          <DataTable
            rows={activeGroup.rows.slice(0, 150)}
            empty={`No ${activeGroup.label} groups found.`}
            columns={[
              { key: "ngram", label: "N-gram group" },
              { key: "term_count", label: "Terms", right: true, render: (row) => int(row.term_count) },
              { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
              { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
              { key: "ctr", label: "CTR", right: true, render: (row) => ctrPct(row.ctr) },
              { key: "conversions", label: "Purch.", right: true, render: (row) => num(row.conversions).toFixed(2) },
              { key: "roas", label: "Conv. value / cost", right: true, render: (row) => x(row.roas) },
              {
                key: "action",
                label: "Action",
                render: (row) =>
                  num(row.cost) >= minSpend && num(row.conversions) === 0 ? (
                    <code>{syntax(str(row.ngram), matchType)}</code>
                  ) : (
                    "Review"
                  ),
              },
            ]}
          />
        </div>

        <div className="wr-panel wr-ngram-negative-panel">
          <div className="wr-category-negative-head">
            <div>
              <span>Summary recommendation</span>
              <strong>{negativeCandidates.length} negative candidates</strong>
            </div>

            <button type="button" onClick={copyNegatives} disabled={!negativeLines}>
              Copy
            </button>
          </div>

          <p className="wr-ngram-help">
            These are repeated word patterns with spend above your threshold, zero purchases, and weak/no conversion value.
            Use exact for specific queries, phrase for repeated 2–3 word patterns, and broad only when the single-word theme is fully irrelevant.
          </p>

          <pre className="wr-ngram-copybox">
            {negativeLines || "No n-gram negative candidates at the selected threshold."}
          </pre>
        </div>
      </div>
    </section>
  );
}



function exportRowsCsv(filename: string, rows: AnyObj[]) {
  if (!rows.length) return;

  const headerSet: Set<string> = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      headerSet.add(key);
    });
  });

  const headers: string[] = Array.from(headerSet);

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row?.[header] ?? "").replaceAll('"', '""')}"`)
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

async function copyToClipboard(value: string, successMessage = "Copied.") {
  try {
    await navigator.clipboard.writeText(value);
    alert(successMessage);
  } catch {
    alert("Could not copy. Please select and copy manually.");
  }
}


type CategoryCardSort = {
  key: string;
  direction: "asc" | "desc";
};

function getKeywordCategory(row: AnyObj) {
  const existing = str(
    row.category ??
      row.keyword_category ??
      row.intent_category ??
      row.bucket ??
      row.b,
    ""
  );

  if (existing && existing !== "-") return existing;

  const term = str(row.search_term ?? row.term ?? row.t).toLowerCase();

  const competitorWords = [
    "olaplex", "traya", "vedix", "minimalist", "loreal", "l oreal", "matrix",
    "biolage", "selsun", "nizoral", "ketomac", "scalpe", "mamaearth",
    "wow", "pilgrim", "foxtale", "bare anatomy", "wella", "kerastase",
    "schwarzkopf", "indulekha", "himalaya", "ogx", "pantene", "dove",
    "cetaphil", "sebamed", "reequil", "re equil", "ybera", "anomaly",
    "richfeel", "amway", "nykaa", "myntra", "amazon", "flipkart"
  ];

  const diyWords = [
    "home remedy", "at home", "kaise", "ghar", "natural remedy", "diy",
    "homemade", "oil for", "coconut", "lemon", "curd", "aloe", "vinegar",
    "remedy", "how to", "tips", "solution at home"
  ];

  const treatmentWords = [
    "treatment", "kit", "serum", "lotion", "cream", "scrub", "ampoule",
    "tonic", "control", "solution", "therapy", "shampoo", "conditioner",
    "scalp"
  ];

  const offProductWords = [
    "body wash", "hand cream", "sunscreen", "skin", "face", "beard",
    "perfume", "soap", "makeup", "powder", "hair color", "hair dye"
  ];

  const genericWords = [
    "hair care", "hair products", "beauty", "personal care", "best hair",
    "hair kit", "hair routine", "hair product", "hair treatment products"
  ];

  if (competitorWords.some((word) => term.includes(word))) return "Competitor / Other Brand";
  if (offProductWords.some((word) => term.includes(word))) return "Off-product / Wrong Category";
  if (diyWords.some((word) => term.includes(word))) return "DIY / Informational";
  if (term.includes("dandruff") || term.includes("anti dandruff") || term.includes("anti-dandruff")) return "Core Problem Intent";
  if (treatmentWords.some((word) => term.includes(word))) return "Treatment / Product Intent";
  if (genericWords.some((word) => term.includes(word))) return "Generic Hair / Broad Intent";

  return "Unclassified / Review";
}

function getKeywordAction(row: AnyObj, category: string) {
  const conversions = num(row.conversions ?? row.cv);
  const spend = num(row.cost ?? row.co);
  const revenue = num(row.revenue ?? row.conv_value ?? row.vl);
  const roas = num(row.roas) || (spend > 0 ? revenue / spend : 0);

  if (conversions > 0 && roas >= 2.5) return "SCALE";
  if (conversions > 0) return "KEEP / WATCH";

  const c = category.toLowerCase();

  if (c.includes("competitor")) return "NEGATIVE unless conquesting";
  if (c.includes("off-product")) return "NEGATIVE";
  if (c.includes("diy") || c.includes("informational")) return "NEGATIVE / CONTENT";
  if (spend >= 100 && conversions === 0) return "WATCH / BID DOWN";
  if (spend > 0 && conversions === 0) return "MONITOR";

  return "REVIEW";
}

function getCategoryVerdict(category: string, spend: number, conversions: number, roas: number) {
  const c = category.toLowerCase();

  if (conversions > 0 && roas >= 2.5) return "Profitable cluster — protect and scale carefully.";
  if (c.includes("competitor")) return "Competitor leakage — add negatives unless conquesting intentionally.";
  if (c.includes("off-product")) return "Wrong-category spend — strongest negative candidate.";
  if (c.includes("diy") || c.includes("informational")) return "Research traffic — block or move to SEO/content.";
  if (c.includes("core") && conversions === 0 && spend > 0) return "Relevant but not converting — check PDP, price, offer, reviews.";
  if (c.includes("treatment") && conversions === 0 && spend > 0) return "Product intent but weak conversion — investigate before blocking.";
  return "Review cluster manually before action.";
}

function getCategoryTone(category: string, conversions: number, roas: number) {
  const c = category.toLowerCase();

  if (conversions > 0 && roas >= 2.5) return "green";
  if (c.includes("competitor")) return "red";
  if (c.includes("off-product")) return "red";
  if (c.includes("diy") || c.includes("informational")) return "amber";
  if (c.includes("core")) return "blue";
  return "neutral";
}

function CategoryKeywordCards({
  terms,
  matchType,
}: {
  terms: AnyObj[];
  matchType: "exact" | "phrase" | "broad";
}) {
  const [openCategory, setOpenCategory] = useState<string>("");
  const [sort, setSort] = useState<CategoryCardSort>({ key: "cost", direction: "desc" });
  const [minSpend, setMinSpend] = useState(0);

  const categoryCards = useMemo(() => {
    const grouped = new Map<string, AnyObj[]>();

    terms.forEach((raw) => {
      const searchTerm = str(raw.search_term ?? raw.term ?? raw.t).trim();
      if (!searchTerm) return;

      const cost = num(raw.cost ?? raw.co);
      if (cost < minSpend) return;

      const clicks = num(raw.clicks ?? raw.cl);
      const impressions = num(raw.impressions ?? raw.im);
      const conversions = num(raw.conversions ?? raw.cv);
      const revenue = num(raw.revenue ?? raw.conv_value ?? raw.vl);
      const roas = num(raw.roas) || (cost > 0 ? revenue / cost : 0);
      const ctr = num(raw.ctr) || (impressions > 0 ? clicks / impressions : 0);
      const avgCpc = num(raw.avg_cpc ?? raw.cpc) || (clicks > 0 ? cost / clicks : 0);
      const campaign = str(
        raw.campaign ??
          raw.campaign_name ??
          raw.Campaign ??
          raw["Campaign"] ??
          "-",
        "-"
      );
      const adGroup = str(
        raw.ad_group ??
          raw.ad_group_name ??
          raw.adgroup ??
          raw["Ad group"] ??
          raw["Ad group name"] ??
          raw.ag ??
          "-",
        "-"
      );

      const category = getKeywordCategory(raw);
      const action = getKeywordAction(
        { ...raw, cost, clicks, impressions, conversions, revenue, roas, ctr },
        category
      );

      const row = {
        ...raw,
        search_term: searchTerm,
        campaign,
        ad_group: adGroup,
        category,
        action,
        cost,
        clicks,
        impressions,
        ctr,
        avg_cpc: avgCpc,
        conversions,
        revenue,
        conv_value: revenue,
        roas,
      };

      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category)!.push(row);
    });

    return Array.from(grouped.entries())
      .map(([category, rows]) => {
        const spend = rows.reduce((sum, row) => sum + num(row.cost), 0);
        const clicks = rows.reduce((sum, row) => sum + num(row.clicks), 0);
        const impressions = rows.reduce((sum, row) => sum + num(row.impressions), 0);
        const conversions = rows.reduce((sum, row) => sum + num(row.conversions), 0);
        const revenue = rows.reduce((sum, row) => sum + num(row.revenue), 0);
        const roas = spend > 0 ? revenue / spend : 0;
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const avgCpc = clicks > 0 ? spend / clicks : 0;
        const tone = getCategoryTone(category, conversions, roas);
        const verdict = getCategoryVerdict(category, spend, conversions, roas);

        return {
          category,
          rows,
          terms: rows.length,
          spend,
          clicks,
          impressions,
          ctr,
          avgCpc,
          conversions,
          revenue,
          roas,
          tone,
          verdict,
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [terms, minSpend]);

  const sortedRows = (rows: AnyObj[]) => {
    return [...rows].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];

      const leftNum = num(left);
      const rightNum = num(right);

      if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum) && (leftNum || rightNum)) {
        return sort.direction === "desc" ? rightNum - leftNum : leftNum - rightNum;
      }

      return sort.direction === "desc"
        ? str(right).localeCompare(str(left))
        : str(left).localeCompare(str(right));
    });
  };

  function toggleSort(key: string) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }

  function negativeRows(rows: AnyObj[]) {
    return rows.filter((row) => {
      const action = str(row.action).toLowerCase();
      return (
        num(row.cost) > 0 &&
        num(row.conversions) === 0 &&
        (action.includes("negative") ||
          str(row.category).toLowerCase().includes("competitor") ||
          str(row.category).toLowerCase().includes("off-product") ||
          str(row.category).toLowerCase().includes("informational"))
      );
    });
  }

  function exportCategoryRows(category: string, rows: AnyObj[]) {
    const exportRows = rows.map((row) => ({
      Category: category,
      Campaign: str(row.campaign, "-"),
      "Ad group": str(row.ad_group, "-"),
      "Search term": str(row.search_term),
      "Negative keyword": syntax(str(row.search_term), matchType),
      "Match type": matchType,
      Action: str(row.action),
      Spend: Math.round(num(row.cost)),
      Clicks: Math.round(num(row.clicks)),
      Impressions: Math.round(num(row.impressions)),
      CTR: `${(num(row.ctr) * 100).toFixed(2)}%`,
      "Avg CPC": num(row.avg_cpc).toFixed(2),
      Conversions: num(row.conversions).toFixed(2),
      "Conv. value": Math.round(num(row.revenue)),
      ROAS: num(row.roas).toFixed(2),
    }));

    exportRowsCsv(`${category.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}-keywords.csv`, exportRows);
  }

  function exportCategoryNegatives(category: string, rows: AnyObj[]) {
    const candidates = negativeRows(rows);

    const exportRows = candidates.map((row) => ({
      Campaign: str(row.campaign, ""),
      "Ad group": str(row.ad_group, ""),
      Keyword: syntax(str(row.search_term), matchType),
      "Match type": matchType,
      Reason: str(row.action),
      Spend: Math.round(num(row.cost)),
      Clicks: Math.round(num(row.clicks)),
      CTR: `${(num(row.ctr) * 100).toFixed(2)}%`,
      Conversions: num(row.conversions).toFixed(2),
      "Conv. value": Math.round(num(row.revenue)),
      ROAS: num(row.roas).toFixed(2),
    }));

    exportRowsCsv(`${category.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}-negative-keywords.csv`, exportRows);
  }

  function copyCategoryNegatives(rows: AnyObj[]) {
    const lines = negativeRows(rows)
      .map((row) => syntax(str(row.search_term), matchType))
      .join("\n");

    copyToClipboard(lines, "Category negative keyword list copied.");
  }

  return (
    <section className="kc-wrap">
      <div className="kc-head">
        <div>
          <span>Keyword Category Cards</span>
          <h2>Category-level keyword diagnosis</h2>
          <p>
            Dynamic category cards from uploaded search terms. Open a card to inspect keywords, sort columns, export category rows, or copy negatives.
          </p>
        </div>

        <label className="kc-filter">
          Minimum spend
          <input
            type="number"
            min="0"
            value={minSpend}
            onChange={(e) => setMinSpend(Number(e.target.value || 0))}
          />
        </label>
      </div>

      <div className="kc-grid">
        {categoryCards.map((card) => {
          const isOpen = openCategory === card.category;
          const negatives = negativeRows(card.rows);

          return (
            <article key={card.category} className={`kc-card ${isOpen ? "open" : ""} ${card.tone}`}>
              <div className="kc-bar" />

              <button
                type="button"
                className="kc-card-top"
                onClick={() => setOpenCategory(isOpen ? "" : card.category)}
              >
                <div>
                  <h3>
                    <i />
                    {card.category}
                  </h3>
                  <p>{card.verdict}</p>
                </div>

                <strong>{isOpen ? "▲" : "▼"}</strong>
              </button>

              <div className="kc-stats">
                <Kpi label="Terms" value={int(card.terms)} />
                <Kpi label="Spend" value={money(card.spend)} tone={card.spend > 0 ? "red" : "neutral"} />
                <Kpi label="Clicks" value={int(card.clicks)} />
                <Kpi label="CTR" value={ctrPct(card.ctr)} tone="blue" />
                <Kpi label="Purchases" value={num(card.conversions).toFixed(2)} />
                <Kpi label="Revenue" value={money(card.revenue)} tone={card.revenue > 0 ? "green" : "neutral"} />
                <Kpi label="ROAS" value={x(card.roas)} tone={card.roas >= 2.5 ? "green" : card.roas > 0 ? "amber" : "red"} />
                <Kpi label="Negatives" value={int(negatives.length)} tone={negatives.length ? "red" : "green"} />
              </div>

              {isOpen ? (
                <div className="kc-panel">
                  <div className="kc-actions">
                    <button type="button" onClick={() => exportCategoryRows(card.category, card.rows)}>
                      Export category CSV
                    </button>
                    <button type="button" onClick={() => exportCategoryNegatives(card.category, card.rows)} disabled={!negatives.length}>
                      Export negatives CSV
                    </button>
                    <button type="button" onClick={() => copyCategoryNegatives(card.rows)} disabled={!negatives.length}>
                      Copy negatives
                    </button>
                  </div>

                  <div className="kc-table-wrap">
                    <table className="kc-table">
                      <thead>
                        <tr>
                          <th className="left" onClick={() => toggleSort("search_term")}>Search term</th>
                          <th className="left" onClick={() => toggleSort("campaign")}>Campaign</th>
                          <th className="left" onClick={() => toggleSort("ad_group")}>Ad group</th>
                          <th onClick={() => toggleSort("cost")}>Spend</th>
                          <th onClick={() => toggleSort("clicks")}>Clicks</th>
                          <th onClick={() => toggleSort("impressions")}>Impr.</th>
                          <th onClick={() => toggleSort("ctr")}>CTR</th>
                          <th onClick={() => toggleSort("conversions")}>Purch.</th>
                          <th onClick={() => toggleSort("revenue")}>Conv. value</th>
                          <th onClick={() => toggleSort("roas")}>ROAS</th>
                          <th className="left" onClick={() => toggleSort("action")}>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {sortedRows(card.rows).slice(0, 300).map((row, index) => (
                          <tr key={`${row.search_term}-${index}`}>
                            <td className="left kw">{str(row.search_term)}</td>
                            <td className="left">{str(row.campaign, "-")}</td>
                            <td className="left">{str(row.ad_group, "-")}</td>
                            <td>{money(row.cost)}</td>
                            <td>{int(row.clicks)}</td>
                            <td>{int(row.impressions)}</td>
                            <td>{ctrPct(row.ctr)}</td>
                            <td>{num(row.conversions).toFixed(2)}</td>
                            <td>{money(row.revenue)}</td>
                            <td>{x(row.roas)}</td>
                            <td className="left">
                              <span className={`kc-tag ${str(row.action).toLowerCase().includes("negative") ? "neg" : str(row.action).toLowerCase().includes("scale") ? "scale" : str(row.action).toLowerCase().includes("watch") ? "watch" : "keep"}`}>
                                {str(row.action)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        {!categoryCards.length ? (
          <div className="wr-empty">
            <strong>No keyword categories found</strong>
            <p>Upload a search-term file with spend-bearing rows.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}



function KeywordCategoryCards({
  terms,
  matchType,
}: {
  terms: AnyObj[];
  matchType: "exact" | "phrase" | "broad";
}) {
  const [openCategory, setOpenCategory] = useState<string>("");
  const [minSpend, setMinSpend] = useState(0);

  const cards = useMemo(() => {
    const grouped = new Map<string, AnyObj[]>();

    terms.forEach((row) => {
      const searchTerm = str((row as AnyObj).search_term ?? (row as AnyObj).term).trim();
      const spend = num((row as AnyObj).cost);

      if (!searchTerm || spend < minSpend) return;

      const category = typeof getKeywordCategory === "function"
        ? getKeywordCategory(row as AnyObj)
        : str((row as AnyObj).category, "Unclassified / Review");

      const clicks = num((row as AnyObj).clicks);
      const impressions = num((row as AnyObj).impressions);
      const conversions = num((row as AnyObj).conversions);
      const revenue = num((row as AnyObj).revenue ?? (row as AnyObj).conv_value);
      const roas = spend > 0 ? revenue / spend : 0;
      const ctr = impressions > 0 ? clicks / impressions : num((row as AnyObj).ctr);

      const item = {
        ...(row as AnyObj),
        search_term: searchTerm,
        category,
        campaign: str((row as AnyObj).campaign ?? (row as AnyObj).campaign_name ?? "-"),
        ad_group: str((row as AnyObj).ad_group ?? (row as AnyObj).ad_group_name ?? (row as AnyObj).ag ?? "-"),
        cost: spend,
        clicks,
        impressions,
        ctr,
        conversions,
        revenue,
        roas,
        action: typeof getKeywordAction === "function" ? getKeywordAction(row as AnyObj, category) : "REVIEW",
      };

      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category)!.push(item);
    });

    return Array.from(grouped.entries())
      .map(([category, rows]) => {
        const spend = rows.reduce((sum, row) => sum + num(row.cost), 0);
        const clicks = rows.reduce((sum, row) => sum + num(row.clicks), 0);
        const impressions = rows.reduce((sum, row) => sum + num(row.impressions), 0);
        const conversions = rows.reduce((sum, row) => sum + num(row.conversions), 0);
        const revenue = rows.reduce((sum, row) => sum + num(row.revenue), 0);
        const roas = spend > 0 ? revenue / spend : 0;
        const ctr = impressions > 0 ? clicks / impressions : 0;

        return {
          category,
          rows: rows.sort((a, b) => num(b.cost) - num(a.cost)),
          spend,
          clicks,
          impressions,
          conversions,
          revenue,
          roas,
          ctr,
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [terms, minSpend]);

  function exportCategory(card: AnyObj) {
    exportRowsCsv(
      `${str(card.category).toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}.csv`,
      arr<AnyObj>(card.rows).map((row) => ({
        Category: str(card.category),
        Campaign: str(row.campaign, "-"),
        "Ad group": str(row.ad_group, "-"),
        "Search term": str(row.search_term),
        "Negative keyword": syntax(str(row.search_term), matchType),
        "Match type": matchType,
        Spend: Math.round(num(row.cost)),
        Clicks: Math.round(num(row.clicks)),
        Impressions: Math.round(num(row.impressions)),
        CTR: `${(num(row.ctr) * 100).toFixed(2)}%`,
        Conversions: num(row.conversions).toFixed(2),
        "Conv. value": Math.round(num(row.revenue)),
        ROAS: num(row.roas).toFixed(2),
        Action: str(row.action),
      }))
    );
  }

  return (
    <section className="kc-wrap">
      <div className="kc-head">
        <div>
          <span>Keyword Category Cards</span>
          <h2>Category-level keyword diagnosis</h2>
          <p>Dynamic category cards from uploaded search terms. Open a category to inspect terms and export rows.</p>
        </div>

        <label className="kc-filter">
          Minimum spend
          <input
            type="number"
            min="0"
            value={minSpend}
            onChange={(e) => setMinSpend(Number(e.target.value || 0))}
          />
        </label>
      </div>

      <div className="kc-grid">
        {cards.map((card) => {
          const isOpen = openCategory === card.category;

          return (
            <article key={card.category} className="kc-card">
              <button
                type="button"
                className="kc-card-top"
                onClick={() => setOpenCategory(isOpen ? "" : card.category)}
              >
                <div>
                  <h3>{str(card.category)}</h3>
                  <p>{int(card.rows.length)} terms · {money(card.spend)} spend · {x(card.roas)} ROAS</p>
                </div>
                <strong>{isOpen ? "▲" : "▼"}</strong>
              </button>

              <div className="kc-stats">
                <Kpi label="Terms" value={int(card.rows.length)} />
                <Kpi label="Spend" value={money(card.spend)} tone="red" />
                <Kpi label="Clicks" value={int(card.clicks)} />
                <Kpi label="CTR" value={ctrPct(card.ctr)} tone="blue" />
                <Kpi label="Purchases" value={num(card.conversions).toFixed(2)} />
                <Kpi label="Revenue" value={money(card.revenue)} tone={card.revenue > 0 ? "green" : "neutral"} />
                <Kpi label="ROAS" value={x(card.roas)} tone={card.roas >= 2.5 ? "green" : "red"} />
              </div>

              {isOpen ? (
                <div className="kc-panel">
                  <div className="kc-actions">
                    <button type="button" onClick={() => exportCategory(card)}>
                      Export category CSV
                    </button>
                  </div>

                  <div className="kc-table-wrap">
                    <table className="kc-table">
                      <thead>
                        <tr>
                          <th className="left">Search term</th>
                          <th className="left">Campaign</th>
                          <th className="left">Ad group</th>
                          <th>Spend</th>
                          <th>Clicks</th>
                          <th>Impr.</th>
                          <th>CTR</th>
                          <th>Conv.</th>
                          <th>Conv. value</th>
                          <th>ROAS</th>
                          <th className="left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arr<AnyObj>(card.rows).slice(0, 300).map((row, index) => (
                          <tr key={`${row.search_term}-${index}`}>
                            <td className="left kw">{str(row.search_term)}</td>
                            <td className="left">{str(row.campaign, "-")}</td>
                            <td className="left">{str(row.ad_group, "-")}</td>
                            <td>{money(row.cost)}</td>
                            <td>{int(row.clicks)}</td>
                            <td>{int(row.impressions)}</td>
                            <td>{ctrPct(row.ctr)}</td>
                            <td>{num(row.conversions).toFixed(2)}</td>
                            <td>{money(row.revenue)}</td>
                            <td>{x(row.roas)}</td>
                            <td className="left">{str(row.action)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}



function ManualAiBrainPanel({ terms, ngramRows }: { terms: AnyObj[]; ngramRows: AnyObj[] }) {
  const [aiText, setAiText] = useState("");
  const [parsed, setParsed] = useState<AnyObj | null>(null);
  const [error, setError] = useState("");

  const prompt = useMemo(() => {
    const topSpend = [...terms].sort((a, b) => num(b.cost) - num(a.cost)).slice(0, 250);
    const zeroPurchase = topSpend.filter((row) => num(row.conversions) === 0).slice(0, 150);
    const converters = [...terms].filter((row) => num(row.conversions) > 0).slice(0, 100);

    const payload = {
      total_terms: terms.length,
      top_spend_terms: topSpend.map((row) => ({
        search_term: str(row.search_term),
        campaign: str((row as AnyObj).campaign, ""),
        ad_group: str((row as AnyObj).ad_group, ""),
        spend: Math.round(num(row.cost)),
        clicks: Math.round(num(row.clicks)),
        impressions: Math.round(num(row.impressions)),
        ctr: num(row.ctr),
        conversions: num(row.conversions),
        conv_value: Math.round(num(row.revenue ?? row.conv_value)),
        roas: num(row.roas),
      })),
      zero_purchase_terms: zeroPurchase.map((row) => str(row.search_term)),
      converting_terms: converters.map((row) => str(row.search_term)),
      top_ngrams: ngramRows.slice(0, 100),
    };

    return `You are a top 0.001% Google Shopping performance marketing operator.

Analyze this Google Ads search-term dataset. Create a dynamic category taxonomy based on the uploaded keywords. Do not use fixed dandruff-only logic.

Return ONLY valid JSON with this schema:
{
  "detected_theme": "string",
  "strategic_summary": ["max 8 lines"],
  "categories": [
    {
      "name": "string",
      "definition": "string",
      "default_action": "string",
      "negative_aggressiveness": "low|medium|high"
    }
  ],
  "negative_candidates": [
    {
      "search_term": "string",
      "match_type": "exact|phrase|broad",
      "reason": "string",
      "confidence": 0.0
    }
  ],
  "watchouts": ["string"]
}

Dataset:
${JSON.stringify(payload, null, 2)}`;
  }, [terms, ngramRows]);

  function applyResponse() {
    try {
      const cleaned = aiText.trim().replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
      const obj = JSON.parse(cleaned);
      setParsed(obj);
      setError("");
      localStorage.setItem("manual_ai_brain_response", JSON.stringify(obj));
    } catch {
      setParsed(null);
      setError("Invalid JSON. Ask ChatGPT/Claude to return JSON only.");
    }
  }

  const categories = arr<AnyObj>(parsed?.categories);
  const negatives = arr<AnyObj>(parsed?.negative_candidates);

  return (
    <section className="wr-panel" style={{ maxWidth: 1220, margin: "0 auto" }}>
      <div className="wr-panel-head">
        <div>
          <span>Manual AI Brain</span>
          <h2>ChatGPT / Claude workflow without API cost</h2>
          <p className="wr-category-help">
            Copy the prompt, paste into ChatGPT or Claude, then paste the JSON response back here.
          </p>
        </div>

        <div className="wr-controls">
          <button type="button" onClick={() => copyToClipboard(prompt, "AI prompt copied.")}>Copy prompt</button>
          <button type="button" onClick={() => window.open("https://chatgpt.com", "_blank")}>Open ChatGPT</button>
          <button type="button" onClick={() => window.open("https://claude.ai", "_blank")}>Open Claude</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <textarea readOnly value={prompt} style={{ minHeight: 420, borderRadius: 14, padding: 12, background: "var(--wr-panel2)", color: "var(--wr-dim)", border: "1px solid var(--wr-line)", fontSize: 11 }} />
        <div>
          <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste JSON response here..." style={{ width: "100%", minHeight: 360, borderRadius: 14, padding: 12, background: "var(--wr-panel2)", color: "var(--wr-ink)", border: "1px solid var(--wr-line)", fontSize: 11 }} />
          <button type="button" onClick={applyResponse} style={{ marginTop: 10 }}>Apply / Validate</button>
          {error ? <p style={{ color: "#EA4335" }}>{error}</p> : null}
        </div>
      </div>

      {parsed ? (
        <div style={{ marginTop: 14 }}>
          <h3>{str(parsed.detected_theme, "Detected theme")}</h3>
          <div className="wr-metric-grid">
            <Kpi label="Categories" value={int(categories.length)} />
            <Kpi label="Negative candidates" value={int(negatives.length)} tone={negatives.length ? "red" : "green"} />
            <Kpi label="Uploaded terms" value={int(terms.length)} />
          </div>
          <DataTable
            rows={categories}
            columns={[
              { key: "name", label: "Category" },
              { key: "definition", label: "Definition" },
              { key: "default_action", label: "Default action" },
              { key: "negative_aggressiveness", label: "Negative aggression" },
            ]}
            empty="No AI categories found."
          />
        </div>
      ) : null}
    </section>
  );
}


function ActionReportPanel({
  execSummary,
  checklist,
  markdown,
  negatives,
  fallbackKillSpend,
  fallbackWatchCount,
  fallbackWinnerCount,
}: {
  execSummary: string[];
  checklist: AnyObj[];
  markdown: string;
  negatives: AnyObj[];
  fallbackKillSpend: number;
  fallbackWatchCount: number;
  fallbackWinnerCount: number;
}) {
  const [reportView, setReportView] = useState<"negatives" | "actions" | "summary">("negatives");
  const [exportType, setExportType] = useState<"negatives" | "actions" | "markdown">("negatives");

  const hasReport = execSummary.length > 0 || checklist.length > 0 || negatives.length > 0;

  const groupedActions: AnyObj[] = ["Cut Now", "Add Negatives", "Fix Don't Cut", "Scale", "Prove-Out", "Investigate"]
    .flatMap((group) =>
      checklist
        .filter((item) => str((item as AnyObj).group) === group)
        .map((item): AnyObj => ({ ...(item as AnyObj), group }))
    );

  function handleExport() {
    if (exportType === "negatives") {
      exportRowsCsv("negative-keyword-sheet.csv", negatives);
      return;
    }

    if (exportType === "actions") {
      exportRowsCsv("action-checklist.csv", checklist);
      return;
    }

    copyToClipboard(markdown, "Markdown action report copied.");
  }

  if (!hasReport) {
    return (
      <section className="wr-action-report-page">
        <div className="wr-panel">
          <div className="wr-panel-head">
            <div>
              <span>Action Report</span>
              <h2>Backend action report not found</h2>
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
              <strong>{money(fallbackKillSpend)} direct leakage identified</strong>
            </div>

            <div className="wr-step yellow">
              <h3>3. Fix core watchlist terms</h3>
              <p>If a relevant term gets clicks but no purchases, it is likely a PDP, price, offer, review, or checkout issue.</p>
              <strong>{fallbackWatchCount} core terms need investigation</strong>
            </div>

            <div className="wr-step green">
              <h3>4. Protect and scale winners</h3>
              <p>Winner terms should be isolated into controlled structures, improved in feed titles, and used for copy/PDP learning.</p>
              <strong>{fallbackWinnerCount} converting terms found</strong>
            </div>
          </div>

          <p className="wr-report-warning">
            The frontend did not receive <code>action_report</code> from the backend response. Upload again after Railway finishes deployment.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="wr-action-report-page">
      <div className="wr-panel wr-report-shell">
        <div className="wr-report-top">
          <div>
            <span>Action Report</span>
            <h2>Operator action sheet</h2>
            <p>
              Compact campaign-ready output: export negatives, review other actions, or copy the executive summary.
            </p>
          </div>

          <div className="wr-report-controls">
            <label>
              View
              <select value={reportView} onChange={(e) => setReportView(e.target.value as "negatives" | "actions" | "summary")}>
                <option value="negatives">Negative keywords ({negatives.length})</option>
                <option value="actions">Other actions ({groupedActions.length})</option>
                <option value="summary">Executive summary</option>
              </select>
            </label>

            <label>
              Export
              <select value={exportType} onChange={(e) => setExportType(e.target.value as "negatives" | "actions" | "markdown")}>
                <option value="negatives">Negative CSV</option>
                <option value="actions">Action CSV</option>
                <option value="markdown">Markdown copy</option>
              </select>
            </label>

            <button type="button" onClick={handleExport}>
              Export
            </button>
          </div>
        </div>

        {reportView === "summary" ? (
          <div className="wr-exec-summary compact">
            {execSummary.slice(0, 8).map((line, index) => (
              <div key={index}>
                <span>{index + 1}</span>
                <p>{line}</p>
              </div>
            ))}
          </div>
        ) : null}

        {reportView === "negatives" ? (
          <div className="wr-report-table-wrap">
            {negatives.length ? (
              <table className="wr-report-table">
                <thead>
                  <tr>
                    <th>Negative keyword</th>
                    <th>Match</th>
                    <th className="right">Spend</th>
                    <th className="right">Clicks</th>
                    <th className="right">CTR</th>
                    <th className="right">Conv.</th>
                    <th className="right">Conv. value</th>
                    <th className="right">ROAS</th>
                    <th>Campaign</th>
                    <th>Ad group</th>
                    <th>Reason</th>
                    <th>Overlap</th>
                  </tr>
                </thead>

                <tbody>
                  {negatives.slice(0, 300).map((row, index) => (
                    <tr key={`${row.syntax || row.term}-${index}`}>
                      <td>
                        <code>{str(row.syntax, str(row.term))}</code>
                      </td>
                      <td>{str(row.match_type, "exact")}</td>
                      <td className="right strong">{money(row.spend ?? row.wasted_spend)}</td>
                      <td className="right">{int(row.clicks)}</td>
                      <td className="right">{reportPct(row.ctr)}</td>
                      <td className="right">{num(row.conversions).toFixed(2)}</td>
                      <td className="right">{money(row.revenue ?? row.conv_value)}</td>
                      <td className="right">{x(row.roas)}</td>
                      <td>{str(row.campaign, "-")}</td>
                      <td>{str(row.ad_group, "-")}</td>
                      <td>{str(row.reason)}</td>
                      <td>
                        <span className={str(row.overlap_safe, "Y") === "Y" ? "safe" : "warn"}>
                          {str(row.overlap_safe, "Y") === "Y" ? "Safe" : "Overlap"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="wr-empty">
                <strong>No negative keyword rows</strong>
                <p>No operator-ready negative sheet was returned or generated.</p>
              </div>
            )}
          </div>
        ) : null}

        {reportView === "actions" ? (
          <div className="wr-report-table-wrap">
            {groupedActions.length ? (
              <table className="wr-report-table actions">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Instruction</th>
                    <th>Term</th>
                    <th className="right">₹ Impact</th>
                    <th>Type</th>
                    <th>Confidence</th>
                    <th>Reason</th>
                  </tr>
                </thead>

                <tbody>
                  {groupedActions.slice(0, 300).map((row, index) => (
                    <tr key={`${row.id || row.term}-${index}`}>
                      <td>{str(row.group)}</td>
                      <td className="strong">{str(row.instruction, str(row.title, "Review action"))}</td>
                      <td>
                        <code>{str(row.term, "-")}</code>
                      </td>
                      <td className="right strong">{money(row.impact)}</td>
                      <td>{str(row.type, "action")}</td>
                      <td>{str(row.confidence, "Medium")}</td>
                      <td>{str(row.reason, str(row.description))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="wr-empty">
                <strong>No action rows</strong>
                <p>The backend did not return checklist items.</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
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
  const [activeTab, setActiveTab] = useState<TabKey>("command_center");
  const [googleOsModel, setGoogleOsModel] = useState<GoogleOsModel | null>(null);
  const [googleOsUploadName, setGoogleOsUploadName] = useState("");
  const [googleOsUploadError, setGoogleOsUploadError] = useState("");
  const [googleOsSheetUrl, setGoogleOsSheetUrl] = useState("");
  const [googleOsLoading, setGoogleOsLoading] = useState(false);

  async function loadGoogleOsSheetUrl(urlInput?: string) {
    const rawUrl = (urlInput || googleOsSheetUrl).trim();
    const url = normalizeGoogleSheetCsvUrl(rawUrl);

    if (!url) {
      setGoogleOsUploadError("Paste your published Google Sheet CSV URL first.");
      return;
    }

    setGoogleOsLoading(true);
    setGoogleOsUploadError("");

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Could not fetch Google Sheet CSV. Status ${response.status}`);
      }

      const csvText = await response.text();
      const rows = parseCsv(csvText);
      const model = buildGoogleOsModel(rows);

      if (!model.rows.length) {
        throw new Error("No valid Google Ads rows found in the connected sheet.");
      }

      setGoogleOsModel(model);
      setGoogleOsUploadName("Connected Google Sheet");
      localStorage.setItem("google_os_sheet_csv_url", url);
      setActiveTab("command_center");
    } catch (error) {
      setGoogleOsModel(null);
      setGoogleOsUploadError(error instanceof Error ? error.message : "Could not load Google Sheet CSV.");
    } finally {
      setGoogleOsLoading(false);
    }
  }

  useEffect(() => {
    const savedUrl = localStorage.getItem("google_os_sheet_csv_url") || "";
    if (!savedUrl) return;

    setGoogleOsSheetUrl(savedUrl);

    // Auto-load saved Google Sheet after first render.
    setTimeout(() => {
      loadGoogleOsSheetUrl(savedUrl);
    }, 50);
  }, []);

  async function handleGoogleOsCsvUpload(file: File | null) {
    if (!file) return;

    setGoogleOsUploadName(file.name);
    setGoogleOsUploadError("");

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const model = buildGoogleOsModel(rows);

      if (!model.rows.length) {
        throw new Error("No valid Google Ads rows found. Export the raw data tab as CSV and upload again.");
      }

      setGoogleOsModel(model);
      setActiveTab("command_center");
    } catch (error) {
      setGoogleOsModel(null);
      setGoogleOsUploadError(error instanceof Error ? error.message : "Could not parse Google Ads CSV.");
    }
  }

  const [threshold, setThreshold] = useState(100);
  const [matchType, setMatchType] = useState<"exact" | "phrase" | "broad">("exact");
  const [categoryNegativeMatchType, setCategoryNegativeMatchType] = useState<"exact" | "phrase" | "broad">("exact");
  const [categoryNegativeMinSpend, setCategoryNegativeMinSpend] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const data = result as AnyObj;
  const summary = (data.summary || {}) as AnyObj;

  const terms = useMemo(() => {
    return arr<AnyObj>(data.terms)
      .slice()
      .map((row) => {
        const searchTerm = str(row.search_term);
        const conversions = num(row.conversions);
        const category = classifyTerm(searchTerm, conversions);
        const clicks = num(row.clicks);
        const impressions = num(row.impressions);
        const ctr = num(row.ctr) || (impressions > 0 ? clicks / impressions : 0);

        const campaign = str(
          (row as AnyObj).campaign ??
            (row as AnyObj).campaign_name ??
            (row as AnyObj).Campaign ??
            (row as AnyObj)["Campaign"] ??
            "-",
          "-"
        );

        const adGroup = str(
          (row as AnyObj).ad_group ??
            (row as AnyObj).ad_group_name ??
            (row as AnyObj).adgroup ??
            (row as AnyObj)["Ad group"] ??
            (row as AnyObj)["Ad group name"] ??
            (row as AnyObj).AdGroup ??
            "-",
          "-"
        );

        return {
          ...row,
          search_term: searchTerm,
          campaign,
          ad_group: adGroup,
          cost: num(row.cost),
          clicks,
          impressions,
          ctr,
          conversions,
          revenue: num(row.revenue ?? (row as AnyObj).conv_value),
          roas: num(row.roas),
          category,
        };
      })
      .sort((a, b) => num(b.cost) - num(a.cost));
  }, [data]);

  const recommendations = useMemo(() => arr<AnyObj>(data.recommendations), [data]);

  const actionReport = (data.action_report || {}) as AnyObj;
  const actionChecklist = arr<AnyObj>(actionReport.checklist);
  const actionExecSummary = arr<string>(actionReport.exec_summary);
  const actionMarkdown = str(actionReport.markdown);
  const negativeKeywordSheet = arr<AnyObj>(data.negative_keyword_sheet);


  const ngramRows = useMemo<AnyObj[]>(() => {
    const ngrams = (data.ngrams || {}) as AnyObj;

    return [
      ...arr<AnyObj>(ngrams["1"]).map((r): AnyObj => ({ ...r, n: 1 })),
      ...arr<AnyObj>(ngrams["2"]).map((r): AnyObj => ({ ...r, n: 2 })),
      ...arr<AnyObj>(ngrams["3"]).map((r): AnyObj => ({ ...r, n: 3 })),
    ]
      .map((row) => {
        const clicks = num(row.clicks);
        const impressions = num(row.impressions);
        const cost = num(row.cost);
        const revenue = num((row as AnyObj).revenue ?? (row as AnyObj).conv_value);
        const roas = num(row.roas) || (cost > 0 ? revenue / cost : 0);
        const ctr = num(row.ctr) || (impressions > 0 ? clicks / impressions : 0);

        return {
          ...row,
          cost,
          clicks,
          impressions,
          ctr,
          conversions: num(row.conversions),
          revenue,
          roas,
          waste: num(row.aggregate_wasted_spend || row.waste_score || row.cost),
        };
      })
      .sort((a, b) => num(b.waste) - num(a.waste));
  }, [data]);

  const wasteRows = useMemo(() => {
    return terms.filter((row) => num(row.cost) >= threshold && num(row.conversions) === 0);
  }, [terms, threshold]);

  const wasteAverageCtr = useMemo(() => {
    const clicks = wasteRows.reduce((sum, row) => sum + num(row.clicks), 0);
    const impressions = wasteRows.reduce((sum, row) => sum + num(row.impressions), 0);
    return impressions > 0 ? clicks / impressions : 0;
  }, [wasteRows]);

  const negativeLines = useMemo(() => {
    return wasteRows
      .map((row) => syntax(str(row.search_term), matchType))
      .filter(Boolean)
      .join("\n");
  }, [wasteRows, matchType]);

  function handleWasteSpenderExport() {
    const exportType = (
      document.getElementById("waste-export-type") as HTMLSelectElement | null
    )?.value || "review";

    const rows = wasteRows.map((row) => {
      const term = str(row.search_term).trim().toLowerCase();
      const spend = num(row.cost);
      const clicks = num(row.clicks);
      const impressions = num(row.impressions);
      const ctr = num(row.ctr) || (impressions > 0 ? clicks / impressions : 0);
      const revenue = num((row as AnyObj).revenue ?? (row as AnyObj).conv_value);
      const roas = spend > 0 ? revenue / spend : 0;

      if (exportType === "google_ads") {
        return {
          Campaign: str((row as AnyObj).campaign, ""),
          "Ad group": str((row as AnyObj).ad_group, ""),
          Keyword: syntax(term, matchType),
          "Match type": matchType,
        };
      }

      return {
        Campaign: str((row as AnyObj).campaign, ""),
        "Ad group": str((row as AnyObj).ad_group, ""),
        "Search term": term,
        "Negative keyword": syntax(term, matchType),
        "Match type": matchType,
        Spend: Math.round(spend),
        Clicks: Math.round(clicks),
        Impressions: Math.round(impressions),
        CTR: `${(ctr * 100).toFixed(2)}%`,
        Conversions: num(row.conversions).toFixed(2),
        "Conv. value": Math.round(revenue),
        ROAS: roas.toFixed(2),
        Reason: `Zero-purchase search term with ${money(spend)} spend and ${int(clicks)} clicks.`,
      };
    });

    if (exportType === "copy") {
      copyToClipboard(negativeLines, "Waste Spender negative list copied.");
      return;
    }

    exportRowsCsv(
      exportType === "google_ads" ? "google-ads-negative-keywords.csv" : "waste-spender-review.csv",
      rows
    );
  }

  const spendMix = useMemo<AnyObj[]>(() => {
    const map = new Map<string, AnyObj>();

    terms.forEach((row) => {
      const category = str(row.category, "Unknown");
      const current = map.get(category) || {
        category,
        spend: 0,
        clicks: 0,
        impressions: 0,
        terms: 0,
        conversions: 0,
        revenue: 0,
      };

      current.spend += num(row.cost);
      current.clicks += num(row.clicks);
      current.impressions += num(row.impressions);
      current.terms += 1;
      current.conversions += num(row.conversions);
      current.revenue += num(row.revenue);
      map.set(category, current);
    });

    return Array.from(map.values())
      .map((row): AnyObj => ({
        ...row,
        spend: num(row.spend),
        clicks: num(row.clicks),
        impressions: num(row.impressions),
        terms: num(row.terms),
        conversions: num(row.conversions),
        revenue: num(row.revenue),
        ctr: num(row.impressions) > 0 ? num(row.clicks) / num(row.impressions) : 0,
      }))
      .sort((a: AnyObj, b: AnyObj) => num(b.spend) - num(a.spend));
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
        ["Competitor", "Marketplace", "DIY / Informational", "Off-product", "Generic hair"].includes(category)
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

  const operatorNegativeKeywordSheet = useMemo(() => {
    if (negativeKeywordSheet.length > 0) {
      return negativeKeywordSheet;
    }

    const candidates = [...killRows, ...wasteRows]
      .filter((row) => num(row.conversions) === 0 && num(row.cost) > 0)
      .sort((a, b) => num(b.cost) - num(a.cost));

    const seen = new Set<string>();

    return candidates
      .map((row) => {
        const term = str(row.search_term).trim().toLowerCase();
        if (!term || seen.has(term)) return null;
        seen.add(term);

        const spend = num(row.cost);
        const clicks = num(row.clicks);
        const impressions = num(row.impressions);
        const ctr = num(row.ctr) || (impressions > 0 ? clicks / impressions : 0);
        const revenue = num((row as AnyObj).revenue ?? (row as AnyObj).conv_value);
        const roas = spend > 0 ? revenue / spend : 0;
        const category = str(row.category, "Waste");

        let matchType: "exact" | "phrase" | "broad" = "exact";

        if (
          category.toLowerCase().includes("marketplace") ||
          category.toLowerCase().includes("informational") ||
          category.toLowerCase().includes("competitor")
        ) {
          matchType = "exact";
        }

        return {
          term,
          search_term: term,
          syntax: syntax(term, matchType),
          match_type: matchType,
          spend,
          wasted_spend: spend,
          clicks,
          impressions,
          ctr,
          conversions: num(row.conversions),
          revenue,
          conv_value: revenue,
          roas,
          campaign: str((row as AnyObj).campaign, "-"),
          ad_group: str((row as AnyObj).ad_group, "-"),
          category,
          reason: `${category} search term with ${money(spend)} spend, ${int(clicks)} clicks, and zero purchases.`,
          overlap_safe: "Y",
          confidence: spend >= 500 ? "High" : "Medium",
          source: "frontend_operator_fallback",
        };
      })
      .filter(Boolean) as AnyObj[];
  }, [negativeKeywordSheet, killRows, wasteRows]);
  const maxSpendMix = Math.max(...spendMix.map((row) => row.spend), 1);
  const maxFrag = Math.max(...fragmentation.map((row) => row.spend), 1);
  const maxPattern = Math.max(...ngramRows.slice(0, 20).map((row) => num(row.cost)), 1);

  const modularSearchTermModel = useMemo(() => {
    if (!data) return null;
    return normalizeAnalyzeResponse(data as Record<string, unknown>);
  }, [data]);

  const tabCounts: Partial<Record<TabKey, number>> = {
    command_center: googleOsModel?.rows.length || 0,
    campaigns: googleOsModel?.campaigns.length || 0,
    ad_groups: googleOsModel?.adGroups.length || 0,
    search_terms: terms.length,
    ai_operator_report: googleOsModel ? 1 : 0,
    actions: googleOsModel?.adGroups.filter((row) =>
      ["PAUSE", "REDUCE", "SCALE"].includes(row.status)
    ).length || 0,
    settings: 0,

    waste_spender: wasteRows.length,
    keyword_category_cards: terms.length,
    ai_brain: terms.length,
    pattern_waste: ngramRows.length,
    action_plan: recommendations.length,
  };

  return (
    <main className="wr-shell">
      <style jsx global>{styles}</style>

      <header className="wr-header">
        <div>
          <h1>Google OS</h1>
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
                  ctr: row.ctr,
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

      <section className="gos-upload-shell">
        <div className="gos-upload-card">
          <div>
            <span>Google OS Data Source</span>
            <h2>Connected Google Sheet + manual search term upload</h2>
            <p>
              Paste the published CSV URL of the team-filled Google Ads DoD sheet. Search terms will still be uploaded manually in the Search Terms tab.
            </p>

            <div className="gos-sheet-connect">
              <input
                value={googleOsSheetUrl}
                onChange={(event) => setGoogleOsSheetUrl(event.target.value)}
                placeholder="Paste published Google Sheet CSV URL..."
              />

              <button
                type="button"
                onClick={() => loadGoogleOsSheetUrl()}
                disabled={googleOsLoading}
              >
                {googleOsLoading ? "Loading..." : "Refresh Sheet"}
              </button>
            </div>

            <div className="gos-source-status">
              {googleOsUploadName ? <small>Loaded: {googleOsUploadName}</small> : null}
              {googleOsModel ? <small>{googleOsModel.rows.length.toLocaleString("en-IN")} Google Ads rows loaded</small> : null}
              {googleOsUploadError ? <small className="error">{googleOsUploadError}</small> : null}
            </div>
          </div>

          <label className="gos-upload-button">
            Upload CSV backup
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleGoogleOsCsvUpload(event.target.files?.[0] || null)}
            />
          </label>
        </div>
      </section>

      {activeTab === "command_center" ? (
        googleOsModel ? (
          <CommandCenterTab model={googleOsModel} />
        ) : (
          <section className="gos-page">
            <div className="gos-panel">
              <div className="gos-panel-head">
                <div>
                  <span>Command Center</span>
                  <h2>Upload Google Ads DoD CSV to start</h2>
                  <p>
                    Use the raw data export with Day, Campaign, Ad group, Cost, Impr., Clicks, Conversions, and Conv. value.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )
      ) : null}

      {activeTab === "campaigns" ? (
        googleOsModel ? (
          <CampaignsTab model={googleOsModel} />
        ) : (
          <section className="gos-page">
            <div className="gos-panel">
              <div className="gos-panel-head">
                <div>
                  <span>Campaigns</span>
                  <h2>No Google Ads data uploaded yet</h2>
                  <p>Upload the DoD CSV first.</p>
                </div>
              </div>
            </div>
          </section>
        )
      ) : null}

      {activeTab === "ad_groups" ? (
        googleOsModel ? (
          <AdGroupsTab model={googleOsModel} />
        ) : (
          <section className="gos-page">
            <div className="gos-panel">
              <div className="gos-panel-head">
                <div>
                  <span>Ad Groups</span>
                  <h2>No Google Ads data uploaded yet</h2>
                  <p>Upload the DoD CSV first.</p>
                </div>
              </div>
            </div>
          </section>
        )
      ) : null}

      {activeTab === "ai_operator_report" ? (
        googleOsModel ? (
          <AiOperatorReportTab model={googleOsModel} />
        ) : (
          <section className="gos-page">
            <div className="gos-panel">
              <div className="gos-panel-head">
                <div>
                  <span>AI Operator Report</span>
                  <h2>No Google Ads data uploaded yet</h2>
                  <p>Upload the DoD CSV first.</p>
                </div>
              </div>
            </div>
          </section>
        )
      ) : null}

      {activeTab === "settings" ? <SettingsTab /> : null}

      {activeTab === "actions" ? (
        <section className="gos-page">
          <div className="gos-panel">
            <div className="gos-panel-head">
              <div>
                <span>Actions</span>
                <h2>Execution center</h2>
                <p>
                  Next phase: export bid actions, negative keyword actions, pause/reduce/scale list, and 30-minute checklist.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "search_terms" && modularSearchTermModel ? (
        <section className="gos-page">
          <div className="gos-panel">
            <div className="gos-panel-head">
              <div>
                <span>Search Terms</span>
                <h2>Manual search term audit</h2>
                <p>
                  This keeps the current manual search-term engine. AI category cards and search-term action report will be upgraded in the next phase.
                </p>
              </div>
            </div>
            <KeywordCategoryCardsTab model={modularSearchTermModel} matchType={matchType} />
          </div>
        </section>
      ) : null}


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
              <Kpi label="CTR" value={ctrPct(wasteAverageCtr)} tone="blue" />
              <Kpi label="Purchases" value="0" />
            </div>

            <div className="wr-waste-export-bar">
              <div>
                <strong>Export zero-purchase search terms</strong>
                <span>{int(wasteRows.length)} terms above selected spend threshold</span>
              </div>

              <select
                id="waste-export-type"
                defaultValue="review"
              >
                <option value="review">Review CSV with metrics</option>
                <option value="google_ads">Google Ads negative CSV</option>
                <option value="copy">Copy negative list</option>
              </select>

              <button
                type="button"
                className="wr-export-inline-button"
                onClick={handleWasteSpenderExport}
                disabled={!wasteRows.length}
              >
                Export
              </button>
            </div>

            <DataTable
              rows={wasteRows}
              empty="No zero-purchase terms above the selected threshold."
              columns={[
                { key: "search_term", label: "Search term" },
                { key: "syntax", label: "Negative syntax", render: (row) => <code>{syntax(str(row.search_term), matchType)}</code> },
                { key: "campaign", label: "Campaign", render: (row) => str((row as AnyObj).campaign, "-") },
                { key: "ad_group", label: "Ad group", render: (row) => str((row as AnyObj).ad_group, "-") },
                { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
                { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
                { key: "ctr", label: "CTR", right: true, render: (row) => ctrPct(row.ctr) },
                { key: "conversions", label: "Conv.", right: true, render: (row) => num(row.conversions).toFixed(2) },
                { key: "category", label: "Category" },
]}
            />
          </div>

          <CopyBox text={negativeLines} onCopy={copyNegatives} />
        </section>
      ) : null}

      {activeTab === "pattern_waste" ? (
        <NgramTabPanel ngramRows={ngramRows} />
      ) : null}
      {activeTab === "ai_brain" && modularSearchTermModel ? (
        <AiBrainTab
          model={modularSearchTermModel}
          onApplied={() => {
            window.dispatchEvent(new Event("search-term-os-ai-brain-updated"));
          }}
        />
      ) : null}
      {activeTab === "keyword_category_cards" && modularSearchTermModel ? (
        <KeywordCategoryCardsTab model={modularSearchTermModel} matchType={matchType} />
      ) : null}

      {activeTab === "action_plan" ? (
        <ActionReportPanel
          execSummary={actionExecSummary}
          checklist={actionChecklist}
          markdown={actionMarkdown}
          negatives={operatorNegativeKeywordSheet}
          fallbackKillSpend={killSpend}
          fallbackWatchCount={watchRows.length}
          fallbackWinnerCount={winnerRows.length}
        />
      ) : null}
    </main>
  );
}


function normalizeGoogleSheetCsvUrl(input: string) {
  const url = input.trim();

  if (!url) return "";

  // Already a CSV/export URL
  if (url.includes("output=csv") || url.includes("format=csv")) {
    return url;
  }

  // Normal Google Sheet URL:
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=123
  const idMatch = url.match(/\/spreadsheets\/d\/([^/]+)/);
  const gidMatch = url.match(/[?#&]gid=(\d+)/);

  if (idMatch?.[1]) {
    const spreadsheetId = idMatch[1];
    const gid = gidMatch?.[1] || "0";
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  }

  return url;
}


export default function Page() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [fileName, setFileName] = useState("");

  const [googleOsModel, setGoogleOsModel] = useState<GoogleOsModel | null>(null);
  const [googleOsSheetUrl, setGoogleOsSheetUrl] = useState("");
  const [googleOsSourceName, setGoogleOsSourceName] = useState("");
  const [googleOsError, setGoogleOsError] = useState("");
  const [googleOsLoading, setGoogleOsLoading] = useState(false);
  const [googleOsHomeTab, setGoogleOsHomeTab] = useState<
    "summary" | "campaigns" | "ad_groups" | "monthly_summary" | "search_terms" | "operator_report"
  >("summary");

  async function loadGoogleOsCsvText(csvText: string, sourceName: string) {
    const rows = parseCsv(csvText);
    const model = buildGoogleOsModel(rows);

    if (!model.rows.length) {
      throw new Error(
        "No valid Google Ads DoD rows found. Use the Daily Google Ads raw data CSV, not the search-term report."
      );
    }

    setGoogleOsModel(model);
    setGoogleOsSourceName(sourceName);
    setGoogleOsError("");
    setGoogleOsHomeTab("summary");
  }

  async function loadGoogleOsSheetUrl(urlInput?: string) {
    const url = (urlInput || googleOsSheetUrl).trim();

    if (!url) {
      setGoogleOsError("Paste the published Google Sheet CSV URL first.");
      return;
    }

    setGoogleOsLoading(true);
    setGoogleOsError("");

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Could not fetch Google Sheet CSV. Status ${response.status}`);
      }

      const csvText = await response.text();
      await loadGoogleOsCsvText(csvText, "Connected Google Sheet");
      localStorage.setItem("google_os_sheet_csv_url", url);
    } catch (error) {
      setGoogleOsError(
        error instanceof Error
          ? `${error.message}. Make sure the sheet is shared/published and the selected tab is accessible as CSV.`
          : "Could not load Google Sheet CSV. Make sure the sheet is shared/published and accessible as CSV."
      );
      if (!googleOsModel) setGoogleOsModel(null);
    } finally {
      setGoogleOsLoading(false);
    }
  }

  async function handleGoogleOsDailyCsvUpload(file: File | null) {
    if (!file) return;

    setGoogleOsLoading(true);
    setGoogleOsError("");

    try {
      const csvText = await file.text();
      await loadGoogleOsCsvText(csvText, file.name);
    } catch (error) {
      setGoogleOsModel(null);
      setGoogleOsError(error instanceof Error ? error.message : "Could not parse Google Ads DoD CSV.");
    } finally {
      setGoogleOsLoading(false);
    }
  }

  useEffect(() => {
    const savedUrl = localStorage.getItem("google_os_sheet_csv_url") || "";
    if (!savedUrl) return;

    setGoogleOsSheetUrl(savedUrl);

    setTimeout(() => {
      loadGoogleOsSheetUrl(savedUrl);
    }, 50);
  }, []);

  if (result) {
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

  const tabs = [
    ["summary", "Command Center"],
    ["campaigns", "Campaigns"],
    ["ad_groups", "Ad Groups"],
    ["monthly_summary", "Monthly Summary"],
    ["search_terms", "Search Terms"],
    ["operator_report", "Operator Report"],
  ] as const;

  return (
    <main className="wr-shell google-os-shell">
      <style jsx global>{styles}</style>

      <header className="gos-topbar">
        <div className="gos-brand">
          <div className="gos-logo">G</div>
          <div>
            <h1>Google OS</h1>
            <p>Daily Performance OS</p>
          </div>
        </div>

        <div className="gos-top-actions">
          <span className={googleOsModel ? "live" : ""}>
            {googleOsModel ? "SHEET LIVE" : "SHEET NOT CONNECTED"}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <nav className="gos-home-tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={googleOsHomeTab === key ? "active" : ""}
            onClick={() => setGoogleOsHomeTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className={googleOsModel ? "gos-source-strip compact" : "gos-source-strip"}>
        <div className="gos-source-main">
          <span>Daily Google Ads Data</span>
          <strong>
            {googleOsModel
              ? `${googleOsModel.rows.length.toLocaleString("en-IN")} rows loaded`
              : "Google Ads DoD data"}
          </strong>
          <small>
            {googleOsSourceName || "Sheet connected or CSV backup uploaded."}
          </small>
        </div>

        <div className="gos-source-actions">
          <input
            value={googleOsSheetUrl}
            onChange={(event) => {
              setGoogleOsSheetUrl(event.target.value);
              if (googleOsError) setGoogleOsError("");
            }}
            placeholder="Published Google Sheet CSV URL..."
          />

          <button
            type="button"
            onClick={() => loadGoogleOsSheetUrl()}
            disabled={googleOsLoading}
          >
            {googleOsLoading ? "Loading..." : "Refresh Sheet"}
          </button>

          <label>
            Replace CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleGoogleOsDailyCsvUpload(event.target.files?.[0] || null)}
            />
          </label>
        </div>

        {googleOsError && !googleOsModel ? (
          <div className="gos-source-error">{googleOsError}</div>
        ) : null}
      </section>

      {googleOsHomeTab === "search_terms" ? (
        <section className="gos-page">
          <div className="gos-panel">
            <CompactSearchTermUpload
              onResult={(res, name) => {
                setResult(res);
                setFileName(name);
              }}
            />
          </div>
        </section>
      ) : googleOsModel ? (
        <>
          {googleOsHomeTab === "summary" ? <CommandCenterTab model={googleOsModel} /> : null}
          {googleOsHomeTab === "campaigns" ? <CampaignsTab model={googleOsModel} /> : null}
          {googleOsHomeTab === "ad_groups" ? <AdGroupsTab model={googleOsModel} /> : null}
          {googleOsHomeTab === "monthly_summary" ? <MonthlySummaryTab model={googleOsModel} /> : null}
          {googleOsHomeTab === "operator_report" ? <AiOperatorReportTab model={googleOsModel} /> : null}
        </>
      ) : (
        <section className="gos-page">
          <div className="gos-panel">
            <div className="gos-panel-head">
              <div>
                <span>Start here</span>
                <h2>Connect Google Ads DoD data</h2>
                <p>
                  Once connected, Google OS will show operator-grade analysis immediately. Search terms remain manual in the Search Terms tab.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
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





.wr-category-page {
  max-width: 1220px;
  margin: 0 auto;
  display: grid;
  gap: 12px;
}

.wr-category-page.compact {
  gap: 10px;
}

.wr-category-control {
  max-width: none;
}

.wr-category-help {
  margin: 6px 0 0;
  color: var(--wr-dim);
  font-size: 12px;
  line-height: 1.5;
}

.wr-category-summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.wr-category-summary-strip.compact {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.wr-category-summary-strip button {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 13px;
  padding: 9px;
  text-align: left;
  cursor: pointer;
}

.wr-category-summary-strip button.active {
  border-color: rgba(66,133,244,0.55);
  background: rgba(66,133,244,0.12);
}

.wr-category-summary-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 700;
}

.wr-category-summary-top span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.wr-category-summary-top i {
  display: inline-block;
  height: 7px;
  width: 7px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.wr-category-summary-top strong {
  white-space: nowrap;
}

.wr-category-summary-bar {
  height: 5px;
  overflow: hidden;
  background: var(--wr-grid);
  border-radius: 999px;
  margin-top: 7px;
}

.wr-category-summary-bar b {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.wr-category-summary-meta {
  margin-top: 6px;
  color: var(--wr-faint);
  font-size: 10px;
  line-height: 1.35;
}

.wr-category-accordion {
  display: grid;
  gap: 8px;
}

.wr-category-accordion-card {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  border-radius: 16px;
  box-shadow: var(--wr-shadow);
  overflow: hidden;
}

.wr-category-accordion-card.open {
  border-color: rgba(66,133,244,0.38);
}

.wr-category-accordion-head {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--wr-ink);
  padding: 13px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  text-align: left;
  cursor: pointer;
}

.wr-category-title-block {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.wr-category-title-block h3 {
  margin: 0;
  color: var(--wr-ink);
  font-size: 16px;
  letter-spacing: -0.025em;
}

.wr-category-title-block p {
  margin: 4px 0 0;
  color: var(--wr-faint);
  font-size: 12px;
}

.wr-category-dot {
  display: inline-block;
  height: 9px;
  width: 9px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.wr-category-head-metrics {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
}

.wr-category-head-metrics span {
  color: var(--wr-faint);
  font-size: 12px;
}

.wr-category-head-metrics strong {
  font-size: 12px;
  white-space: nowrap;
}


.wr-arrow-button {
  display: inline-grid !important;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink) !important;
  border-radius: 999px !important;
  padding: 0 !important;
  font-size: 14px !important;
  line-height: 1 !important;
  font-weight: 800 !important;
}

.wr-category-head-metrics em {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-dim);
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  font-style: normal;
}

.wr-category-accordion-body {
  border-top: 1px solid var(--wr-line);
  padding: 12px 14px 14px;
}

.wr-category-view-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 10px;
}

.wr-category-view-tabs button {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-dim);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.wr-category-view-tabs button.active {
  border-color: rgba(66,133,244,0.5);
  background: rgba(66,133,244,0.13);
  color: var(--wr-ink);
}

.wr-category-summary-detail {
  display: grid;
  gap: 10px;
}

.wr-category-metrics {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.wr-category-metrics div {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 12px;
  padding: 9px 10px;
}

.wr-category-metrics span {
  display: block;
  color: var(--wr-faint);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.wr-category-metrics strong {
  display: block;
  margin-top: 5px;
  color: var(--wr-ink);
  font-size: 16px;
  line-height: 1;
  letter-spacing: -0.035em;
}

.wr-category-reco-card {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 13px;
  padding: 12px;
}

.wr-category-reco-card span {
  display: block;
  font-size: 13px;
  font-weight: 800;
}

.wr-category-reco-card p {
  margin: 7px 0 0;
  color: var(--wr-dim);
  font-size: 13px;
  line-height: 1.5;
}

.wr-category-negative-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.6fr);
  gap: 10px;
}

.wr-category-copy-panel.compact {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 14px;
  padding: 12px;
  align-self: start;
}

.wr-category-negative-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.wr-category-negative-head span {
  display: block;
  color: var(--wr-faint);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.wr-category-negative-head strong {
  display: block;
  color: var(--wr-ink);
  font-size: 12px;
}

.wr-category-negative-head button {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  color: var(--wr-ink);
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
}

.wr-category-copybox {
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  color: var(--wr-ink);
  border-radius: 12px;
  padding: 11px;
  font-size: 12px;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.wr-category-copybox.compact {
  min-height: 250px;
  max-height: calc(100vh - 430px);
}

.tone-neutral { color: var(--wr-faint) !important; }



.wr-ngram-page {
  max-width: 1220px;
  margin: 0 auto;
  display: grid;
  gap: 12px;
}

.wr-ngram-control {
  max-width: none;
}

.wr-ngram-help {
  margin: 6px 0 0;
  color: var(--wr-dim);
  font-size: 12px;
  line-height: 1.5;
}

.wr-ngram-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.wr-ngram-card-grid > button {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  color: var(--wr-ink);
  border-radius: 16px;
  padding: 13px;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--wr-shadow);
}

.wr-ngram-card-grid > button.active {
  border-color: rgba(66,133,244,0.55);
  background: rgba(66,133,244,0.12);
}

.wr-ngram-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.wr-ngram-card-head span {
  color: var(--wr-ink);
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.035em;
}

.wr-ngram-card-head strong {
  color: var(--wr-faint);
  font-size: 12px;
}

.wr-ngram-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.wr-ngram-metrics div {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 12px;
  padding: 8px 9px;
}

.wr-ngram-metrics span {
  display: block;
  color: var(--wr-faint);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wr-ngram-metrics strong {
  display: block;
  margin-top: 5px;
  color: var(--wr-ink);
  font-size: 15px;
  letter-spacing: -0.03em;
}

.wr-ngram-card-grid p {
  margin: 10px 0 0;
  color: var(--wr-dim);
  font-size: 12px;
  line-height: 1.45;
}

.wr-ngram-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.65fr);
  gap: 12px;
}

.wr-ngram-negative-panel {
  align-self: start;
}

.wr-ngram-copybox {
  margin: 10px 0 0;
  min-height: 340px;
  max-height: calc(100vh - 410px);
  overflow: auto;
  white-space: pre-wrap;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 13px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}



.wr-action-report-page {
  max-width: 1220px;
  margin: 0 auto;
  display: grid;
  gap: 12px;
}

.wr-report-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wr-report-actions button {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 12px;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.wr-report-actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.wr-exec-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.wr-exec-summary div {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 14px;
  padding: 11px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.wr-exec-summary span {
  display: inline-grid;
  place-items: center;
  width: 23px;
  height: 23px;
  border-radius: 999px;
  background: rgba(66,133,244,0.16);
  color: #4285F4;
  font-size: 11px;
  font-weight: 800;
  flex: 0 0 auto;
}

.wr-exec-summary p {
  margin: 0;
  color: var(--wr-dim);
  font-size: 13px;
  line-height: 1.45;
}

.wr-action-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.75fr);
  gap: 12px;
}

.wr-checklist-sections {
  display: grid;
  gap: 14px;
}

.wr-checklist-section h3 {
  margin: 0 0 8px;
  color: var(--wr-ink);
  font-size: 15px;
  letter-spacing: -0.025em;
}

.wr-checklist-item {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 14px;
  padding: 11px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  margin-bottom: 8px;
}

.wr-checklist-item input {
  margin-top: 3px;
}

.wr-checklist-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.wr-checklist-line strong {
  color: var(--wr-ink);
  font-size: 13px;
}

.wr-checklist-line em {
  color: #34A853;
  font-style: normal;
  font-weight: 800;
  white-space: nowrap;
}

.wr-checklist-item p {
  margin: 6px 0 0;
  color: var(--wr-dim);
  font-size: 12px;
  line-height: 1.45;
}

.wr-checklist-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.wr-checklist-meta span {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  color: var(--wr-faint);
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 700;
}

.wr-negative-sheet {
  display: grid;
  gap: 8px;
  max-height: calc(100vh - 360px);
  overflow: auto;
}

.wr-negative-row {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 14px;
  padding: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.wr-negative-row strong {
  display: block;
  color: var(--wr-ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.wr-negative-row p {
  margin: 5px 0 0;
  color: var(--wr-dim);
  font-size: 11px;
  line-height: 1.35;
}

.wr-negative-row div:last-child {
  display: grid;
  gap: 5px;
  justify-items: end;
  align-content: start;
}

.wr-negative-row span,
.wr-negative-row b {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  color: var(--wr-faint);
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
}

.wr-negative-row em {
  color: #34A853;
  font-style: normal;
  font-weight: 800;
  font-size: 12px;
}

.wr-report-warning {
  margin: 12px 0 0;
  color: #fbbc04;
  font-size: 13px;
}

.wr-report-warning code {
  border: 1px solid var(--wr-line);
  border-radius: 8px;
  padding: 2px 5px;
  background: var(--wr-panel2);
}



.wr-negative-sheet-table-wrap {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 14px;
  overflow: auto;
  max-height: calc(100vh - 340px);
}

.wr-negative-sheet-table {
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
  font-size: 12px;
}

.wr-negative-sheet-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--wr-panel2);
  color: var(--wr-faint);
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--wr-line);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wr-negative-sheet-table td {
  padding: 9px 10px;
  border-top: 1px solid var(--wr-grid);
  color: var(--wr-dim);
  vertical-align: top;
}

.wr-negative-sheet-table .right {
  text-align: right;
}

.wr-negative-sheet-table .strong {
  color: var(--wr-ink);
  font-weight: 800;
}

.wr-negative-sheet-table code {
  display: inline-block;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  color: var(--wr-ink);
  border-radius: 8px;
  padding: 5px 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  white-space: nowrap;
}

.wr-negative-sheet-table span.safe,
.wr-negative-sheet-table span.warn {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 800;
}

.wr-negative-sheet-table span.safe {
  background: rgba(52,168,83,0.12);
  color: #34A853;
}

.wr-negative-sheet-table span.warn {
  background: rgba(251,188,4,0.14);
  color: #FBBC04;
}



.wr-report-shell {
  max-width: 1220px;
  margin: 0 auto;
}

.wr-report-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}

.wr-report-top span {
  color: var(--wr-faint);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.wr-report-top h2 {
  margin: 5px 0 0;
  color: var(--wr-ink);
  font-size: 20px;
  letter-spacing: -0.04em;
}

.wr-report-top p {
  margin: 6px 0 0;
  color: var(--wr-dim);
  font-size: 13px;
}

.wr-report-controls {
  display: flex;
  align-items: end;
  gap: 8px;
  flex: 0 0 auto;
}

.wr-report-controls label {
  display: grid;
  gap: 5px;
  color: var(--wr-faint);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.wr-report-controls select {
  min-width: 170px;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 11px;
  padding: 8px 10px;
  font-size: 12px;
}

.wr-report-controls button {
  border: 1px solid rgba(66,133,244,0.55);
  background: rgba(66,133,244,0.16);
  color: var(--wr-ink);
  border-radius: 11px;
  padding: 9px 13px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.wr-report-table-wrap {
  width: 100%;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 14px;
  overflow: auto;
  max-height: calc(100vh - 330px);
}

.wr-report-table {
  width: 100%;
  min-width: 1280px;
  border-collapse: collapse;
  font-size: 12px;
}

.wr-report-table.actions {
  min-width: 1050px;
}

.wr-report-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--wr-panel2);
  color: var(--wr-faint);
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--wr-line);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wr-report-table td {
  padding: 8px 10px;
  border-top: 1px solid var(--wr-grid);
  color: var(--wr-dim);
  vertical-align: top;
  line-height: 1.35;
}

.wr-report-table .right {
  text-align: right;
}

.wr-report-table .strong {
  color: var(--wr-ink);
  font-weight: 800;
}

.wr-report-table code {
  display: inline-block;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  color: var(--wr-ink);
  border-radius: 8px;
  padding: 4px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  white-space: nowrap;
}

.wr-report-table span.safe,
.wr-report-table span.warn {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 800;
}

.wr-report-table span.safe {
  background: rgba(52,168,83,0.12);
  color: #34A853;
}

.wr-report-table span.warn {
  background: rgba(251,188,4,0.14);
  color: #FBBC04;
}

.wr-exec-summary.compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}



.wr-waste-export-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  border-radius: 14px;
  padding: 10px 12px;
  margin: 10px 0;
}

.wr-waste-export-bar strong {
  display: block;
  color: var(--wr-ink);
  font-size: 13px;
}

.wr-waste-export-bar span {
  display: block;
  margin-top: 3px;
  color: var(--wr-faint);
  font-size: 11px;
}

.wr-waste-export-bar select {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  color: var(--wr-ink);
  border-radius: 11px;
  padding: 8px 10px;
  font-size: 12px;
}

.wr-export-inline-button {
  border: 1px solid rgba(66,133,244,0.55);
  background: rgba(66,133,244,0.16);
  color: var(--wr-ink);
  border-radius: 11px;
  padding: 9px 13px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.wr-export-inline-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}



.kc-wrap {
  max-width: 1220px;
  margin: 0 auto;
  display: grid;
  gap: 14px;
}

.kc-head {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.kc-head span {
  color: var(--wr-faint);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.kc-head h2 {
  margin: 5px 0 0;
  color: var(--wr-ink);
  font-size: 21px;
  letter-spacing: -0.04em;
}

.kc-head p {
  margin: 6px 0 0;
  color: var(--wr-dim);
  font-size: 13px;
  line-height: 1.45;
  max-width: 760px;
}

.kc-filter {
  color: var(--wr-faint);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  display: grid;
  gap: 6px;
}

.kc-filter input {
  width: 150px;
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 11px;
  padding: 9px 10px;
  font-size: 13px;
}

.kc-grid {
  display: grid;
  gap: 12px;
}

.kc-card {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--wr-shadow);
}

.kc-card .kc-bar {
  height: 4px;
  background: var(--wr-line);
}

.kc-card.green .kc-bar { background: #34A853; }
.kc-card.red .kc-bar { background: #EA4335; }
.kc-card.amber .kc-bar { background: #FBBC04; }
.kc-card.blue .kc-bar { background: #4285F4; }

.kc-card-top {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 15px 16px 8px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  text-align: left;
  cursor: pointer;
}

.kc-card-top h3 {
  margin: 0;
  color: var(--wr-ink);
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 9px;
}

.kc-card-top h3 i {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--wr-line);
}

.kc-card.green .kc-card-top h3 i { background: #34A853; }
.kc-card.red .kc-card-top h3 i { background: #EA4335; }
.kc-card.amber .kc-card-top h3 i { background: #FBBC04; }
.kc-card.blue .kc-card-top h3 i { background: #4285F4; }

.kc-card-top p {
  margin: 6px 0 0;
  color: var(--wr-dim);
  font-size: 13px;
}

.kc-card-top strong {
  color: var(--wr-faint);
  font-size: 13px;
}

.kc-stats {
  padding: 8px 16px 15px;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 8px;
}

.kc-panel {
  border-top: 1px solid var(--wr-line);
  padding: 12px 16px 16px;
}

.kc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 10px;
}

.kc-actions button {
  border: 1px solid var(--wr-line);
  background: var(--wr-panel2);
  color: var(--wr-ink);
  border-radius: 11px;
  padding: 8px 11px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.kc-actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.kc-table-wrap {
  border: 1px solid var(--wr-line);
  border-radius: 14px;
  overflow: auto;
  max-height: 480px;
  background: var(--wr-panel2);
}

.kc-table {
  width: 100%;
  min-width: 1220px;
  border-collapse: collapse;
  font-size: 12px;
}

.kc-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--wr-panel2);
  color: var(--wr-faint);
  padding: 9px 10px;
  border-bottom: 1px solid var(--wr-line);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: right;
  cursor: pointer;
  user-select: none;
}

.kc-table th.left {
  text-align: left;
}

.kc-table td {
  padding: 8px 10px;
  border-top: 1px solid var(--wr-grid);
  color: var(--wr-dim);
  text-align: right;
  vertical-align: top;
}

.kc-table td.left {
  text-align: left;
}

.kc-table td.kw {
  color: var(--wr-ink);
  font-weight: 700;
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kc-tag {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 800;
  border: 1px solid var(--wr-line);
  color: var(--wr-faint);
}

.kc-tag.neg {
  background: rgba(234,67,53,0.12);
  color: #EA4335;
}

.kc-tag.scale {
  background: rgba(52,168,83,0.12);
  color: #34A853;
}

.kc-tag.watch {
  background: rgba(251,188,4,0.14);
  color: #FBBC04;
}

.kc-tag.keep {
  background: rgba(66,133,244,0.12);
  color: #4285F4;
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


  .kc-head,
  .kc-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .kc-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .kc-filter input {
    width: 100%;
  }


  .wr-report-top,
  .wr-report-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .wr-report-controls select {
    min-width: 100%;
  }

  .wr-exec-summary.compact {
    grid-template-columns: 1fr;
  }


  .wr-exec-summary,
  .wr-action-grid {
    grid-template-columns: 1fr;
  }

  .wr-report-actions {
    flex-direction: column;
    align-items: stretch;
  }


  .wr-ngram-card-grid,
  .wr-ngram-detail-grid {
    grid-template-columns: 1fr;
  }


  .wr-category-summary-strip,
  .wr-category-summary-strip.compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wr-category-accordion-head,
  .wr-category-head-metrics {
    align-items: flex-start;
    flex-direction: column;
  }

  .wr-category-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wr-category-negative-layout {
    grid-template-columns: 1fr;
  }


  .wr-category-summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wr-category-detail-grid {
    grid-template-columns: 1fr;
  }

  .wr-category-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;
