"use client";

import { Thresholds } from "@/types/analysis";
import { Filter } from "lucide-react";

interface Props {
  campaigns: string[];
  selected: string;
  onChange: (campaign: string) => void;
  hasDate: boolean;
  dateMin: string | null;
  dateMax: string | null;
  thresholds: Thresholds;
  onThresholdChange: (key: keyof Thresholds, value: number | string) => void;
}

export default function FilterBar({
  campaigns, selected, onChange, hasDate, dateMin, dateMax,
}: Props) {
  return (
    <div className="card flex flex-wrap items-center gap-4 py-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Filter className="w-4 h-4" />
        <span className="font-medium">Filters:</span>
      </div>

      {/* Campaign filter */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Campaign</label>
        <select
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          value={selected}
          onChange={e => onChange(e.target.value)}
        >
          <option value="All">All Campaigns</option>
          {campaigns.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Date range info */}
      {hasDate && dateMin && dateMax && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium">Date range</label>
          <span className="text-sm text-gray-700 bg-gray-100 rounded-lg px-3 py-1.5">
            {dateMin} → {dateMax}
          </span>
        </div>
      )}
    </div>
  );
}
