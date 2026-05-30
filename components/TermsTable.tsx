'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Term, Pagination, Tier } from '@/types/api';
import { getTerms } from '@/lib/apiClient';
import { num, str, arr, obj, fmtInt, fmtCurrency, fmtPct, fmtX } from '@/lib/format';

interface Props {
  sessionId: string;
  initialTerms: Term[] | null | undefined;
  initialPagination: Pagination | null | undefined;
}

type SortKey =
  | 'search_term'
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cost'
  | 'cpc'
  | 'conversions'
  | 'cvr'
  | 'conv_value'
  | 'roas'
  | 'cpa'
  | 'quality_score';

const TIER_COLOR: Record<string, string> = {
  Star: 'var(--pos)',
  Solid: 'var(--info)',
  Weak: 'var(--warn)',
  Drain: 'var(--neg)',
  Untested: 'var(--text-muted)',
};

function tierColor(t: string): string {
  return TIER_COLOR[t] ?? 'var(--text-muted)';
}

const TIERS: Tier[] = ['Star', 'Solid', 'Weak', 'Drain', 'Untested'];

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'search_term', label: 'Search Term', numeric: false },
  { key: 'impressions', label: 'Impr.', numeric: true },
  { key: 'clicks', label: 'Clicks', numeric: true },
  { key: 'ctr', label: 'CTR', numeric: true },
  { key: 'cost', label: 'Cost', numeric: true },
  { key: 'cpc', label: 'CPC', numeric: true },
  { key: 'conversions', label: 'Conv.', numeric: true },
  { key: 'cvr', label: 'CVR', numeric: true },
  { key: 'conv_value', label: 'Value', numeric: true },
  { key: 'roas', label: 'ROAS', numeric: true },
  { key: 'cpa', label: 'CPA', numeric: true },
  { key: 'quality_score', label: 'QS', numeric: true },
];

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  per_page: 50,
  total: 0,
  pages: 1,
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function safePagination(p: Partial<Pagination> | null | undefined): Pagination {
  const o = obj<Pagination>(p);
  return {
    page: Math.max(1, num(o.page) || 1),
    per_page: Math.max(1, num(o.per_page) || 50),
    total: num(o.total),
    pages: Math.max(1, num(o.pages) || 1),
  };
}

export default function TermsTable({
  sessionId,
  initialTerms,
  initialPagination,
}: Props) {
  const [terms, setTerms] = useState<Term[]>(arr<Term>(initialTerms));
  const [pagination, setPagination] = useState<Pagination>(
    safePagination(initialPagination)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<SortKey>('cost');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [tier, setTier] = useState('');
  const [intent, setIntent] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const debouncedQ = useDebounce(q, 350);
  const firstRender = useRef(true);

  // Derive filter option lists defensively from the initial dataset.
  const intents = Array.from(
    new Set(arr<Term>(initialTerms).map((t) => str(t?.intent)).filter(Boolean))
  ).sort();
  const categories = Array.from(
    new Set(
      arr<Term>(initialTerms).map((t) => str(t?.category)).filter(Boolean)
    )
  ).sort();

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTerms({
        session_id: sessionId,
        page,
        per_page: perPage,
        sort,
        order,
        tier: tier || undefined,
        intent: intent || undefined,
        category: category || undefined,
        q: debouncedQ || undefined,
      });
      setTerms(arr<Term>(res?.terms));
      setPagination(safePagination(res?.pagination));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load terms.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, page, perPage, sort, order, tier, intent, category, debouncedQ]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    fetchTerms();
  }, [fetchTerms]);

  useEffect(() => {
    setPage(1);
  }, [sort, order, tier, intent, category, debouncedQ, perPage]);

  const handleSort = (key: SortKey) => {
    if (sort === key) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setOrder(key === 'search_term' ? 'asc' : 'desc');
    }
  };

  const clearFilters = () => {
    setTier('');
    setIntent('');
    setCategory('');
    setQ('');
  };

  const hasFilters = Boolean(tier || intent || category || q);

  const from =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.per_page + 1;
  const to = Math.min(pagination.page * pagination.per_page, pagination.total);

  return (
    <section className="panel flex h-full min-h-0 flex-col p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">
          Search Terms
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              className="input-base w-40 pl-8"
              placeholder="Search…"
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

          <select
            className="input-base"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
          >
            <option value="">All Tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            className="input-base"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          >
            <option value="">All Intents</option>
            {intents.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>

          <select
            className="input-base"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button className="btn-ghost" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mb-3 rounded-lg px-4 py-2.5 text-sm"
          style={{
            border: '1px solid var(--neg)',
            background: 'var(--accent-soft)',
            color: 'var(--neg)',
          }}
        >
          {error}
        </div>
      )}

      <div
        className="relative min-h-0 flex-1 overflow-auto rounded-xl"
        style={{ border: '1px solid var(--border)' }}
      >
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm"
            style={{ background: 'var(--bg-panel)' }}
          >
            <Spinner />
          </div>
        )}
        <table className="w-full min-w-[1000px] border-collapse text-[0.8125rem]">
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
              {['Tier', 'Intent', 'Category'].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-3 py-2.5 text-left font-semibold"
                  style={{
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 3}
                  className="px-3 py-12 text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No terms match your filters.
                </td>
              </tr>
            ) : (
              terms.map((raw, idx) => {
                const t = obj<Term>(raw);
                const tierName = str(t.tier) || 'Untested';
                return (
                  <tr
                    key={`${str(t.search_term)}-${str(t.campaign)}-${idx}`}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--bg-inset)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <td className="max-w-[240px] px-3 py-2.5 font-medium">
                      <span
                        className="block truncate"
                        title={str(t.search_term)}
                      >
                        {str(t.search_term) || '—'}
                      </span>
                      <span
                        className="block truncate text-[11px]"
                        style={{ color: 'var(--text-faint)' }}
                        title={`${str(t.campaign)} › ${str(t.ad_group)} · ${str(
                          t.match_type
                        )}`}
                      >
                        {str(t.campaign)} › {str(t.ad_group)}
                      </span>
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtInt(t.impressions)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtInt(t.clicks)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtPct(t.ctr, 1)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtCurrency(t.cost)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtCurrency(t.cpc)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtInt(t.conversions)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtPct(t.cvr, 1)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtCurrency(t.conv_value)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right font-semibold">
                      {fmtX(t.roas)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtCurrency(t.cpa)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">
                      {fmtInt(t.quality_score)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          color: tierColor(tierName),
                          background: 'var(--bg-inset)',
                          border: '1px solid var(--border-strong)',
                        }}
                      >
                        {tierName}
                      </span>
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {str(t.intent) || '—'}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {str(t.category) || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div
          className="flex items-center gap-3 text-[0.8125rem]"
          style={{ color: 'var(--text-muted)' }}
        >
          <span className="tnum">
            {from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')} of{' '}
            {pagination.total.toLocaleString('en-IN')}
          </span>
          <select
            className="input-base py-1"
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
          >
            {[25, 50, 100, 250, 500].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className="btn-ghost px-3 py-1.5"
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPage(1)}
          >
            «
          </button>
          <button
            className="btn-ghost px-3 py-1.5"
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span
            className="tnum px-2 text-[0.8125rem]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {pagination.page} / {Math.max(1, pagination.pages)}
          </span>
          <button
            className="btn-ghost px-3 py-1.5"
            disabled={pagination.page >= pagination.pages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
          <button
            className="btn-ghost px-3 py-1.5"
            disabled={pagination.page >= pagination.pages || loading}
            onClick={() => setPage(pagination.pages)}
          >
            »
          </button>
        </div>
      </div>
    </section>
  );
}

function Spinner() {
  return (
    <svg
      className="spin"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
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
