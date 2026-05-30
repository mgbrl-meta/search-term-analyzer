'use client';

import { useState, useMemo } from 'react';
import type { Recommendation, Priority } from '@/types/api';
import { num, str, arr, fmtCurrency } from '@/lib/format';

interface Props {
  recommendations: Recommendation[] | null | undefined;
}

const PRIORITY_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

// color var per priority; unknown priorities fall back to muted.
const PRIORITY_COLOR: Record<string, string> = {
  Critical: 'var(--neg)',
  High: 'var(--warn)',
  Medium: 'var(--info)',
  Low: 'var(--text-muted)',
};

function priorityColor(p: string): string {
  return PRIORITY_COLOR[p] ?? 'var(--text-muted)';
}

// A defensively-normalized view of a recommendation row.
interface SafeRec {
  id: string;
  priority: string;
  type: string;
  title: string;
  description: string;
  terms: string[];
  impact: number;
}

function normalize(rec: Partial<Recommendation>, idx: number): SafeRec {
  return {
    id: str(rec?.id) || `rec-${idx}`,
    priority: str(rec?.priority) || 'Low',
    type: str(rec?.type),
    title: str(rec?.title) || 'Recommendation',
    description: str(rec?.description),
    terms: arr<string>(rec?.terms).map((t) => str(t)),
    impact: num(rec?.impact),
  };
}

export default function RecommendationsPanel({ recommendations }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sorted = useMemo<SafeRec[]>(() => {
    return arr<Recommendation>(recommendations)
      .map((r, i) => normalize(r as Partial<Recommendation>, i))
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 99;
        const pb = PRIORITY_ORDER[b.priority] ?? 99;
        if (pa !== pb) return pa - pb;
        return b.impact - a.impact;
      });
  }, [recommendations]);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section className="panel flex h-full min-h-0 flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">
          Recommendations
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {sorted.length} item{sorted.length === 1 ? '' : 's'}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          No recommendations for this dataset.
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-2.5 overflow-auto pr-1 md:grid-cols-2">
          {sorted.map((rec) => {
            const isOpen = !!expanded[rec.id];
            const visibleTerms = isOpen ? rec.terms : rec.terms.slice(0, 6);
            const hiddenCount = rec.terms.length - visibleTerms.length;
            const color = priorityColor(rec.priority);

            return (
              <div
                key={rec.id}
                className="panel-elevated relative overflow-hidden p-3.5"
              >
                <span
                  className="absolute left-0 top-0 h-full w-[3px]"
                  style={{ background: color }}
                />
                <div className="flex items-start justify-between gap-3 pl-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{
                          color,
                          background: 'var(--bg-inset)',
                          border: `1px solid var(--border-strong)`,
                        }}
                      >
                        {rec.priority}
                      </span>
                      {rec.type && <span className="chip">{rec.type}</span>}
                    </div>
                    <h3 className="mt-2 text-[0.8125rem] font-semibold leading-snug">
                      {rec.title}
                    </h3>
                  </div>
                  {rec.impact > 0 && (
                    <div className="shrink-0 text-right">
                      <p
                        className="text-[10px] uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Impact
                      </p>
                      <p
                        className="tnum text-sm font-bold"
                        style={{ color: 'var(--pos)' }}
                      >
                        {fmtCurrency(rec.impact)}
                      </p>
                    </div>
                  )}
                </div>

                {rec.description && (
                  <p
                    className="mt-2 pl-2 text-[0.8125rem] leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {rec.description}
                  </p>
                )}

                {rec.terms.length > 0 && (
                  <div className="mt-2.5 pl-2">
                    <div className="flex flex-wrap gap-1.5">
                      {visibleTerms.map((term, i) => (
                        <span
                          key={`${rec.id}-${term}-${i}`}
                          className="chip max-w-[180px] truncate"
                          title={term}
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                    {rec.terms.length > 6 && (
                      <button
                        onClick={() => toggle(rec.id)}
                        className="mt-2 text-[11px] font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        {isOpen
                          ? 'Show less'
                          : `+${hiddenCount} more term${
                              hiddenCount === 1 ? '' : 's'
                            }`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
