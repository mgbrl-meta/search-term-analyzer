'use client';

import type { Summary } from '@/types/api';

interface Props {
  summary: Summary;
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString();
}
function fmtCurrency(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
function fmtX(n: number): string {
  return n.toFixed(2) + 'x';
}
function fmtPct(n: number): string {
  // Backend may send fractions (0.05) or whole percents (5). Heuristic: <=1 => fraction.
  const val = n <= 1 ? n * 100 : n;
  return val.toFixed(2) + '%';
}

interface Card {
  label: string;
  value: string;
  accent: string;
}

export default function SummaryCards({ summary }: Props) {
  const cards: Card[] = [
    {
      label: 'Total Spend',
      value: fmtCurrency(summary.total_cost),
      accent: 'text-rose-400',
    },
    {
      label: 'Clicks',
      value: fmtNum(summary.total_clicks),
      accent: 'text-sky-400',
    },
    {
      label: 'Blended ROAS',
      value: fmtX(summary.blended_roas),
      accent: 'text-emerald-400',
    },
    {
      label: 'CPA',
      value: fmtCurrency(summary.blended_cpa),
      accent: 'text-amber-400',
    },
    {
      label: 'Revenue',
      value: fmtCurrency(summary.total_revenue),
      accent: 'text-emerald-400',
    },
    {
      label: 'Conversions',
      value: fmtNum(summary.total_conversions),
      accent: 'text-violet-400',
    },
    {
      label: 'CTR',
      value: fmtPct(summary.blended_ctr),
      accent: 'text-sky-400',
    },
    {
      label: 'CVR',
      value: fmtPct(summary.blended_cvr),
      accent: 'text-teal-400',
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="panel p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#8b95a8]">
            {c.label}
          </p>
          <p className={`mt-2 text-xl font-bold sm:text-2xl ${c.accent}`}>
            {c.value}
          </p>
        </div>
      ))}
    </section>
  );
}
