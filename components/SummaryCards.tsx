'use client';

import type { Summary } from '@/types/api';
import { obj, fmtInt, fmtCurrency, fmtX, fmtPct } from '@/lib/format';

interface Props {
  // Live data may not match the declared shape — accept anything and guard.
  summary: Partial<Summary> | null | undefined;
}

type Tone = 'pos' | 'neg' | 'info' | 'warn' | 'accent' | 'plain';

const TONE_VAR: Record<Tone, string> = {
  pos: 'var(--pos)',
  neg: 'var(--neg)',
  info: 'var(--info)',
  warn: 'var(--warn)',
  accent: 'var(--accent)',
  plain: 'var(--text-primary)',
};

export default function SummaryCards({ summary }: Props) {
  const s = obj<Summary>(summary);

  const cards: { label: string; value: string; tone: Tone }[] = [
    { label: 'Total Spend', value: fmtCurrency(s.total_cost), tone: 'plain' },
    { label: 'Revenue', value: fmtCurrency(s.total_revenue), tone: 'pos' },
    { label: 'Blended ROAS', value: fmtX(s.blended_roas), tone: 'accent' },
    { label: 'CPA', value: fmtCurrency(s.blended_cpa), tone: 'warn' },
    { label: 'Clicks', value: fmtInt(s.total_clicks), tone: 'info' },
    {
      label: 'Conversions',
      value: fmtInt(s.total_conversions),
      tone: 'plain',
    },
    { label: 'CTR', value: fmtPct(s.blended_ctr), tone: 'info' },
    { label: 'CVR', value: fmtPct(s.blended_cvr), tone: 'pos' },
  ];

  return (
    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className="panel rise px-4 py-3.5"
          style={{ animationDelay: `${i * 35}ms` }}
        >
          <p
            className="text-[10.5px] font-medium uppercase tracking-[0.08em]"
            style={{ color: 'var(--text-muted)' }}
          >
            {c.label}
          </p>
          <p
            className="display tnum mt-1.5 text-[1.6rem] leading-none"
            style={{ color: TONE_VAR[c.tone], fontWeight: 500 }}
          >
            {c.value}
          </p>
        </div>
      ))}
    </section>
  );
}
