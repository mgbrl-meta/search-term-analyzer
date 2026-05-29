"use client";

import { useState, useMemo } from "react";
import { NgramRow } from "@/types/analysis";
import { ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { exportTableToCSV } from "@/lib/api";

interface Props {
  ngrams: NgramRow[];
}

type GramFilter = "All" | "1-gram" | "2-gram" | "3-gram";

export default function NgramDashboard({ ngrams }: Props) {
  const [gramFilter, setGramFilter] = useState<GramFilter>("All");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortKey, setSortKey]        = useState<keyof NgramRow>("cost");
  const [sortDir, setSortDir]        = useState<"asc" | "desc">("desc");
  const [page, setPage]              = useState(1);
  const PAGE_SIZE = 50;

  const filtered = useMemo(() => {
    let data = ngrams;
    if (gramFilter !== "All") data = data.filter(r => r.gram_type === gramFilter);
    if (flaggedOnly)          data = data.filter(r => r.flag);
    return [...data].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [ngrams, gramFilter, flaggedOnly, sortKey, sortDir]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const flaggedCount = ngrams.filter(n => n.flag).length;

  const toggle = (k: keyof NgramRow) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
    setPage(1);
  };

  const Th = ({ col, label }: { col: keyof NgramRow; label: string }) => (
    <th onClick={() => toggle(col)}>
      <span className="flex items-center gap-1">
        {label}
        {sortKey === col
          ? sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <span className="w-3 h-3 inline-block" />}
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      {flaggedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">
              {flaggedCount} poor-performing n-grams detected
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              These n-grams appear across multiple search terms with high spend or clicks and zero purchases.
              Consider adding them as phrase match negatives.
            </p>
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-800">
            N-gram Analysis
            <span className="text-gray-400 font-normal text-sm ml-2">({filtered.length.toLocaleString()} shown)</span>
          </h3>
          <button
            className="btn-outline text-xs py-1.5"
            onClick={() => exportTableToCSV(filtered as unknown as Record<string, unknown>[], "ngrams.csv")}
          >Export CSV</button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["All", "1-gram", "2-gram", "3-gram"] as GramFilter[]).map(g => (
              <button
                key={g}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  gramFilter === g
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => { setGramFilter(g); setPage(1); }}
              >
                {g}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={e => { setFlaggedOnly(e.target.checked); setPage(1); }}
              className="rounded"
            />
            Flagged only
          </label>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <Th col="ngram"          label="N-gram" />
                <th>Type</th>
                <Th col="term_count"     label="Terms" />
                <Th col="clicks"         label="Clicks" />
                <Th col="cost"           label="Cost" />
                <Th col="purchases"      label="Purchases" />
                <Th col="roas"           label="ROAS" />
                <Th col="cpa"            label="CPA" />
                <Th col="wasted_spend"   label="Wasted" />
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row, i) => (
                <tr key={i} className={row.flag ? "bg-red-50 hover:bg-red-100" : ""}>
                  <td className="font-mono font-medium">{row.ngram}</td>
                  <td>
                    <span className="badge bg-gray-100 text-gray-600">{row.gram_type}</span>
                  </td>
                  <td>{row.term_count}</td>
                  <td>{row.clicks.toLocaleString()}</td>
                  <td>₹{row.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td className={row.purchases === 0 && row.cost > 0 ? "text-red-500 font-medium" : ""}>
                    {row.purchases}
                  </td>
                  <td className={row.roas >= 2 ? "text-green-600" : row.roas > 0 ? "text-yellow-600" : "text-red-500"}>
                    {row.roas ? `${row.roas.toFixed(2)}x` : "—"}
                  </td>
                  <td>{row.cpa > 0 ? `₹${row.cpa.toFixed(0)}` : "—"}</td>
                  <td className={row.wasted_spend > 0 ? "text-red-500" : ""}>
                    {row.wasted_spend > 0 ? `₹${row.wasted_spend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                  </td>
                  <td>
                    {row.flag ? (
                      <span className="badge-high" title={row.flag_reason}>
                        ⚠️ Flag
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-400">
                    No n-grams match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button className="btn-outline py-1 px-3 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              <button className="btn-outline py-1 px-3 text-xs" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
