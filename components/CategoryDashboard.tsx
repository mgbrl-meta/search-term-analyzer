"use client";

import { CategoryRow } from "@/types/analysis";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { exportTableToCSV } from "@/lib/api";

interface Props {
  categories: CategoryRow[];
}

const COLORS: Record<string, string> = {
  irrelevant:       "#ef4444",
  competitor:       "#f97316",
  brand:            "#8b5cf6",
  diy:              "#f59e0b",
  informational:    "#3b82f6",
  price_sensitive:  "#eab308",
  high_intent:      "#10b981",
  problem_solution: "#14b8a6",
  lifestyle:        "#ec4899",
  low_intent:       "#94a3b8",
  generic:          "#64748b",
  other:            "#d1d5db",
};

export default function CategoryDashboard({ categories }: Props) {
  const chartData = categories
    .filter(c => c.cost > 0)
    .map(c => ({
      name:        c.category_label,
      key:         c.category,
      spend:       c.cost,
      wasted:      c.wasted_spend,
      roas:        c.roas,
    }));

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Spend vs Wasted Spend by Category</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 50 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-30}
              textAnchor="end"
            />
            <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, name: string) => [
                `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                name === "spend" ? "Spend" : "Wasted",
              ]}
            />
            <Bar dataKey="spend" name="spend" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={COLORS[entry.key] || "#94a3b8"} />
              ))}
            </Bar>
            <Bar dataKey="wasted" name="wasted" fill="#fca5a5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Category Breakdown</h3>
          <button
            className="btn-outline text-xs py-1.5"
            onClick={() => exportTableToCSV(categories as unknown as Record<string, unknown>[], "categories.csv")}
          >Export CSV</button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Terms</th>
                <th>Clicks</th>
                <th>Spend</th>
                <th>% Spend</th>
                <th>Purchases</th>
                <th>Revenue</th>
                <th>ROAS</th>
                <th>Wasted</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row, i) => (
                <tr key={i}>
                  <td>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[row.category] || "#d1d5db" }}
                      />
                      <span className="font-medium">{row.category_label}</span>
                    </span>
                  </td>
                  <td>{row.term_count}</td>
                  <td>{row.clicks.toLocaleString()}</td>
                  <td>₹{row.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-16">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(row.spend_pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-600">{row.spend_pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className={row.purchases === 0 && row.cost > 0 ? "text-red-500 font-medium" : ""}>
                    {row.purchases}
                  </td>
                  <td>₹{row.conversion_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  <td className={row.roas >= 2 ? "text-green-600" : row.roas > 0 ? "text-yellow-600" : "text-red-500"}>
                    {row.roas ? `${row.roas.toFixed(2)}x` : "—"}
                  </td>
                  <td className={row.wasted_spend > 0 ? "text-red-500" : ""}>
                    {row.wasted_spend > 0 ? `₹${row.wasted_spend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
