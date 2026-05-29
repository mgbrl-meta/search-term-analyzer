'use client';

import { useState, useMemo } from 'react';
import type { Recommendation, Priority } from '@/types/api';

interface Props {
  recommendations: Recommendation[];
}

const PRIORITY_ORDER: Record<Priority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const PRIORITY_STYLES: Record<Priority, string> = {
  Critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  High: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Medium: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Low: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const PRIORITY_BAR: Record<Priority, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-blue-500',
  Low: 'bg-gray-500',
};

function fmtImpact(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export default function RecommendationsPanel({ recommendations }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sorted = useMemo(() => {
    return [...recommendations].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99;
      const pb = PRIORITY_ORDER[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return (b.impact || 0) - (a.impact || 0);
    });
  }, [recommendations]);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (sorted.length === 0) {
    return (
      <section className="panel p-5">
        <h2 className="text-base font-semibold">Recommendations</h2>
        <p className="mt-3 text-sm text-[#8b95a8]">
          No recommendations generated for this dataset.
        </p>
      </section>
    );
  }

  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recommendations</h2>
        <span className="text-xs text-[#8b95a8]">
          {sorted.length} item{sorted.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((rec) => {
          const isOpen = !!expanded[rec.id];
          const visibleTerms = isOpen ? rec.terms : rec.terms.slice(0, 6);
          const hiddenCount = rec.terms.length - visibleTerms.length;

          return (
            <div
              key={rec.id}
              className="panel-elevated relative overflow-hidden p-4"
            >
              <span
                className={`absolute left-0 top-0 h-full w-1 ${
                  PRIORITY_BAR[rec.priority] ?? PRIORITY_BAR.Low
                }`}
              />
              <div className="flex items-start justify-between gap-3 pl-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                        PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.Low
                      }`}
                    >
                      {rec.priority}
                    </span>
                    {rec.type && (
                      <span className="rounded-full border border-[#232d42] bg-[#0a0e17] px-2 py-0.5 text-xs text-[#8b95a8]">
                        {rec.type}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold leading-snug">
                    {rec.title}
                  </h3>
                </div>
                {rec.impact > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-[#8b95a8]">Impact</p>
                    <p className="text-sm font-bold text-emerald-400">
                      {fmtImpact(rec.impact)}
                    </p>
                  </div>
                )}
              </div>

              <p className="mt-2 pl-2 text-sm text-[#c3cad8]">
                {rec.description}
              </p>

              {rec.terms.length > 0 && (
                <div className="mt-3 pl-2">
                  <div className="flex flex-wrap gap-1.5">
                    {visibleTerms.map((term, i) => (
                      <span
                        key={`${rec.id}-${term}-${i}`}
                        className="rounded-md border border-[#232d42] bg-[#0a0e17] px-2 py-0.5 text-xs text-[#c3cad8]"
                        title={term}
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                  {(hiddenCount > 0 || isOpen) && rec.terms.length > 6 && (
                    <button
                      onClick={() => toggle(rec.id)}
                      className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300"
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
    </section>
  );
}
