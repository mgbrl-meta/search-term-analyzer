"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalysisResult, Thresholds } from "@/types/analysis";
import { analyzeFile, downloadExport, ExportType } from "@/lib/api";
import SummaryCards from "@/components/SummaryCards";
import FilterBar from "@/components/FilterBar";
import CampaignTable from "@/components/CampaignTable";
import SearchTermTable from "@/components/SearchTermTable";
import CategoryDashboard from "@/components/CategoryDashboard";
import NgramDashboard from "@/components/NgramDashboard";
import NegativeKeywordTable from "@/components/NegativeKeywordTable";
import DailyReport from "@/components/DailyReport";
import SpendCharts from "@/components/SpendCharts";
import { FileText, Download, RefreshCw, ArrowLeft } from "lucide-react";

type Tab = "overview" | "search_terms" | "categories" | "ngrams" | "negatives" | "daily";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview",      label: "Overview",          icon: "📊" },
  { id: "search_terms",  label: "Search Terms",      icon: "🔍" },
  { id: "categories",    label: "Categories",        icon: "🏷️" },
  { id: "ngrams",        label: "N-Grams",           icon: "🔤" },
  { id: "negatives",     label: "Negative Keywords", icon: "🚫" },
  { id: "daily",         label: "Daily Report",      icon: "📅" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [result, setResult]   = useState<AnalysisResult | null>(null);
  const [tab, setTab]         = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string>("");

  const [campaignFilter, setCampaignFilter] = useState("All");
  const [thresholds, setThresholds]         = useState<Thresholds | null>(null);

  useEffect(() => {
    const data = window.__analysisResult;
    if (!data) {
      router.push("/");
      return;
    }
    setResult(data);
    setThresholds(data.metadata.thresholds);
  }, [router]);

  const handleFilterChange = async (newFilter: string) => {
    setCampaignFilter(newFilter);
    const file = window.__uploadedFile;
    const t    = window.__thresholds;
    if (!file || !t) return;

    setLoading(true);
    try {
      const updated = await analyzeFile({
        file,
        thresholds: { ...t, campaign_filter: newFilter },
      });
      setResult(updated);
      window.__analysisResult = updated;
      window.__thresholds     = { ...t, campaign_filter: newFilter };
    } catch {
      // Keep existing result on error
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: ExportType, filename: string) => {
    const file = window.__uploadedFile;
    const t    = window.__thresholds;
    if (!file || !t || !result) return;
    setExporting(type);
    try {
      await downloadExport(file, t, type, filename);
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setExporting("");
    }
  };

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="btn-outline py-1.5 px-3 text-xs"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              New Upload
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 rounded p-1">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">Search Term Analyzer</p>
                <p className="text-xs text-gray-400">{result.metadata.filename} · {result.metadata.total_rows.toLocaleString()} rows</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Updating…
              </span>
            )}
            <div className="relative group">
              <button className="btn-success py-2">
                <Download className="w-4 h-4" />
                Export
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 hidden group-hover:block z-50">
                {[
                  { type: "search_terms",    label: "Full Analysis CSV",       file: "search_term_analysis.csv" },
                  { type: "negatives_full",  label: "All Negatives (full)",    file: "negatives_full.csv" },
                  { type: "negatives_broad", label: "Broad Match Negatives",   file: "negatives_broad.csv" },
                  { type: "negatives_phrase",label: "Phrase Match Negatives",  file: "negatives_phrase.csv" },
                  { type: "negatives_exact", label: "Exact Match Negatives",   file: "negatives_exact.csv" },
                  { type: "ngrams",          label: "N-gram Report",           file: "ngram_analysis.csv" },
                  { type: "daily_report",    label: "Daily Operator Report",   file: "daily_report.csv" },
                ].map(({ type, label, file }) => (
                  <button
                    key={type}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => handleExport(type as ExportType, file)}
                    disabled={exporting === type}
                  >
                    {label}
                    {exporting === type && (
                      <svg className="animate-spin w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-screen-xl mx-auto px-4 flex border-t border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.id === "negatives" && result.recommendations.length > 0 && (
                <span className="bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5 leading-none">
                  {result.recommendations.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Warnings */}
      {result.metadata.warnings.length > 0 && (
        <div className="max-w-screen-xl mx-auto px-4 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-medium text-amber-800 mb-1">Notes from analysis:</p>
            {result.metadata.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">• {w}</p>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="max-w-screen-xl mx-auto px-4 pt-4">
        <FilterBar
          campaigns={result.metadata.campaigns}
          selected={campaignFilter}
          onChange={handleFilterChange}
          hasDate={result.metadata.has_dates}
          dateMin={result.metadata.date_min}
          dateMax={result.metadata.date_max}
          thresholds={thresholds!}
          onThresholdChange={(key, val) => setThresholds(prev => prev ? { ...prev, [key]: val } : prev)}
        />
      </div>

      {/* Main content */}
      <main className="max-w-screen-xl mx-auto px-4 pb-12 pt-4 space-y-6">

        {/* Summary cards always visible */}
        <SummaryCards summary={result.summary} />

        {/* Tab content */}
        {tab === "overview" && (
          <>
            <SpendCharts
              campaigns={result.campaigns}
              categories={result.categories}
            />
            <CampaignTable campaigns={result.campaigns} />
          </>
        )}

        {tab === "search_terms" && (
          <SearchTermTable
            rows={result.search_terms}
            campaigns={result.metadata.campaigns}
          />
        )}

        {tab === "categories" && (
          <CategoryDashboard categories={result.categories} />
        )}

        {tab === "ngrams" && (
          <NgramDashboard ngrams={result.ngrams} />
        )}

        {tab === "negatives" && (
          <NegativeKeywordTable recommendations={result.recommendations} />
        )}

        {tab === "daily" && (
          <DailyReport
            summary={result.summary}
            searchTerms={result.search_terms}
            ngrams={result.ngrams}
            recommendations={result.recommendations}
            thresholds={result.metadata.thresholds}
            onExport={() => handleExport("daily_report", "daily_operator_report.csv")}
          />
        )}
      </main>
    </div>
  );
}
