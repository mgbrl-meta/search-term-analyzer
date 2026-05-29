"use client";

import { useState, useMemo } from "react";
import { Recommendation } from "@/types/analysis";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { exportTableToCSV } from "@/lib/api";

interface Props {
  recommendations: Recommendation[];
}

const CONFIDENCE_BADGE: Record<string, string> = {
  high:   "badge-high",
  medium: "badge-medium",
  low:    "badge-low",
};

export default function NegativeKeywordTable({ recommendations }: Props) {
  const [copied,      setCopied]      = useState<string>("");
  const [confFilter,  setConfFilter]  = useState("All");
  const [typeFilter,  setTypeFilter]  = useState("All");
  const [sortKey,     setSortKey]     = useState<keyof Recommendation>("cost");
  const [sortDir,     setSortDir]     = useState<"asc"|"desc">("desc");

  const filtered = useMemo(() => {
    let data = recommendations;
    if (confFilter !== "All") data = data.filter(r => r.confidence === confFilter);
    if (typeFilter !== "All") data = data.filter(r => r.type === typeFilter);
    return [...data].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return 0;
    });
  }, [recommendations, confFilter, typeFilter, sortKey, sortDir]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 1500);
  };

  const copyAllExact = () => {
    const lines = filtered.map(r => r.exact).join("\n");
    copyText(lines, "all-exact");
  };

  const toggle = (k: keyof Recommendation) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const highCount   = recommendations.filter(r => r.confidence === "high").length;
  const mediumCount = recommendations.filter(r => r.confidence === "medium").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Recommendations", value: recommendations.length, color: "blue" },
          { label: "High Confidence",        value: highCount,             color: "red" },
          { label: "Medium Confidence",       value: mediumCount,           color: "yellow" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-800">
            Negative Keyword Recommendations
          </h3>
          <div className="flex gap-2">
            <button
              className="btn-outline text-xs py-1.5"
              onClick={copyAllExact}
            >
              {copied === "all-exact" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              Copy All Exact
            </button>
            <button
              className="btn-outline text-xs py-1.5"
              onClick={() => exportTableToCSV(filtered as unknown as Record<string, unknown>[], "negative_keywords.csv")}
            >Export CSV</button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <select
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            value={confFilter}
            onChange={e => setConfFilter(e.target.value)}
          >
            <option value="All">All Confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="All">All Types</option>
            <option value="search_term">Search Term</option>
            <option value="ngram">N-gram</option>
          </select>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Confidence</th>
                <th>Match Type</th>
                <th>Broad</th>
                <th>Phrase</th>
                <th>Exact</th>
                <th onClick={() => toggle("clicks")}>
                  <span className="flex items-center gap-1">
                    Clicks
                    {sortKey === "clicks" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </span>
                </th>
                <th onClick={() => toggle("cost")}>
                  <span className="flex items-center gap-1">
                    Cost
                    {sortKey === "cost" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </span>
                </th>
                <th>Purchases</th>
                <th>Campaign</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i}>
                  <td className="font-medium">{row.keyword}</td>
                  <td>
                    <span className={CONFIDENCE_BADGE[row.confidence] || "badge"}>
                      {row.confidence}
                    </span>
                  </td>
                  <td>
                    <span className="badge bg-blue-100 text-blue-700">{row.match_type}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{row.broad}</code>
                      <button
                        onClick={() => copyText(row.broad, `broad-${i}`)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {copied === `broad-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{row.phrase}</code>
                      <button
                        onClick={() => copyText(row.phrase, `phrase-${i}`)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {copied === `phrase-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{row.exact}</code>
                      <button
                        onClick={() => copyText(row.exact, `exact-${i}`)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {copied === `exact-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                  <td>{row.clicks}</td>
                  <td className="text-red-500 font-medium">
                    ₹{row.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="text-red-500">{row.purchases}</td>
                  <td className="max-w-[120px] truncate text-gray-500" title={row.campaign}>
                    {row.campaign}
                  </td>
                  <td className="max-w-[200px] text-gray-500 text-xs" title={row.reason}>
                    {row.reason}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-gray-400">
                    No recommendations match your filters. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
