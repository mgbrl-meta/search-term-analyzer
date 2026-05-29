"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { analyzeFile } from "@/lib/api";
import { AnalysisResult, Thresholds } from "@/types/analysis";
import { Upload, FileText, AlertCircle, Settings, ChevronDown, ChevronUp } from "lucide-react";

const DEFAULT_THRESHOLDS: Thresholds = {
  spend_threshold:        1000,
  clicks_threshold:       20,
  target_roas:            2.0,
  ngram_spend_threshold:  1000,
  ngram_clicks_threshold: 20,
  campaign_filter:        "All",
};

// Store result globally so dashboard page can access it
// (Simple approach for MVP — no context/zustand needed)
declare global {
  interface Window {
    __analysisResult?: AnalysisResult;
    __uploadedFile?: File;
    __thresholds?: Thresholds;
  }
}

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile]             = useState<File | null>(null);
  const [dragging, setDragging]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  const handleFile = (f: File) => {
    const ok = f.name.endsWith(".csv") || f.name.endsWith(".xlsx") || f.name.endsWith(".xls");
    if (!ok) {
      setError("Please upload a CSV or Excel (.xlsx) file.");
      return;
    }
    setFile(f);
    setError("");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const result = await analyzeFile({ file, thresholds });
      // Store in window for dashboard to read
      window.__analysisResult = result;
      window.__uploadedFile   = file;
      window.__thresholds     = thresholds;
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed. Please try again.");
      setLoading(false);
    }
  };

  const updateThreshold = (key: keyof Thresholds, value: string) => {
    setThresholds(prev => ({
      ...prev,
      [key]: key === "campaign_filter" ? value : Number(value),
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="bg-blue-600 rounded-lg p-2">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Google Shopping Search Term Analyzer</h1>
            <p className="text-xs text-gray-500">Upload your Google Ads export → get instant insights</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">

          {/* Hero */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Analyze Your Search Terms</h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Upload your Google Ads Search Terms CSV or Excel export and instantly identify
              wasted spend, poor performers, and get ready-to-upload negative keyword recommendations.
            </p>
          </div>

          {/* Upload Card */}
          <div className="card">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-blue-500 bg-blue-50"
                  : file
                  ? "border-green-400 bg-green-50"
                  : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onFileInput}
              />
              <Upload className={`w-10 h-10 mx-auto mb-3 ${file ? "text-green-500" : "text-gray-400"}`} />
              {file ? (
                <div>
                  <p className="font-semibold text-green-700">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(file.size / 1024).toFixed(1)} KB — Click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-gray-700">Drop your Google Ads export here</p>
                  <p className="text-sm text-gray-400 mt-1">or click to browse — CSV or Excel (.xlsx)</p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Threshold Settings */}
            <div className="mt-4">
              <button
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4" />
                Analysis Thresholds
                {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showSettings && (
                <div className="mt-3 grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
                  {[
                    { key: "spend_threshold",        label: "High Spend (no purchase)",    unit: "cost" },
                    { key: "clicks_threshold",        label: "High Clicks (no purchase)",   unit: "clicks" },
                    { key: "target_roas",             label: "Target ROAS",                 unit: "x" },
                    { key: "ngram_spend_threshold",   label: "N-gram Spend Threshold",      unit: "cost" },
                    { key: "ngram_clicks_threshold",  label: "N-gram Clicks Threshold",     unit: "clicks" },
                  ].map(({ key, label, unit }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                          value={thresholds[key as keyof Thresholds] as number}
                          min={0}
                          step={key === "target_roas" ? 0.1 : 1}
                          onChange={e => updateThreshold(key as keyof Thresholds, e.target.value)}
                        />
                        <span className="text-xs text-gray-400">{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Analyze Button */}
            <button
              className="btn-primary w-full mt-4 py-3 text-base justify-center"
              disabled={!file || loading}
              onClick={handleAnalyze}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
                  </svg>
                  Analyzing your data…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Analyze Search Terms
                </>
              )}
            </button>
          </div>

          {/* Feature list */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: "📊", text: "Campaign & Ad Group Dashboard" },
              { icon: "🎯", text: "Negative Keyword Recommendations" },
              { icon: "🔍", text: "N-gram Analysis" },
              { icon: "💸", text: "Wasted Spend Detection" },
              { icon: "🏷️", text: "Search Term Categorization" },
              { icon: "📥", text: "Export-ready CSV Files" },
            ].map(({ icon, text }) => (
              <div key={text} className="card py-3 px-2 text-sm text-gray-600">
                <div className="text-2xl mb-1">{icon}</div>
                {text}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
