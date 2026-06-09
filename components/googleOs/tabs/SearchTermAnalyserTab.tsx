"use client";

import { useEffect, useMemo, useState } from "react";
import type { GoogleOsModel, GoogleOsRow } from "@/lib/googleOs/types";
import {
  aggregateSearchTerms,
  convertSearchTermRawRowsToGoogleRows,
  DEFAULT_SEARCH_TERM_SETTINGS,
  formatMoney,
  formatPercent,
  formatX,
  type SearchTermRawRow,
} from "@/lib/googleOs/searchTermWasterToolkit";
import {
  DEFAULT_ANALYSER_RULES,
  DEFAULT_CLASSIFIER_SETTINGS,
  buildIntentSummary,
  classifiedRowsForExcel,
  classifySearchTerms,
  groupByDecision,
  groupByIntent,
  intentSummaryForExcel,
  type ClassifiedSearchTermRow,
  type SearchTermAnalyserRules,
  type SearchTermDecision,
  type SearchTermIntentType,
} from "@/lib/googleOs/searchTermAnalyserToolkit";

const STORAGE_KEY = "google_os_search_term_upload_rows_v1";

function updateRule<K extends keyof SearchTermAnalyserRules>(
  current: SearchTermAnalyserRules,
  key: K,
  value: SearchTermAnalyserRules[K]
): SearchTermAnalyserRules {
  return {
    ...current,
    [key]: value,
  };
}

function getHeaderKpis(rows: ClassifiedSearchTermRow[]) {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const purchases = rows.reduce((sum, row) => sum + row.purchases, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);

  const topIntent = buildIntentSummary(rows)[0]?.intentType || "—";
  const highestWaste = [...buildIntentSummary(rows)].sort((a, b) => b.wasteSpend - a.wasteSpend)[0]?.intentType || "—";
  const bestIntent = [...buildIntentSummary(rows)].filter((row) => row.purchases > 0).sort((a, b) => b.roas - a.roas)[0]?.intentType || "—";

  return {
    spend,
    revenue,
    purchases,
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    cpa: purchases ? spend / purchases : 0,
    roas: spend ? revenue / spend : 0,
    topIntent,
    highestWaste,
    bestIntent,
  };
}

function cleanSheetName(name: string) {
  return name
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
}

async function exportAnalyserWorkbook(rows: ClassifiedSearchTermRow[]) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Google OS";
  workbook.created = new Date();

  const colors = {
    blue: "4285F4",
    green: "34A853",
    yellow: "FBBC04",
    red: "EA4335",
    slate: "1E293B",
  };

  function styleSheet(ws: any, color = colors.blue) {
    ws.properties.tabColor = { argb: `FF${color}` };
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const header = ws.getRow(1);
    header.eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    ws.columns.forEach((col: any) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: true }, (cell: any) => {
        max = Math.max(max, String(cell.value || "").length);
      });
      col.width = Math.min(Math.max(max + 2, 11), 46);
    });

    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columnCount },
    };
  }

  function addJsonSheet(name: string, data: Record<string, unknown>[], color: string) {
    const ws = workbook.addWorksheet(cleanSheetName(name), {
      properties: { tabColor: { argb: `FF${color}` } },
    });

    const safeData = data.length ? data : [{ Message: "No rows available." }];
    ws.columns = Object.keys(safeData[0]).map((key) => ({ header: key, key }));
    safeData.forEach((row) => ws.addRow(row));

    styleSheet(ws, color);
  }

  const intentSummary = buildIntentSummary(rows);
  addJsonSheet("Executive Summary", intentSummaryForExcel(intentSummary), colors.blue);

  const decisionMap = groupByDecision(rows);
  const actionSummary = Array.from(decisionMap.entries()).map(([decision, decisionRows]) => {
    const spend = decisionRows.reduce((sum, row) => sum + row.spend, 0);
    const revenue = decisionRows.reduce((sum, row) => sum + row.revenue, 0);
    const purchases = decisionRows.reduce((sum, row) => sum + row.purchases, 0);

    return {
      Decision: decision,
      Terms: decisionRows.length,
      Spend: Number(spend.toFixed(2)),
      Revenue: Number(revenue.toFixed(2)),
      Purchases: purchases,
      CPA: purchases ? Number((spend / purchases).toFixed(2)) : 0,
      ROAS: spend ? Number((revenue / spend).toFixed(2)) : 0,
    };
  });
  addJsonSheet("Action Summary", actionSummary, colors.slate);

  const actionSheets: { decision: SearchTermDecision; color: string }[] = [
    { decision: "Increase Bid", color: colors.green },
    { decision: "Decrease Bid", color: colors.yellow },
    { decision: "Add Exact Keyword", color: colors.green },
    { decision: "Add Negative", color: colors.red },
    { decision: "Bring Back", color: colors.green },
    { decision: "Protect", color: colors.blue },
    { decision: "Move to SEO", color: colors.yellow },
    { decision: "Separate Campaign", color: colors.yellow },
    { decision: "Manual Review", color: colors.slate },
  ];

  actionSheets.forEach(({ decision, color }) => {
    addJsonSheet(decision, classifiedRowsForExcel(decisionMap.get(decision) || []), color);
  });

  const intentMap = groupByIntent(rows);
  Array.from(intentMap.entries()).forEach(([intent, intentRows]) => {
    addJsonSheet(`Intent - ${intent}`, classifiedRowsForExcel(intentRows), colors.blue);
  });

  addJsonSheet("All Classified Terms", classifiedRowsForExcel(rows), colors.slate);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "search-term-analyser-workbook.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

function IntentSummaryTable({ rows }: { rows: ReturnType<typeof buildIntentSummary> }) {
  return (
    <div className="sta-table-card">
      <div className="sta-section-head">
        <div>
          <span>Intent Summary</span>
          <h3>Search term type performance</h3>
        </div>
      </div>

      <div className="sta-summary-table-wrap">
        <table className="sta-summary-table">
          <thead>
            <tr>
              <th>Intent Type</th>
              <th>Terms</th>
              <th>Spend</th>
              <th>Clicks</th>
              <th>Impr.</th>
              <th>CTR</th>
              <th>Revenue</th>
              <th>Purch.</th>
              <th>CPA</th>
              <th>ROAS</th>
              <th>Waste</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.intentType}>
                <td><strong>{row.intentType}</strong></td>
                <td>{row.terms.toLocaleString("en-IN")}</td>
                <td className="red">{formatMoney(row.spend)}</td>
                <td>{row.clicks.toLocaleString("en-IN")}</td>
                <td>{row.impressions.toLocaleString("en-IN")}</td>
                <td>{formatPercent(row.ctr)}</td>
                <td className="green">{formatMoney(row.revenue)}</td>
                <td>{row.purchases.toFixed(0)}</td>
                <td>{formatMoney(row.cpa)}</td>
                <td className={row.roas >= 2 ? "green" : row.roas >= 1 ? "amber" : "red"}>{formatX(row.roas)}</td>
                <td className="red">{formatMoney(row.wasteSpend)}</td>
                <td>{row.bestDecision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClassifiedTermsTable({ rows }: { rows: ClassifiedSearchTermRow[] }) {
  return (
    <div className="sta-table-card">
      <div className="sta-section-head">
        <div>
          <span>Classified Terms</span>
          <h3>Priority action list</h3>
        </div>
      </div>

      <div className="sta-summary-table-wrap">
        <table className="sta-summary-table sta-terms-table">
          <thead>
            <tr>
              <th>Search Term</th>
              <th>Type</th>
              <th>Decision</th>
              <th>Campaign</th>
              <th>Ad Group</th>
              <th>Spend</th>
              <th>Clicks</th>
              <th>Impr.</th>
              <th>CTR</th>
              <th>Purch.</th>
              <th>Revenue</th>
              <th>CPA</th>
              <th>ROAS</th>
              <th>Priority</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((row) => (
              <tr key={row.id}>
                <td title={row.searchTerm}><strong>{row.searchTerm}</strong></td>
                <td>{row.intentType}</td>
                <td>{row.decision}</td>
                <td title={row.campaign}>{row.campaign}</td>
                <td title={row.adGroup}>{row.adGroup}</td>
                <td className="red">{formatMoney(row.spend)}</td>
                <td>{row.clicks.toLocaleString("en-IN")}</td>
                <td>{row.impressions.toLocaleString("en-IN")}</td>
                <td>{formatPercent(row.ctr)}</td>
                <td>{row.purchases.toFixed(0)}</td>
                <td className="green">{formatMoney(row.revenue)}</td>
                <td>{formatMoney(row.cpa)}</td>
                <td className={row.roas >= 2 ? "green" : row.roas >= 1 ? "amber" : "red"}>{formatX(row.roas)}</td>
                <td>{Math.round(row.priorityScore)}</td>
                <td title={row.recommendedAction}>{row.recommendedAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 500 ? (
        <p className="sta-note">Showing top 500 rows in UI. Full data is available in Excel export.</p>
      ) : null}
    </div>
  );
}

export function SearchTermAnalyserTab({ model }: { model: GoogleOsModel }) {
  const [rawRows, setRawRows] = useState<SearchTermRawRow[]>([]);
  const [rules, setRules] = useState<SearchTermAnalyserRules>(DEFAULT_ANALYSER_RULES);
  const [selectedIntent, setSelectedIntent] = useState<string>("all");
  const [selectedDecision, setSelectedDecision] = useState<string>("all");
  const [contains, setContains] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      setRawRows(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const uploadedRows: GoogleOsRow[] = useMemo(() => {
    return convertSearchTermRawRowsToGoogleRows(rawRows);
  }, [rawRows]);

  const searchTermRows = useMemo(() => {
    return aggregateSearchTerms(uploadedRows, DEFAULT_SEARCH_TERM_SETTINGS);
  }, [uploadedRows]);

  const classifiedRows = useMemo(() => {
    return classifySearchTerms(searchTermRows, model, rules, DEFAULT_CLASSIFIER_SETTINGS);
  }, [searchTermRows, model, rules]);

  const filteredRows = useMemo(() => {
    return classifiedRows.filter((row) => {
      if (selectedIntent !== "all" && row.intentType !== selectedIntent) return false;
      if (selectedDecision !== "all" && row.decision !== selectedDecision) return false;
      if (contains && !row.searchTerm.toLowerCase().includes(contains.toLowerCase())) return false;
      return true;
    });
  }, [classifiedRows, selectedIntent, selectedDecision, contains]);

  const summaryRows = useMemo(() => buildIntentSummary(filteredRows), [filteredRows]);
  const headerKpis = useMemo(() => getHeaderKpis(filteredRows), [filteredRows]);

  const intentOptions = useMemo(() => {
    return Array.from(new Set(classifiedRows.map((row) => row.intentType))).sort();
  }, [classifiedRows]);

  const decisionOptions = useMemo(() => {
    return Array.from(new Set(classifiedRows.map((row) => row.decision))).sort();
  }, [classifiedRows]);

  return (
    <section className="gos-page search-term-analyser-page">
      <div className="sta-hero">
        <div>
          <span>Search Term Analyser</span>
          <h2>Intent classification and operator action engine</h2>
          <p>Combines uploaded search terms with Google OS campaign data to classify demand and recommend bid, keyword, negative, SEO, or campaign actions.</p>
        </div>

        <button type="button" onClick={() => void exportAnalyserWorkbook(filteredRows)}>
          Export Excel Workbook
        </button>
      </div>

      {!rawRows.length ? (
        <div className="sta-empty">
          <h3>No search term upload found.</h3>
          <p>Upload the Search Terms CSV in Search Term Waster first. This analyser uses the same uploaded data.</p>
        </div>
      ) : (
        <>
          <div className="sta-kpi-grid">
            <div><span>Terms</span><strong>{filteredRows.length.toLocaleString("en-IN")}</strong><small>classified rows</small></div>
            <div><span>Spend</span><strong>{formatMoney(headerKpis.spend)}</strong><small>selected terms</small></div>
            <div><span>Impr.</span><strong>{headerKpis.impressions.toLocaleString("en-IN")}</strong><small>visibility</small></div>
            <div><span>CTR</span><strong>{formatPercent(headerKpis.ctr)}</strong><small>{headerKpis.clicks.toLocaleString("en-IN")} clicks</small></div>
            <div><span>Revenue</span><strong className="green">{formatMoney(headerKpis.revenue)}</strong><small>term revenue</small></div>
            <div><span>Purch.</span><strong>{headerKpis.purchases.toFixed(0)}</strong><small>orders</small></div>
            <div><span>CPA</span><strong>{formatMoney(headerKpis.cpa)}</strong><small>acquisition cost</small></div>
            <div><span>ROAS</span><strong className={headerKpis.roas >= 2 ? "green" : headerKpis.roas >= 1 ? "amber" : "red"}>{formatX(headerKpis.roas)}</strong><small>return</small></div>
            <div><span>Top Intent</span><strong>{headerKpis.topIntent}</strong><small>by spend</small></div>
            <div><span>Highest Waste</span><strong className="red">{headerKpis.highestWaste}</strong><small>by zero-purchase spend</small></div>
            <div><span>Best Intent</span><strong className="green">{headerKpis.bestIntent}</strong><small>by ROAS</small></div>
          </div>

          <div className="sta-rules-grid">
            <div>
              <span>Decision Rules</span>
              <strong>Change thresholds and actions update instantly.</strong>
            </div>
            <label>Target ROAS<input type="number" step="0.1" value={rules.targetRoas} onChange={(e) => setRules(updateRule(rules, "targetRoas", Number(e.target.value || 0)))} /></label>
            <label>Target CPA ₹<input type="number" value={rules.targetCpa} onChange={(e) => setRules(updateRule(rules, "targetCpa", Number(e.target.value || 0)))} /></label>
            <label>Min Spend ₹<input type="number" value={rules.minSpendForDecision} onChange={(e) => setRules(updateRule(rules, "minSpendForDecision", Number(e.target.value || 0)))} /></label>
            <label>Min Clicks<input type="number" value={rules.minClicksForDecision} onChange={(e) => setRules(updateRule(rules, "minClicksForDecision", Number(e.target.value || 0)))} /></label>
            <label>Winning Purch.<input type="number" value={rules.winningPurchases} onChange={(e) => setRules(updateRule(rules, "winningPurchases", Number(e.target.value || 0)))} /></label>
          </div>

          <div className="sta-filter-grid">
            <label>
              Intent Type
              <select value={selectedIntent} onChange={(e) => setSelectedIntent(e.target.value)}>
                <option value="all">All Intent Types</option>
                {intentOptions.map((intent) => <option key={intent} value={intent}>{intent}</option>)}
              </select>
            </label>

            <label>
              Decision
              <select value={selectedDecision} onChange={(e) => setSelectedDecision(e.target.value)}>
                <option value="all">All Decisions</option>
                {decisionOptions.map((decision) => <option key={decision} value={decision}>{decision}</option>)}
              </select>
            </label>

            <label>
              Contains
              <input value={contains} onChange={(e) => setContains(e.target.value)} placeholder="rosemary, dandruff, amazon..." />
            </label>
          </div>

          <IntentSummaryTable rows={summaryRows} />
          <ClassifiedTermsTable rows={filteredRows} />
        </>
      )}
    </section>
  );
}
