"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { GoogleOsModel, GoogleOsRow } from "@/lib/googleOs/types";
import {
  DEFAULT_SEARCH_TERM_DYNAMIC_RULES,
  DEFAULT_SEARCH_TERM_SETTINGS,
  aggregateSearchTerms,
  buildHeadNegativeText,
  buildSearchTermAnalysisHeads,
  buildSearchTermSummary,
  convertSearchTermRawRowsToGoogleRows,
  filterSearchTermRows,
  formatMoney,
  formatPercent,
  formatX,
  normalizeUploadedSearchTermRows,
  parseCsvText,
  type NegativeMatchType,
  type SearchTermAnalysisHead,
  type SearchTermDynamicRules,
  type SearchTermMode,
  type SearchTermRawRow,
  type SearchTermWasterRow,
} from "@/lib/googleOs/searchTermWasterToolkit";

const STORAGE_KEY = "google_os_search_term_upload_rows_v1";

const MODES: { key: SearchTermMode; label: string }[] = [
  { key: "all_waste", label: "All Waste" },
  { key: "spend_waste", label: "Spend Waster" },
  { key: "click_waste", label: "Click Waster" },
  { key: "low_roas", label: "Low ROAS" },
  { key: "high_cpa", label: "High CPA" },
  { key: "intent_mismatch", label: "Intent Mismatch" },
  { key: "positive_keywords", label: "Positive Keywords" },
];

function copyText(text: string) {
  navigator.clipboard?.writeText(text);
}

function getLatestDate(rows: SearchTermRawRow[]) {
  return rows.map((row) => row.date).filter(Boolean).sort().at(-1) || "—";
}

function getEarliestDate(rows: SearchTermRawRow[]) {
  return rows.map((row) => row.date).filter(Boolean).sort()[0] || "—";
}

function updateRule<K extends keyof SearchTermDynamicRules>(
  current: SearchTermDynamicRules,
  key: K,
  value: SearchTermDynamicRules[K]
): SearchTermDynamicRules {
  return {
    ...current,
    [key]: value,
  };
}

function cleanSheetName(name: string) {
  return name
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
}

function rowsForExcel(rows: SearchTermWasterRow[]) {
  return rows.map((row) => ({
    "Search Term": row.searchTerm,
    Campaign: row.campaign,
    "Ad Group": row.adGroup,
    Spend: Number(row.spend.toFixed(2)),
    Clicks: row.clicks,
    Impressions: row.impressions,
    CTR: `${(row.ctr * 100).toFixed(2)}%`,
    Purchases: row.purchases,
    Revenue: Number(row.revenue.toFixed(2)),
    CPA: Number(row.cpa.toFixed(2)),
    ROAS: Number(row.roas.toFixed(2)),
    CVR: `${(row.cvr * 100).toFixed(2)}%`,
    Keyword: row.keyword,
    "Keyword Match Type": row.keywordMatchType,
    Reason: row.wasteReason,
    Recommendation: row.recommendation,
    "Negative Match Type": row.negativeMatchType,
    "Exact Negative": row.exactSyntax,
    "Phrase Negative": row.phraseSyntax,
    "Broad Negative": row.broadSyntax,
  }));
}

function autoWidth(ws: XLSX.WorkSheet, data: Record<string, unknown>[]) {
  const headers = Object.keys(data[0] || {});
  ws["!cols"] = headers.map((header) => {
    const max = Math.max(
      header.length,
      ...data.map((row) => String(row[header] ?? "").length)
    );

    return { wch: Math.min(Math.max(max + 2, 10), 45) };
  });
}

function downloadWorkbook(heads: SearchTermAnalysisHead[], allRows: SearchTermWasterRow[]) {
  const wb = XLSX.utils.book_new();

  const summaryRows = heads.map((head) => ({
    Analysis: head.title,
    Terms: head.rows.length,
    Spend: Number(head.totalSpend.toFixed(2)),
    Revenue: Number(head.totalRevenue.toFixed(2)),
    Purchases: head.purchases,
    Risk: head.risk,
    Action: head.action,
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  autoWidth(summarySheet, summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const allRowsSheetData = rowsForExcel(allRows);
  const allRowsSheet = XLSX.utils.json_to_sheet(allRowsSheetData);
  autoWidth(allRowsSheet, allRowsSheetData);
  XLSX.utils.book_append_sheet(wb, allRowsSheet, "All Filtered Terms");

  heads.forEach((head, index) => {
    const sheetData = rowsForExcel(head.rows);
    const ws = XLSX.utils.json_to_sheet(sheetData.length ? sheetData : [{ Message: "No rows matched this rule." }]);
    autoWidth(ws, sheetData.length ? sheetData : [{ Message: "No rows matched this rule." }]);

    const safeName = cleanSheetName(`${index + 1}. ${head.title}`);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  XLSX.writeFile(wb, "search-term-waster-analysis.xlsx");
}

function SearchTermHeadDropdown({
  head,
  isOpen,
  onToggle,
}: {
  head: SearchTermAnalysisHead;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="stw2-head-card">
      <button type="button" className="stw2-head-row" onClick={onToggle}>
        <span className="stw2-head-name">
          <b>{isOpen ? "−" : "+"}</b>
          <span>
            <strong>{head.title}</strong>
            <small>{head.action}</small>
          </span>
        </span>

        <span><small>Terms</small><strong>{head.rows.length}</strong></span>
        <span><small>Spend</small><strong className="red">{formatMoney(head.totalSpend)}</strong></span>
        <span><small>Revenue</small><strong className="green">{formatMoney(head.totalRevenue)}</strong></span>
        <span><small>Purch.</small><strong>{head.purchases.toFixed(0)}</strong></span>
        <span>
          <small>Risk</small>
          <strong className={head.risk === "High" ? "red" : head.risk === "Opportunity" || head.risk === "Protect" ? "green" : "amber"}>
            {head.risk}
          </strong>
        </span>
      </button>

      {isOpen ? (
        <div className="stw2-head-body">
          <div className="stw2-head-tools">
            <div>
              <span>{head.subtitle}</span>
            </div>

            <button type="button" onClick={() => copyText(buildHeadNegativeText(head, "exact"))}>Copy Exact</button>
            <button type="button" onClick={() => copyText(buildHeadNegativeText(head, "phrase"))}>Copy Phrase</button>
            <button type="button" onClick={() => copyText(buildHeadNegativeText(head, "broad"))}>Copy Broad</button>
          </div>

          <div className="stw2-table-wrap">
            <div className="stw2-table stw2-table-header">
              <span>Search Term</span>
              <span>Campaign</span>
              <span>Ad Group</span>
              <span>Spend</span>
              <span>Clicks</span>
              <span>Impr.</span>
              <span>CTR</span>
              <span>Purch.</span>
              <span>Revenue</span>
              <span>CPA</span>
              <span>ROAS</span>
              <span>Exact</span>
              <span>Phrase</span>
            </div>

            {head.rows.map((row) => (
              <div key={row.id} className="stw2-table stw2-table-row">
                <span title={row.searchTerm}><strong>{row.searchTerm}</strong></span>
                <span title={row.campaign}>{row.campaign}</span>
                <span title={row.adGroup}>{row.adGroup}</span>
                <span className="red">{formatMoney(row.spend)}</span>
                <span>{row.clicks}</span>
                <span>{row.impressions}</span>
                <span>{formatPercent(row.ctr)}</span>
                <span>{row.purchases}</span>
                <span className="green">{formatMoney(row.revenue)}</span>
                <span>{formatMoney(row.cpa)}</span>
                <span>{formatX(row.roas)}</span>
                <span title={row.exactSyntax}>{row.exactSyntax}</span>
                <span title={row.phraseSyntax}>{row.phraseSyntax}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SearchTermWasterTab({ model }: { model: GoogleOsModel }) {
  const [uploadedRawRows, setUploadedRawRows] = useState<SearchTermRawRow[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [mode, setMode] = useState<SearchTermMode>("all_waste");
  const [contains, setContains] = useState("");
  const [campaign, setCampaign] = useState("all");
  const [matchType, setMatchType] = useState<NegativeMatchType | "all">("all");
  const [openHeads, setOpenHeads] = useState<Record<string, boolean>>({});
  const [rules, setRules] = useState<SearchTermDynamicRules>(DEFAULT_SEARCH_TERM_DYNAMIC_RULES);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      setUploadedRawRows(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  async function handleCsvUpload(file: File | null) {
    setUploadError("");

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      const normalized = normalizeUploadedSearchTermRows(parsed);

      if (!normalized.length) {
        const sample = parsed[0] || {};
        const detectedHeaders = sample.__detected_headers || Object.keys(sample).join(" | ");
        const delimiter = sample.__detected_delimiter || "unknown";

        setUploadError(
          `No valid search term rows found. Detected delimiter: ${delimiter}. Detected headers: ${detectedHeaders}. Required: Search term, Cost, Clicks, Impr./Impressions, Conversions, Conv. value.`
        );
        return;
      }

      setUploadedRawRows(normalized);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      setOpenHeads({});
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "CSV upload failed.");
    }
  }

  function clearUpload() {
    setUploadedRawRows([]);
    localStorage.removeItem(STORAGE_KEY);
    setOpenHeads({});
  }

  const uploadedRows: GoogleOsRow[] = useMemo(() => {
    return convertSearchTermRawRowsToGoogleRows(uploadedRawRows);
  }, [uploadedRawRows]);

  const settings = useMemo(() => ({
    ...DEFAULT_SEARCH_TERM_SETTINGS,
    minSpend: rules.spendWasteAmount,
    minClicks: rules.clickWasteClicks,
    targetRoas: rules.lowRoasTarget,
    maxCpa: rules.highCpaAmount,
  }), [rules]);

  const searchTermRows = useMemo(() => {
    return aggregateSearchTerms(uploadedRows, settings);
  }, [uploadedRows, settings]);

  const campaigns = useMemo(() => {
    return Array.from(new Set(searchTermRows.map((row) => row.campaign))).sort();
  }, [searchTermRows]);

  const baseFilteredRows = useMemo(() => {
    return filterSearchTermRows({
      rows: searchTermRows,
      mode,
      minSpend: rules.spendWasteAmount,
      minClicks: rules.clickWasteClicks,
      targetRoas: rules.lowRoasTarget,
      maxCpa: rules.highCpaAmount,
      contains,
      campaign,
      matchType,
    });
  }, [searchTermRows, mode, rules, contains, campaign, matchType]);

  const heads = useMemo(() => {
    return buildSearchTermAnalysisHeads(baseFilteredRows, rules, settings)
      .filter((head) => head.key !== "phrase_waster");
  }, [baseFilteredRows, rules, settings]);

  const summary = useMemo(() => buildSearchTermSummary(searchTermRows), [searchTermRows]);

  return (
    <section className="gos-page search-term-waster-page stw2-page">
      <div className="stw2-hero">
        <div>
          <span>Search Term Waster</span>
          <h2>Search term analysis and negative keyword export</h2>
          <p>Upload search-term CSV, change thresholds, open each analysis head, and export a multi-sheet Excel workbook.</p>
        </div>

        <div className="stw2-hero-actions">
          <label>
            Upload CSV
            <input type="file" accept=".csv,text/csv" onChange={(event) => handleCsvUpload(event.target.files?.[0] || null)} />
          </label>

          <button type="button" onClick={clearUpload}>Clear</button>

          <button type="button" onClick={() => downloadWorkbook(heads, baseFilteredRows)}>
            Export Excel Workbook
          </button>
        </div>
      </div>

      {uploadError ? <div className="stw-upload-error">{uploadError}</div> : null}

      <div className="stw2-status-grid">
        <div><span>Rows Loaded</span><strong>{uploadedRawRows.length.toLocaleString("en-IN")}</strong></div>
        <div><span>Date Range</span><strong>{getEarliestDate(uploadedRawRows)} → {getLatestDate(uploadedRawRows)}</strong></div>
        <div><span>Total Terms</span><strong>{summary.totalTerms.toLocaleString("en-IN")}</strong></div>
        <div><span>Total Spend</span><strong>{formatMoney(summary.totalSpend)}</strong></div>
        <div><span>Wasted Spend</span><strong className="red">{formatMoney(summary.wastedSpend)}</strong></div>
        <div><span>Waste Share</span><strong className="red">{formatPercent(summary.wasteShare)}</strong></div>
        <div><span>Negative Candidates</span><strong>{summary.negativeCandidates.toLocaleString("en-IN")}</strong></div>
      </div>

      <div className="stw2-control-panel">
        <div className="stw2-control-title">
          <span>Dynamic Rule Controls</span>
          <strong>Change values and analysis heads update instantly</strong>
        </div>

        <label>Clicks, 0 Purchase<input type="number" value={rules.clickWasteClicks} onChange={(e) => setRules(updateRule(rules, "clickWasteClicks", Number(e.target.value || 0)))} /></label>
        <label>Spend, 0 Purchase ₹<input type="number" value={rules.spendWasteAmount} onChange={(e) => setRules(updateRule(rules, "spendWasteAmount", Number(e.target.value || 0)))} /></label>
        <label>Low ROAS Spend ₹<input type="number" value={rules.lowRoasSpend} onChange={(e) => setRules(updateRule(rules, "lowRoasSpend", Number(e.target.value || 0)))} /></label>
        <label>Target ROAS<input type="number" step="0.1" value={rules.lowRoasTarget} onChange={(e) => setRules(updateRule(rules, "lowRoasTarget", Number(e.target.value || 0)))} /></label>
        <label>High CPA ₹<input type="number" value={rules.highCpaAmount} onChange={(e) => setRules(updateRule(rules, "highCpaAmount", Number(e.target.value || 0)))} /></label>
        <label>Low CTR Impr.<input type="number" value={rules.lowCtrImpressions} onChange={(e) => setRules(updateRule(rules, "lowCtrImpressions", Number(e.target.value || 0)))} /></label>
        <label>Low CTR %<input type="number" step="0.1" value={rules.lowCtrPercent} onChange={(e) => setRules(updateRule(rules, "lowCtrPercent", Number(e.target.value || 0)))} /></label>
      </div>

      <div className="stw2-filter-panel">
        <label>
          Analysis Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as SearchTermMode)}>
            {MODES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>

        <label>
          Contains
          <input value={contains} onChange={(e) => setContains(e.target.value)} placeholder="free, amazon, hair fall..." />
        </label>

        <label>
          Campaign
          <select value={campaign} onChange={(e) => setCampaign(e.target.value)}>
            <option value="all">All Campaigns</option>
            {campaigns.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>

        <label>
          Match Type
          <select value={matchType} onChange={(e) => setMatchType(e.target.value as NegativeMatchType | "all")}>
            <option value="all">All</option>
            <option value="exact">Exact</option>
            <option value="phrase">Phrase</option>
            <option value="broad">Broad</option>
          </select>
        </label>
      </div>

      {!uploadedRawRows.length ? (
        <div className="stw-empty">
          <h3>Upload a Search Terms CSV to start.</h3>
          <p>The Excel workbook export will create one sheet for each analysis head.</p>
        </div>
      ) : (
        <div className="stw2-head-list">
          {heads.map((head) => (
            <SearchTermHeadDropdown
              key={head.key}
              head={head}
              isOpen={Boolean(openHeads[head.key])}
              onToggle={() => setOpenHeads((current) => ({ ...current, [head.key]: !current[head.key] }))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
