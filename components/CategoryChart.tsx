'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { CategorySummary, IntentSummary } from '@/types/api';

interface Props {
  categories: CategorySummary[];
  intents: IntentSummary[];
}

const CAT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
  '#f97316',
  '#14b8a6',
];

function fmtCurrencyShort(n: number): string {
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(1) + 'Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + 'L';
  if (n >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K';
  return '₹' + Math.round(n);
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}

interface ChartRow {
  name: string;
  cost: number;
  revenue: number;
  roas: number;
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#232d42] bg-[#0a0e17] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-[#e5e9f0]">{row.name}</p>
      <p className="text-rose-400">Cost: {fmtCurrencyShort(row.cost)}</p>
      <p className="text-emerald-400">
        Revenue: {fmtCurrencyShort(row.revenue)}
      </p>
      <p className="text-sky-400">ROAS: {row.roas.toFixed(2)}x</p>
    </div>
  );
}

export default function CategoryChart({ categories, intents }: Props) {
  const catData = useMemo<ChartRow[]>(
    () =>
      [...categories]
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10)
        .map((c) => ({
          name: c.category,
          cost: c.cost,
          revenue: c.revenue,
          roas: c.roas,
        })),
    [categories]
  );

  const intentData = useMemo<ChartRow[]>(
    () =>
      [...intents]
        .sort((a, b) => b.cost - a.cost)
        .map((i) => ({
          name: i.intent,
          cost: i.cost,
          revenue: i.revenue,
          roas: i.roas,
        })),
    [intents]
  );

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Spend & Revenue by Category"
        subtitle="Top 10 categories by spend"
        data={catData}
        empty="No category data."
      />
      <ChartCard
        title="Spend & Revenue by Intent"
        subtitle="Grouped by search intent"
        data={intentData}
        empty="No intent data."
      />
    </section>
  );
}

function ChartCard({
  title,
  subtitle,
  data,
  empty,
}: {
  title: string;
  subtitle: string;
  data: ChartRow[];
  empty: string;
}) {
  return (
    <div className="panel p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-[#8b95a8]">{subtitle}</p>
      </div>

      {data.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-[#8b95a8]">
          {empty}
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#232d42"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: '#8b95a8', fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={60}
                stroke="#232d42"
              />
              <YAxis
                tick={{ fill: '#8b95a8', fontSize: 11 }}
                tickFormatter={fmtCurrencyShort}
                stroke="#232d42"
                width={60}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
              />
              <Bar dataKey="cost" name="Cost" radius={[3, 3, 0, 0]}>
                {data.map((_, i) => (
                  <Cell
                    key={`cost-${i}`}
                    fill={CAT_COLORS[i % CAT_COLORS.length]}
                    fillOpacity={0.55}
                  />
                ))}
              </Bar>
              <Bar dataKey="revenue" name="Revenue" radius={[3, 3, 0, 0]}>
                {data.map((_, i) => (
                  <Cell
                    key={`rev-${i}`}
                    fill={CAT_COLORS[i % CAT_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-[#8b95a8]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500/55" />
          Cost
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
          Revenue
        </span>
      </div>
    </div>
  );
}
