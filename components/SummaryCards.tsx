"use client";

import { Summary } from "@/types/analysis";
import { TrendingUp, TrendingDown, ShoppingCart, MousePointer, DollarSign, Target, AlertTriangle, ThumbsDown } from "lucide-react";

interface Props {
  summary: Summary;
}

function fmt(n: number, prefix = "", suffix = "", decimals = 0): string {
  if (n === undefined || n === null) return "—";
  return prefix + n.toLocaleString("en-IN", { maximumFractionDigits: decimals }) + suffix;
}

export default function SummaryCards({ summary: s }: Props) {
  const cards = [
    {
      label:   "Total Spend",
      value:   fmt(s.total_spend, "₹", "", 0),
      sub:     `${s.total_clicks.toLocaleString()} clicks`,
      icon:    <DollarSign className="w-5 h-5" />,
      color:   "blue",
    },
    {
      label:   "Purchases",
      value:   fmt(s.total_purchases, "", "", 0),
      sub:     `${fmt(s.total_conversions, "", "", 0)} total conversions`,
      icon:    <ShoppingCart className="w-5 h-5" />,
      color:   s.total_purchases > 0 ? "green" : "red",
    },
    {
      label:   "Revenue",
      value:   fmt(s.total_conv_value, "₹", "", 0),
      sub:     `ROAS: ${s.overall_roas.toFixed(2)}x`,
      icon:    <TrendingUp className="w-5 h-5" />,
      color:   s.overall_roas >= 2 ? "green" : s.overall_roas > 0 ? "yellow" : "red",
    },
    {
      label:   "Overall ROAS",
      value:   `${s.overall_roas.toFixed(2)}x`,
      sub:     `Target: 2.0x`,
      icon:    <Target className="w-5 h-5" />,
      color:   s.overall_roas >= 2 ? "green" : s.overall_roas >= 1 ? "yellow" : "red",
    },
    {
      label:   "Avg CPC",
      value:   fmt(s.avg_cpc, "₹", "", 2),
      sub:     `${s.total_impressions.toLocaleString()} impressions`,
      icon:    <MousePointer className="w-5 h-5" />,
      color:   "blue",
    },
    {
      label:   "CPA",
      value:   s.total_purchases > 0 ? fmt(s.cpa, "₹", "", 0) : "—",
      sub:     "Cost per purchase",
      icon:    <Target className="w-5 h-5" />,
      color:   "blue",
    },
    {
      label:   "Wasted Spend",
      value:   fmt(s.wasted_spend, "₹", "", 0),
      sub:     `${s.wasted_spend_pct.toFixed(1)}% of total spend`,
      icon:    <AlertTriangle className="w-5 h-5" />,
      color:   s.wasted_spend_pct > 40 ? "red" : s.wasted_spend_pct > 20 ? "yellow" : "green",
    },
    {
      label:   "Negatives Found",
      value:   s.recommendation_count.toString(),
      sub:     "Recommended negatives",
      icon:    <ThumbsDown className="w-5 h-5" />,
      color:   s.recommendation_count > 0 ? "red" : "green",
    },
  ];

  const colorMap: Record<string, string> = {
    blue:   "bg-blue-50 text-blue-600",
    green:  "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red:    "bg-red-50 text-red-600",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </div>
            <div className={`rounded-lg p-2 ${colorMap[card.color]}`}>
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
