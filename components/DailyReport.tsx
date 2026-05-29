"use client";

import { Summary, SearchTermRow, NgramRow, Recommendation, Thresholds } from "@/types/analysis";
import { Download, AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  summary: Summary;
  searchTerms: SearchTermRow[];
  ngrams: NgramRow[];
  recommendations: Recommendation[];
  thresholds: Thresholds;
  onExport: () => void;
}

export default function DailyReport({
  summary, searchTerms, ngrams, recommendations, thresholds, onExport
}: Props) {
  const spendThreshold  = thresholds.spend_threshold;
  const clicksThreshold = thresholds.clicks_threshold;

  const highClicksNoConv = searchTerms
    .filter(r => r.clicks >= clicksThreshold && r.purchases === 0)
    .sort((a, b) => b.clicks - a.clicks);

  const highSpendNoConv = searchTerms
    .filter(r => r.cost >= spendThreshold && r.purchases === 0)
    .sort((a, b) => b.cost - a.cost);

  const poorNgrams = ngrams
    .filter(n => n.flag)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20);

  const highConf = recommendations.filter(r => r.confidence === "high");

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Daily Operator Report</h2>
            <p className="text-blue-100 mt-1">{today}</p>
            <p className="text-blue-100 text-sm mt-0.5">
              Thresholds: High Clicks ≥ {clicksThreshold} | High Spend ≥ ₹{spendThreshold.toLocaleString()}
            </p>
          </div>
          <button
            className="btn bg-white text-blue-700 hover:bg-blue-50"
            onClick={onExport}
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Spend",    value: `₹${summary.total_spend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
          { label: "Wasted Spend",   value: `₹${summary.wasted_spend.toLocaleString("en-IN", { maximumFractionDigits: 0 })} (${summary.wasted_spend_pct.toFixed(1)}%)`, red: true },
          { label: "Purchases",      value: summary.total_purchases.toString() },
          { label: "Overall ROAS",   value: `${summary.overall_roas.toFixed(2)}x` },
        ].map(({ label, value, red }) => (
          <div key={label} className="card text-center">
            <p className={`text-2xl font-bold ${red ? "text-red-500" : "text-gray-900"}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Actions needed */}
      {(highClicksNoConv.length > 0 || highSpendNoConv.length > 0 || highConf.length > 0) ? (
        <div className="card border-l-4 border-red-500 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Action Required Today</p>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                {highClicksNoConv.length > 0 && (
                  <li>• {highClicksNoConv.length} search term{highClicksNoConv.length > 1 ? "s" : ""} with {clicksThreshold}+ clicks and zero purchases</li>
                )}
                {highSpendNoConv.length > 0 && (
                  <li>• {highSpendNoConv.length} search term{highSpendNoConv.length > 1 ? "s" : ""} with ₹{spendThreshold.toLocaleString()}+ spend and zero purchases</li>
                )}
                {highConf.length > 0 && (
                  <li>• {highConf.length} high-confidence negative keyword recommendation{highConf.length > 1 ? "s" : ""}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="card border-l-4 border-green-500 bg-green-50">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className="font-semibold text-green-800">No urgent actions needed based on current thresholds.</p>
          </div>
        </div>
      )}

      {/* High clicks, no purchase */}
      {highClicksNoConv.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 text-red-600">
            ⚠️ High Clicks, No Purchase ({highClicksNoConv.length})
          </h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Search Term</th>
                  <th>Campaign</th>
                  <th>Category</th>
                  <th>Clicks</th>
                  <th>Cost</th>
                  <th>Purchases</th>
                </tr>
              </thead>
              <tbody>
                {highClicksNoConv.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    <td className="font-medium">{row.search_term}</td>
                    <td className="text-gray-500">{row.campaign}</td>
                    <td><span className="badge bg-gray-100 text-gray-600">{row.category}</span></td>
                    <td className="text-orange-500 font-medium">{row.clicks}</td>
                    <td>₹{row.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td className="text-red-500 font-bold">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* High spend, no purchase */}
      {highSpendNoConv.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 text-red-600">
            ⚠️ High Spend, No Purchase ({highSpendNoConv.length})
          </h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Search Term</th>
                  <th>Campaign</th>
                  <th>Category</th>
                  <th>Clicks</th>
                  <th>Cost</th>
                  <th>Purchases</th>
                </tr>
              </thead>
              <tbody>
                {highSpendNoConv.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    <td className="font-medium">{row.search_term}</td>
                    <td className="text-gray-500">{row.campaign}</td>
                    <td><span className="badge bg-gray-100 text-gray-600">{row.category}</span></td>
                    <td>{row.clicks}</td>
                    <td className="text-red-500 font-bold">₹{row.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td className="text-red-500 font-bold">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Poor n-grams */}
      {poorNgrams.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Poor-Performing N-grams</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N-gram</th>
                  <th>Type</th>
                  <th>Terms</th>
                  <th>Clicks</th>
                  <th>Cost</th>
                  <th>Purchases</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {poorNgrams.map((row, i) => (
                  <tr key={i}>
                    <td className="font-mono font-medium">{row.ngram}</td>
                    <td><span className="badge bg-gray-100 text-gray-600">{row.gram_type}</span></td>
                    <td>{row.term_count}</td>
                    <td>{row.clicks}</td>
                    <td className="text-red-500 font-medium">₹{row.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td className="text-red-500">{row.purchases}</td>
                    <td className="text-xs text-gray-500 max-w-[200px]">{row.flag_reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top recommendations */}
      {highConf.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">🚫 High Confidence Negatives to Add</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Exact Format</th>
                  <th>Match Type</th>
                  <th>Campaign</th>
                  <th>Cost</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {highConf.map((row, i) => (
                  <tr key={i}>
                    <td className="font-medium">{row.keyword}</td>
                    <td><code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{row.exact}</code></td>
                    <td><span className="badge bg-blue-100 text-blue-700">{row.match_type}</span></td>
                    <td className="text-gray-500">{row.campaign}</td>
                    <td className="text-red-500">₹{row.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td className="text-xs text-gray-500 max-w-[200px]">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
