"use client";

import { useEffect, useMemo, useState } from "react";
import type { GoogleOsModel, GoogleOsRow } from "@/lib/googleOs/types";
import {
  DEFAULT_SEARCH_TERM_DYNAMIC_RULES,
  DEFAULT_SEARCH_TERM_SETTINGS,
  aggregateSearchTerms,
  buildHeadCsv,
  buildHeadNegativeText,
  buildPhraseWasterCsv,
  buildPhraseWasterGroups,
  buildSearchTermAnalysisHeads,
  buildSearchTermCsv,
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

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
    <div className="stw-head-card">
      <button type="button" className="stw-head-row" onClick={onToggle}>
        <span className="stw-head-name">
          <b>{isOpen ? "−" : "+"}</b>
          <span>
            <strong>{head.title}</strong>
            <small>{head.subtitle}</small>
          </span>
        </span>

        <span>
          <small>Terms</small>
          <strong>{head.rows.length}</strong>
        </span>

        <span>
          <small>Spend</small>
          <strong className="red">{formatMoney(head.totalSpend)}</strong>
        </span>

        <span>
          <small>Revenue</small>
          <strong className="green">{formatMoney(head.totalRevenue)}</strong>
        </span>

        <span>
          <small>Purch.</small>
          <strong>{head.purchases.toFixed(0)}</strong>
        </span>

        <span>
          <small>Risk</small>
          <strong className={head.risk === "High" ? "red" : head.risk === "Opportunity" || head.risk === "Protect" ? "green" : "amber"}>
            {head.risk}
          </strong>
        </span>
      </button>

      {isOpen ? (
        <div className="stw-head-body">
          <div className="stw-head-action">
            <div>
              <span>Recommended action</span>
              <strong>{head.action}</strong>
            </div>

            <button type="button" onClick={() => copyText(buildHeadNegativeText(head, "exact"))}>Copy Exact</button>
            <button type="button" onClick={() => copyText(buildHeadNegativeText(head, "phrase"))}>Copy Phrase</button>
            <button type="button" onClick={() => copyText(buildHeadNegativeText(head, "broad"))}>Copy Broad</button>
            <button type="button" onClick={() => downloadCsv(`${head.key}.csv`, buildHeadCsv(head))}>Download Report</button>
          </div>

          <div className="stw-head-table">
            <div className="stw-head-table-header">
              <span>Search Term</span>
              <span>Campaign</span>
              <span>Ad Group</span>
              <span>Spend</span>
              <span>Clicks</span>
              <span>Impr.</span>
              <span>CTR</span>
              <span>Purch.</span>
              <span>Revenue</span>
              <span>ROAS</span>
              <span>CPA</span>
              <span>Exact</span>
              <span>Phrase</span>
            </div>

            {head.rows.map((row) => (
              <div key={row.id} className="stw-head-table-row">
                <span><strong>{row.searchTerm}</strong><small>{row.wasteReason}</small></span>
                <span>{row.campaign}</span>
                <span>{row.adGroup}</span>
                <span className="red">{formatMoney(row.spend)}</span>
                <span>{row.clicks}</span>
                <span>{row.impressions}</span>
                <span>{formatPercent(row.ctr)}</span>
                <span>{row.purchases}</span>
                <span className="green">{formatMoney(row.revenue)}</span>
                <span>{formatX(row.roas)}</span>
                <span>{formatMoney(row.cpa)}</span>
                <span>{row.exactSyntax}</span>
                <span>{row.phraseSyntax}</span>
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
    return buildSearchTermAnalysisHeads(baseFilteredRows, rules, settings);
  }, [baseFilteredRows, rules, settings]);

  const phraseGroups = useMemo(() => {
    return buildPhraseWasterGroups(searchTermRows, rules);
  }, [searchTermRows, rules]);

  const summary = useMemo(() => buildSearchTermSummary(searchTermRows), [searchTermRows]);

  return (
    <section className="gos-page search-term-waster-page">
      <div className="stw-header">
        <div>
          <span>Search Term Waster</span>
          <h2>Search term waste finder and negative export center</h2>
          <p>Dynamic quantitative heads, n-gram phrase waster analysis, and downloadable negative keyword reports.</p>
        </div>

        <div className="stw-header-actions">
          <button type="button" onClick={() => downloadCsv("search-term-waster-all-filtered.csv", buildSearchTermCsv(baseFilteredRows))}>
            Download Filtered Report
          </button>
        </div>
      </div>

      <div className="stw-upload-card">
        <div>
          <span>Search Term Data Source</span>
          <h3>Direct CSV Upload</h3>
          <p>Required minimum columns: Search term, Campaign, Ad group, Cost, Clicks, Impr., Conversions, Conv. value.</p>
        </div>

        <div className="stw-upload-actions">
          <label>
            Upload Search Term CSV
            <input type="file" accept=".csv,text/csv" onChange={(event) => handleCsvUpload(event.target.files?.[0] || null)} />
          </label>

          <button type="button" onClick={clearUpload}>Clear Upload</button>
        </div>

        <div className="stw-upload-status">
          <div><span>Rows Loaded</span><strong>{uploadedRawRows.length.toLocaleString("en-IN")}</strong></div>
          <div><span>Date Range</span><strong>{getEarliestDate(uploadedRawRows)} → {getLatestDate(uploadedRawRows)}</strong></div>
          <div><span>Campaign Sheet Rows</span><strong>{model.rows.length.toLocaleString("en-IN")}</strong></div>
        </div>

        {uploadError ? <div className="stw-upload-error">{uploadError}</div> : null}
      </div>

      <div className="stw-summary-grid">
        <div><span>Total Terms</span><strong>{summary.totalTerms}</strong></div>
        <div><span>Total Spend</span><strong>{formatMoney(summary.totalSpend)}</strong></div>
        <div><span>Wasted Spend</span><strong className="red">{formatMoney(summary.wastedSpend)}</strong></div>
        <div><span>Waste Share</span><strong className="red">{formatPercent(summary.wasteShare)}</strong></div>
        <div><span>Zero-sale Terms</span><strong>{summary.zeroSaleTerms}</strong></div>
        <div><span>Negative Candidates</span><strong>{summary.negativeCandidates}</strong></div>
        <div><span>Positive Candidates</span><strong className="green">{summary.positiveCandidates}</strong></div>
      </div>

      <div className="stw-dynamic-rules">
        <div>
          <span>Dynamic Rule Controls</span>
          <h3>Change threshold values and every head updates instantly</h3>
        </div>

        <label>Clicks, 0 purchase<input type="number" value={rules.clickWasteClicks} onChange={(e) => setRules(updateRule(rules, "clickWasteClicks", Number(e.target.value || 0)))} /></label>
        <label>Spend, 0 purchase ₹<input type="number" value={rules.spendWasteAmount} onChange={(e) => setRules(updateRule(rules, "spendWasteAmount", Number(e.target.value || 0)))} /></label>
        <label>Low ROAS Spend ₹<input type="number" value={rules.lowRoasSpend} onChange={(e) => setRules(updateRule(rules, "lowRoasSpend", Number(e.target.value || 0)))} /></label>
        <label>Target ROAS<input type="number" step="0.1" value={rules.lowRoasTarget} onChange={(e) => setRules(updateRule(rules, "lowRoasTarget", Number(e.target.value || 0)))} /></label>
        <label>High CPA ₹<input type="number" value={rules.highCpaAmount} onChange={(e) => setRules(updateRule(rules, "highCpaAmount", Number(e.target.value || 0)))} /></label>
        <label>Low CTR Impr.<input type="number" value={rules.lowCtrImpressions} onChange={(e) => setRules(updateRule(rules, "lowCtrImpressions", Number(e.target.value || 0)))} /></label>
        <label>Low CTR %<input type="number" step="0.1" value={rules.lowCtrPercent} onChange={(e) => setRules(updateRule(rules, "lowCtrPercent", Number(e.target.value || 0)))} /></label>
        <label>Phrase min terms<input type="number" value={rules.phraseMinTerms} onChange={(e) => setRules(updateRule(rules, "phraseMinTerms", Number(e.target.value || 0)))} /></label>
        <label>Phrase min spend ₹<input type="number" value={rules.phraseMinSpend} onChange={(e) => setRules(updateRule(rules, "phraseMinSpend", Number(e.target.value || 0)))} /></label>
      </div>

      {!uploadedRawRows.length ? (
        <div className="stw-empty">
          <h3>Upload a Search Terms CSV to start.</h3>
          <p>The heads below will appear after upload. Search term data stays outside Google Sheets.</p>
        </div>
      ) : (
        <>
          <div className="stw-filters">
            <label>
              Analysis Mode
              <select value={mode} onChange={(e) => setMode(e.target.value as SearchTermMode)}>
                {MODES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>

            <label>
              Contains
              <input value={contains} onChange={(e) => setContains(e.target.value)} placeholder="e.g. free, amazon, hair fall" />
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

          <div className="stw-phrase-summary">
            <div>
              <span>N-Gram Phrase Waster</span>
              <h3>{phraseGroups.length} phrase patterns found</h3>
              <p>Repeated word patterns across multiple zero-purchase search terms. Best used for phrase negatives.</p>
            </div>

            <button type="button" onClick={() => downloadCsv("phrase-waster-ngram-report.csv", buildPhraseWasterCsv(phraseGroups))}>
              Download Phrase Waster Report
            </button>
          </div>

          <div className="stw-head-list">
            {heads.map((head) => (
              <SearchTermHeadDropdown
                key={head.key}
                head={head}
                isOpen={Boolean(openHeads[head.key])}
                onToggle={() => setOpenHeads((current) => ({ ...current, [head.key]: !current[head.key] }))}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
