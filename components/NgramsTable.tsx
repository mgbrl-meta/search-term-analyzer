'use client';

import { useState, useMemo } from 'react';
import type { Ngram, NgramsResponse } from '@/types/api';
import { num, str, arr, obj, fmtInt, fmtCurrency, fmtPct, fmtX } from '@/lib/format';

interface Props {
  sessionId: string;
  initial: NgramsResponse | null | undefined;
}

type N = 1 | 2 | 3;

type SortKey =
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
  | 'cpa';

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

export default function NgramsTable({ initial }: Props) {
  const [active, setActive] = useState<N>(1);
  const [sort, setSort] = useState<SortKey>('cost');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [q, setQ] = useState('');

  const rows = useMemo<Ngram[]>(() => {
    const src = obj<NgramsResponse>(initial);
    const key = String(active) as '1' | '2' | '3';
    return arr<Ngram>(src[key]);
  }, [initial, active]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? rows.filter((r) => str(obj<Ngram>(r).ngram).toLowerCase().includes(term))
      : rows.slice();

    base.sort((a, b) => {
      const ao = obj<Ngram>(a);
      const bo = obj<Ngram>(b);
      let cmp: number;
      if (sort === 'ngram') {
        cmp = str(ao.ngram).localeCompare(str(bo.ngram));
      } else {
        cmp = num(ao[sort]) - num(bo[sort]);
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
    <section className="panel flex h-full min-h-0 flex-col p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[0.95rem] font-semibold tracking-tight">
            N-grams
          </h2>
          <div className="seg">
            {tabs.map((t) => (
              <button
                key={t.n}
                onClick={() => setActive(t.n)}
                className="seg-btn"
                data-active={active === t.n}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <input
            className="input-base w-44 pl-8"
            placeholder="Filter n-grams…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-faint)' }}
          >
            <SearchIcon />
          </span>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto rounded-xl"
        style={{ border: '1px solid var(--border)' }}
      >
        <table className="w-full min-w-[900px] border-collapse text-[0.8125rem]">
          <thead className="sticky top-0 z-[1]">
            <tr style={{ background: 'var(--bg-inset)' }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 font-semibold ${
                    col.numeric ? 'text-right' : 'text-left'
                  }`}
                  style={{
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span
                    className={`inline-flex items-center gap-1 ${
                      col.numeric ? 'justify-end' : ''
                    }`}
                  >
                    {col.label}
                    {sort === col.key && (
                      <span style={{ color: 'var(--accent)' }}>
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
                  className="px-3 py-12 text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No n-grams to display.
                </td>
              </tr>
            ) : (
              filtered.map((raw, idx) => {
                const r = obj<Ngram>(raw);
                return (
                  <tr
                    key={`${str(r.ngram)}-${idx}`}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--bg-inset)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <td className="max-w-[280px] truncate px-3 py-2.5 font-medium">
                      <span title={str(r.ngram)}>{str(r.ngram) || '—'}</span>
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtInt(r.count)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtInt(r.impressions)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtInt(r.clicks)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtPct(r.ctr, 1)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtCurrency(r.cost)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtInt(r.conversions)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtPct(r.cvr, 1)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtCurrency(r.revenue)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right font-semibold">
                      {fmtX(r.roas)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtCurrency(r.cpa)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
        {filtered.length.toLocaleString('en-IN')} {active}-gram
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
