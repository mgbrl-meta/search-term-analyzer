'use client';

import { useState, useCallback } from 'react';
import type { AnalyzeResponse } from '@/types/api';
import { exportCsvUrl, exportXlsxUrl } from '@/lib/apiClient';
import { num, str, obj } from '@/lib/format';
import FileUpload from '@/components/FileUpload';
import SummaryCards from '@/components/SummaryCards';
import TermsTable from '@/components/TermsTable';
import NgramsTable from '@/components/NgramsTable';
import RecommendationsPanel from '@/components/RecommendationsPanel';
import CategoryChart from '@/components/CategoryChart';
import ThemeToggle from '@/components/ThemeToggle';

type Tab = 'overview' | 'recommendations' | 'ngrams' | 'terms';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'ngrams', label: 'N-grams' },
  { id: 'terms', label: 'Search Terms' },
];

export default function Page() {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [tab, setTab] = useState<Tab>('overview');

  const handleResult = useCallback((res: AnalyzeResponse, name: string) => {
    setData(res);
    setFileName(name);
    setTab('overview');
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setFileName('');
  }, []);

  // --- Landing state (no data) ---
  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-8 sm:px-6 lg:px-8">
        <Header onReset={reset} hasData={false} />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full">
            <FileUpload onResult={handleResult} />
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  // --- Loaded state (single-frame) ---
  const summary = obj<AnalyzeResponse['summary']>(data.summary);
  const sessionId = str(data.session_id);
  const uniqueTerms = num(summary.unique_terms);

  return (
    <main className="mx-auto flex h-screen w-full max-w-[1440px] flex-col overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
      <Header
        onReset={reset}
        hasData
        sessionId={sessionId}
        fileName={fileName}
        uniqueTerms={uniqueTerms}
      />

      {/* Summary always visible */}
      <div className="mt-3 shrink-0">
        <SummaryCards summary={data.summary} />
      </div>

      {/* Tabs */}
      <div className="mt-3 shrink-0">
        <div className="seg">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="seg-btn"
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Single content frame — fills remaining height, swaps per tab */}
      <div className="fade-in mt-3 min-h-0 flex-1" key={tab}>
        {tab === 'overview' && (
          <CategoryChart
            categories={data.category_summary}
            intents={data.intent_summary}
          />
        )}
        {tab === 'recommendations' && (
          <RecommendationsPanel recommendations={data.recommendations} />
        )}
        {tab === 'ngrams' && (
          <NgramsTable sessionId={sessionId} initial={data.ngrams} />
        )}
        {tab === 'terms' && (
          <TermsTable
            sessionId={sessionId}
            initialTerms={data.terms}
            initialPagination={data.pagination}
          />
        )}
      </div>
    </main>
  );
}

function Header({
  onReset,
  hasData,
  sessionId,
  fileName,
  uniqueTerms,
}: {
  onReset: () => void;
  hasData: boolean;
  sessionId?: string;
  fileName?: string;
  uniqueTerms?: number;
}) {
  return (
    <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="display text-2xl leading-none sm:text-[1.7rem]">
          Search Term Analyzer
        </h1>
        {hasData && fileName ? (
          <p
            className="mt-1.5 flex items-center gap-2 text-[0.8125rem]"
            style={{ color: 'var(--text-muted)' }}
          >
            <FileIcon />
            <span
              className="font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {fileName}
            </span>
            <span>·</span>
            <span className="tnum">
              {(uniqueTerms ?? 0).toLocaleString('en-IN')} unique terms
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Upload a Google Shopping search-terms report for tiering, n-grams,
            and recommendations.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasData && sessionId && (
          <>
            <a className="btn-ghost" href={exportCsvUrl(sessionId)} download>
              <DownloadIcon /> CSV
            </a>
            <a className="btn-ghost" href={exportXlsxUrl(sessionId)} download>
              <DownloadIcon /> XLSX
            </a>
            <button className="btn-primary" onClick={onReset}>
              New Upload
            </button>
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer
      className="mt-8 shrink-0 border-t pt-5 text-center text-[11px]"
      style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}
    >
      Google Shopping Search Term Analyzer
    </footer>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function FileIcon() {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
