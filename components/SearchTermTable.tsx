"use client";

import { useState, useMemo } from "react";
import { SearchTermRow } from "@/types/analysis";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { exportTableToCSV } from "@/lib/api";

interface Props {
  rows: SearchTermRow[];
  campaigns: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  irrelevant:       "bg-red-100 text-red-700",
  competitor:       "bg-orange-100 text-orange-700",
  brand:            "bg-purple-100 text-purple-700",
  diy:              "bg-amber-100 text-amber-700",
  informational:    "bg-blue-100 text-blue-700",
  price_sensitive:  "bg-yellow-100 text-yellow-700",
  high_intent:      "bg-green-100 text-green-700",
  problem_solution: "bg-teal-100 text-teal-700",
  lifestyle:        "bg-pink-100 text-pink-700",
  low_intent:       "bg-gray-100 text-gray-600",
  generic:          "bg-slate-100 text-slate-600",
  other:            "bg-gray-100 text-gray-500",
};

const PAGE_SIZE = 50;

export default function SearchTermTable({ rows, campaigns }: Props) {
  const [query,       setQuery]       = useState("");
  const [campFilter,  setCampFilter]  = useState("All");
  const [catFilter,   setCatFilter]   = useState("All");
  const [wastedOnly,  setWastedOnly]  = useState(false);
  const [sortKey,     setSortKey]     = useState<keyof SearchTermRow>("cost");
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("desc");
  const [page,        setPage]        = useState(1);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(rows.map(r => r.category)))],
    [rows]
  );

  const filtered = useMemo(() => {
    let data = rows;
    if (campFilter !== "All") data = data.filter(r => r.campaign === campFilter);
    if (catFilter  !== "All") data = data.filter(r => r.category === catFilter);
    if (wastedOnly)           data = data.filter(r => r.wasted_spend > 0);
    if (query)                data = data.filter(r =>
      r.search_term.toLowerCase().includes(query.toLowerCase()) ||
      r.campaign.toLowerCase().includes(query.toLowerCase())
    );
    return [...data].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [rows, campFilter, catFilter, wastedOnly, query, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggle = (k: keyof SearchTermRow) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
    setPage(1);
  };

  const Th = ({ col, label }: { col: keyof SearchTermRow; label: string }) => (
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
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-800">
          Search Terms <span className="text-gray-400 font-normal text-sm">({filtered.length.toLocaleString()} shown)</span>
        </h3>
        <button
          className="btn-outline text-xs py-1.5"
          onClick={() => exportTableToCSV(filtered as unknown as Record<string, unknown>[], "search_terms.csv")}
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search terms…"
            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-52"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          value={campFilter}
          onChange={e => { setCampFilter(e.target.value); setPage(1); }}
        >
          <option value="All">All Campaigns</option>
          {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setPage(1); }}
        >
          {categories.map(c => <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={wastedOnly}
            onChange={e => { setWastedOnly(e.target.checked); setPage(1); }}
            className="rounded"
          />
          Wasted spend only
        </label>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <Th col="search_term" label="Search Term" />
              <th>Campaign</th>
              <th>Ad Group</th>
              <th>Category</th>
              <Th col="clicks"           label="Clicks" />
              <Th col="cost"             label="Cost" />
              <Th col="purchases"        label="Purchases" />
              <Th col="conversion_value" label="Revenue" />
              <Th col="roas_calc"        label="ROAS" />
              <Th col="avg_cpc_calc"     label="CPC" />
              <Th col="wasted_spend"     label="Wasted" />
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={i}>
                <td className="max-w-[220px]" title={row.search_term}>
                  <span className="font-medium">{row.search_term}</span>
                </td>
                <td className="max-w-[140px] truncate text-gray-500" title={row.campaign}>
                  {row.campaign}
                </td>
                <td className="max-w-[120px] truncate text-gray-500" title={row.ad_group}>
                  {row.ad_group}
                </td>
                <td>
                  <span className={`badge text-xs ${CATEGORY_COLORS[row.category] || "badge"}`}>
                    {row.category}
                  </span>
                </td>
                <td>{row.clicks}</td>
                <td>₹{row.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                <td className={row.purchases === 0 && row.cost > 0 ? "text-red-500 font-medium" : ""}>
                  {row.purchases}
                </td>
                <td>₹{row.conversion_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                <td className={row.roas_calc >= 2 ? "text-green-600" : row.roas_calc > 0 ? "text-yellow-600" : "text-red-500"}>
                  {row.roas_calc ? `${row.roas_calc.toFixed(2)}x` : "—"}
                </td>
                <td>₹{row.avg_cpc_calc?.toFixed(2)}</td>
                <td className={row.wasted_spend > 0 ? "text-red-500 font-medium" : ""}>
                  {row.wasted_spend > 0 ? `₹${row.wasted_spend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-10 text-gray-400">
                  No search terms match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages} ({filtered.length.toLocaleString()} total)</span>
          <div className="flex gap-2">
            <button
              className="btn-outline py-1 px-3 text-xs"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >Prev</button>
            <button
              className="btn-outline py-1 px-3 text-xs"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
