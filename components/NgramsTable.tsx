'use client';

import { useState, useMemo } from 'react';
import type { Ngram, NgramsResponse } from '@/types/api';

interface Props {
  sessionId: string;
  initial: NgramsResponse;
}

type N = 1 | 2 | 3;

type SortKey = keyof Pick<
  Ngram,
  | 'ngram'
  | 'count'
  | 'impressions'
  | 'clicks'
  | 'cost'
  | 'conversions'
  | 'revenue'
  | 'roas'
  | 'ctr'
  | 'cvr'
  | 'cpa'
>;

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'ngram', label: 'N-gram', numeric: false },
  { key: 'count', label: 'Count', numeric: true },
  { key: 'impressions', label: 'Impr.', numeric: true },
  { key: 'clicks', label: 'Clicks', numeric: true },
  { key: 'ctr', label: 'CTR', numeric: true },
  { key: 'cost', label: 'Cost', numeric: true },
  { key: 'conversions', label: 'Conv.', numeric: true },
  { key: 'cvr', label: 'CVR', numeric: true },
  { key: 'revenue', label: 'Revenue', numeric: true },
  { key: 'roas', label: 'ROAS', numeric: true },
  { key: 'cpa', label: 'CPA', numeric: true },
];

function fmtCurrency(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
function fmtPct(n: number): string {
  const val = n <= 1 ? n * 100 : n;
  return val.toFixed(1) + '%';
}

export default function NgramsTable({ initial }: Props) {
  const [active, setActive] = useState<N>(1);
  const [sort, setSort] = useState<SortKey>('cost');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [q, setQ] = useState('');

  const rows = useMemo<Ngram[]>(() => {
    const key = String(active) as '1' | '2' | '3';
    return initial[key] ?? [];
  }, [initial, active]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? rows.filter((r) => r.ngram.toLowerCase().includes(term))
      : rows.slice();

    base.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      let cmp: number;
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv);
      } else {
        cmp = (av as number) - (bv as number);
      }
      return order === 'asc' ? cmp : -cmp;
    });
    return base;
  }, [rows, q, sort, order]);

  const handleSort = (key: SortKey) => {
    if (sort === key) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setOrder(key === 'ngram' ? 'asc' : 'desc');
    }
  };

  const tabs: { n: N; label: string }[] = [
    { n: 1, label: '1-gram' },
    { n: 2, label: '2-gram' },
    { n: 3, label: '3-gram' },
  ];

  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="mr-2 text-base font-semibold">N-grams</h2>
          <div className="flex rounded-lg border border-[#232d42] bg-[#0a0e17] p-0.5">
            {tabs.map((t) => (
              <button
                key={t.n}
                onClick={() => setActive(t.n)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active === t.n
                    ? 'bg-blue-600 text-white'
                    : 'text-[#8b95a8] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <input
            className="input-base w-48 pl-8"
            placeholder="Filter n-grams…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5c6677]">
            <SearchIcon />
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#232d42]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#232d42] bg-[#1a2234]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 font-semibold text-[#c3cad8] transition hover:text-white ${
                    col.numeric ? 'text-right' : 'text-left'
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-1 ${
                      col.numeric ? 'justify-end' : ''
                    }`}
                  >
                    {col.label}
                    {sort === col.key && (
                      <span className="text-blue-400">
                        {order === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-10 text-center text-[#8b95a8]"
                >
                  No n-grams to display.
                </td>
              </tr>
            ) : (
              filtered.map((r, idx) => (
                <tr
                  key={`${r.ngram}-${idx}`}
                  className="border-b border-[#1c2536] transition hover:bg-[#161f30]"
                >
                  <td className="max-w-[280px] truncate px-3 py-2.5 font-medium">
                    <span title={r.ngram}>{r.ngram}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.count.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.impressions.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.clicks.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtPct(r.ctr)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtCurrency(r.cost)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.conversions.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtPct(r.cvr)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtCurrency(r.revenue)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {r.roas.toFixed(2)}x
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtCurrency(r.cpa)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[#5c6677]">
        {filtered.length.toLocaleString()} {active}-gram
        {filtered.length === 1 ? '' : 's'} shown
      </p>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
