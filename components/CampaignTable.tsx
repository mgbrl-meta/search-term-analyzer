"use client";

import { useState } from "react";
import { CampaignRow } from "@/types/analysis";
import { ChevronUp, ChevronDown } from "lucide-react";
import { exportTableToCSV } from "@/lib/api";

interface Props {
  campaigns: CampaignRow[];
}

type SortKey = keyof CampaignRow;

function fmt(n: number | undefined, prefix = "₹", dec = 0): string {
  if (n === undefined || n === null) return "—";
  return prefix + n.toLocaleString("en-IN", { maximumFractionDigits: dec });
}

export default function CampaignTable({ campaigns }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th onClick={() => toggle(col)}>
      <span className="flex items-center gap-1">
        {label}
        {sortKey === col
          ? sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <span className="w-3 h-3" />
        }
      </span>
    </th>
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Campaign Performance</h3>
        <button
          className="btn-outline text-xs py-1.5"
          onClick={() => exportTableToCSV(campaigns as unknown as Record<string, unknown>[], "campaigns.csv")}
        >
          Export CSV
        </button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <Th col="cost"             label="Spend" />
              <Th col="clicks"           label="Clicks" />
              <Th col="impressions"      label="Impressions" />
              <Th col="purchases"        label="Purchases" />
              <Th col="conversion_value" label="Revenue" />
              <Th col="roas"             label="ROAS" />
              <th>CPA</th>  {/* removed — not on CampaignRow but on aggregate */}
              <Th col="wasted_spend"     label="Wasted" />
              <Th col="risky_terms_count" label="Risky Terms" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i}>
                <td className="font-medium max-w-[200px] truncate" title={row.campaign}>
                  {row.campaign}
                </td>
                <td>{fmt(row.cost)}</td>
                <td>{row.clicks.toLocaleString()}</td>
                <td>{row.impressions.toLocaleString()}</td>
                <td className={row.purchases === 0 ? "text-red-500 font-medium" : ""}>
                  {row.purchases}
                </td>
                <td>{fmt(row.conversion_value)}</td>
                <td className={row.roas >= 2 ? "text-green-600 font-medium" : row.roas > 0 ? "text-yellow-600" : "text-red-500"}>
                  {row.roas ? `${row.roas.toFixed(2)}x` : "—"}
                </td>
                <td>{row.cost_per_purchase > 0 ? fmt(row.cost_per_purchase) : "—"}</td>
                <td className={row.wasted_spend > 0 ? "text-red-500" : ""}>
                  {fmt(row.wasted_spend)}
                </td>
                <td className={row.risky_terms_count > 0 ? "text-orange-500 font-medium" : ""}>
                  {row.risky_terms_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
