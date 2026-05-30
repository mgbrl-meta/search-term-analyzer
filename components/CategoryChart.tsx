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
import { num, str, arr, fmtCurrencyShort, fmtX } from '@/lib/format';

interface Props {
  categories: CategorySummary[] | null | undefined;
  intents: IntentSummary[] | null | undefined;
}

const SERIES = ['#5b8cff', '#34d399', '#fbbf24', '#c084fc', '#f472b6', '#22d3ee'];

interface ChartRow {
  name: string;
  cost: number;
  revenue: number;
  roas: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs"
      style={{
        borderColor: 'var(--border-strong)',
        background: 'var(--bg-solid)',
        boxShadow: 'var(--shadow-pop)',
      }}
    >
      <p className="mb-1 font-semibold" style={{ color: 'var(--text-primary)' }}>
        {row.name || '—'}
      </p>
      <p style={{ color: 'var(--text-secondary)' }}>
        Cost <span className="tnum">{fmtCurrencyShort(row.cost)}</span>
      </p>
      <p style={{ color: 'var(--pos)' }}>
        Revenue <span className="tnum">{fmtCurrencyShort(row.revenue)}</span>
      </p>
      <p style={{ color: 'var(--accent)' }}>
        ROAS <span className="tnum">{fmtX(row.roas)}</span>
      </p>
    </div>
  );
}

export default function CategoryChart({ categories, intents }: Props) {
  const catData = useMemo<ChartRow[]>(
    () =>
      arr<CategorySummary>(categories)
        .map((c) => ({
          name: str((c as Partial<CategorySummary>)?.category) || '—',
          cost: num((c as Partial<CategorySummary>)?.cost),
          revenue: num((c as Partial<CategorySummary>)?.revenue),
          roas: num((c as Partial<CategorySummary>)?.roas),
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10),
    [categories]
  );

  const intentData = useMemo<ChartRow[]>(
    () =>
      arr<IntentSummary>(intents)
        .map((i) => ({
          name: str((i as Partial<IntentSummary>)?.intent) || '—',
          cost: num((i as Partial<IntentSummary>)?.cost),
          revenue: num((i as Partial<IntentSummary>)?.revenue),
          roas: num((i as Partial<IntentSummary>)?.roas),
        }))
        .sort((a, b) => b.cost - a.cost),
    [intents]
  );

  return (
    <div className="grid h-full gap-3 lg:grid-cols-2">
      <ChartCard
        title="Spend & Revenue by Category"
        subtitle="Top 10 by spend"
        data={catData}
        empty="No category data."
      />
      <ChartCard
        title="Spend & Revenue by Intent"
        subtitle="Grouped by search intent"
        data={intentData}
        empty="No intent data."
      />
    </div>
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
    <div className="panel flex min-h-0 flex-col p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      </div>

      {data.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center text-sm"
          style={{ color: 'var(--text-muted)', minHeight: 220 }}
        >
          {empty}
        </div>
      ) : (
        <div className="min-h-0 flex-1" style={{ minHeight: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, left: -8, bottom: 44 }}
              barGap={2}
            >
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
                angle={-28}
                textAnchor="end"
                interval={0}
                height={56}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
                tickFormatter={(v) => fmtCurrencyShort(v)}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: 'var(--accent-soft)' }}
              />
              <Bar dataKey="cost" name="Cost" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell
                    key={`c-${i}`}
                    fill={SERIES[i % SERIES.length]}
                    fillOpacity={0.4}
                  />
                ))}
              </Bar>
              <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={`r-${i}`} fill={SERIES[i % SERIES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div
        className="mt-2 flex items-center gap-4 text-[11px]"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ background: SERIES[0], opacity: 0.4 }}
          />
          Cost
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ background: SERIES[0] }}
          />
          Revenue
        </span>
      </div>
    </div>
  );
}
