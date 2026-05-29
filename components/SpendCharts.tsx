"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { CampaignRow, CategoryRow } from "@/types/analysis";

interface Props {
  campaigns: CampaignRow[];
  categories: CategoryRow[];
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

function fmtCurrency(v: number) {
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function SpendCharts({ campaigns, categories }: Props) {
  const campData = campaigns
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10)
    .map(c => ({
      name:   c.campaign.length > 18 ? c.campaign.slice(0, 18) + "…" : c.campaign,
      spend:  c.cost,
      wasted: c.wasted_spend,
      roas:   c.roas,
    }));

  const catData = categories
    .filter(c => c.cost > 0)
    .slice(0, 8)
    .map(c => ({
      name:  c.category_label,
      value: c.cost,
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Spend vs Wasted by Campaign */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Spend vs Wasted Spend by Campaign</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={campData} margin={{ top: 4, right: 8, left: 8, bottom: 40 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-30}
              textAnchor="end"
            />
            <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, name: string) => [fmtCurrency(v), name === "spend" ? "Spend" : "Wasted"]}
            />
            <Legend verticalAlign="top" />
            <Bar dataKey="spend"  fill="#3b82f6" name="Spend"  radius={[4, 4, 0, 0]} />
            <Bar dataKey="wasted" fill="#ef4444" name="Wasted" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Spend by Category */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Spend by Category</h3>
        {catData.length === 0 ? (
          <p className="text-sm text-gray-400 py-20 text-center">No category data</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={catData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) =>
                  percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                {catData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmtCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ROAS by Campaign */}
      <div className="card lg:col-span-2">
        <h3 className="font-semibold text-gray-800 mb-4">ROAS by Campaign</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={campData} margin={{ top: 4, right: 8, left: 8, bottom: 40 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-20}
              textAnchor="end"
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}x`, "ROAS"]} />
            {/* Reference line at target ROAS 2 */}
            <Bar dataKey="roas" name="ROAS" radius={[4, 4, 0, 0]}>
              {campData.map((entry, i) => (
                <Cell key={i} fill={entry.roas >= 2 ? "#10b981" : entry.roas > 0 ? "#f59e0b" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
