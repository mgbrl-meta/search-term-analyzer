'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Term, Pagination, Tier } from '@/types/api';
import { getTerms } from '@/lib/apiClient';

interface Props {
  sessionId: string;
  initialTerms: Term[];
  initialPagination: Pagination;
}

type SortKey = keyof Pick<
  Term,
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
  | 'quality_score'
>;

const TIER_STYLES: Record<Tier, string> = {
  Star: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Solid: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Weak: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Drain: 'bg-red-500/15 text-red-400 border-red-500/30',
  Untested: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

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

function fmtCurrency(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
function fmtPct(n: number): string {
  const val = n <= 1 ? n * 100 : n;
  return val.toFixed(1) + '%';
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function TermsTable({
  sessionId,
  initialTerms,
  initialPagination,
}: Props) {
  const [terms, setTerms] = useState<Term[]>(initialTerms);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
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

  // Derive filter option lists from the initial dataset.
  const intents = Array.from(
    new Set(initialTerms.map((t) => t.intent).filter(Boolean))
  ).sort();
  const categories = Array.from(
    new Set(initialTerms.map((t) => t.category).filter(Boolean))
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
      setTerms(res.terms);
      setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load terms.');
    } finally {
      setLoading(false);
    }
  }, [
    sessionId,
    page,
    perPage,
    sort,
    order,
    tier,
    intent,
    category,
    debouncedQ,
  ]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    fetchTerms();
  }, [fetchTerms]);

  // Reset to first page when filters / sort change.
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
    <section className="panel p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-base font-semibold">Search Terms</h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              className="input-base w-44 pl-8"
              placeholder="Search terms…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5c6677]">
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
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="relative overflow-x-auto rounded-lg border border-[#232d42]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0e17]/60 backdrop-blur-sm">
            <Spinner />
          </div>
        )}
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#232d42] bg-[#1a2234] text-left">
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
              <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-[#c3cad8]">
                Tier
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-[#c3cad8]">
                Intent
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-[#c3cad8]">
                Category
              </th>
            </tr>
          </thead>
          <tbody>
            {terms.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 3}
                  className="px-3 py-10 text-center text-[#8b95a8]"
                >
                  No terms match your filters.
                </td>
              </tr>
            ) : (
              terms.map((t, idx) => (
                <tr
                  key={`${t.search_term}-${t.campaign}-${t.ad_group}-${idx}`}
                  className="border-b border-[#1c2536] transition hover:bg-[#161f30]"
                >
                  <td className="max-w-[260px] px-3 py-2.5 font-medium">
                    <span className="block truncate" title={t.search_term}>
                      {t.search_term}
                    </span>
                    <span
                      className="block truncate text-xs text-[#5c6677]"
                      title={`${t.campaign} › ${t.ad_group} · ${t.match_type}`}
                    >
                      {t.campaign} › {t.ad_group}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {t.impressions.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {t.clicks.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtPct(t.ctr)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtCurrency(t.cost)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtCurrency(t.cpc)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {t.conversions.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtPct(t.cvr)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtCurrency(t.conv_value)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {t.roas.toFixed(2)}x
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmtCurrency(t.cpa)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {t.quality_score}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                        TIER_STYLES[t.tier] ?? TIER_STYLES.Untested
                      }`}
                    >
                      {t.tier}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#c3cad8]">
                    {t.intent}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#c3cad8]">
                    {t.category}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-3 text-sm text-[#8b95a8]">
          <span>
            {from.toLocaleString()}–{to.toLocaleString()} of{' '}
            {pagination.total.toLocaleString()}
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

        <div className="flex items-center gap-2">
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
          <span className="px-2 text-sm text-[#c3cad8]">
            Page {pagination.page} / {Math.max(1, pagination.pages)}
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
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3b82f6"
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
