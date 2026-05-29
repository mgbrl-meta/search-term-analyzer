'use client';

import { useState, useCallback } from 'react';
import type { AnalyzeResponse } from '@/types/api';
import { exportCsvUrl, exportXlsxUrl } from '@/lib/apiClient';
import FileUpload from '@/components/FileUpload';
import SummaryCards from '@/components/SummaryCards';
import TermsTable from '@/components/TermsTable';
import NgramsTable from '@/components/NgramsTable';
import RecommendationsPanel from '@/components/RecommendationsPanel';
import CategoryChart from '@/components/CategoryChart';

export default function Page() {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleResult = useCallback((res: AnalyzeResponse, name: string) => {
    setData(res);
    setFileName(name);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setFileName('');
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Shopping Search Term Analyzer
          </h1>
          <p className="mt-1 text-sm text-[#8b95a8]">
            Upload a Google Shopping search-terms report to get tiering,
            n-grams, and recommendations.
          </p>
        </div>

        {data && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              className="btn-ghost"
              href={exportCsvUrl(data.session_id)}
              download
            >
              <DownloadIcon /> CSV
            </a>
            <a
              className="btn-ghost"
              href={exportXlsxUrl(data.session_id)}
              download
            >
              <DownloadIcon /> XLSX
            </a>
            <button className="btn-primary" onClick={reset}>
              New Upload
            </button>
          </div>
        )}
      </header>

      {!data ? (
        <FileUpload onResult={handleResult} />
      ) : (
        <div className="fade-in space-y-6">
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-[#8b95a8]">
              <FileIcon />
              <span className="font-medium text-[#e5e9f0]">{fileName}</span>
              <span>·</span>
              <span>
                {data.summary.unique_terms.toLocaleString()} unique terms
              </span>
            </div>
          )}

          <SummaryCards summary={data.summary} />

          <CategoryChart
            categories={data.category_summary}
            intents={data.intent_summary}
          />

          <RecommendationsPanel recommendations={data.recommendations} />

          <NgramsTable sessionId={data.session_id} initial={data.ngrams} />

          <TermsTable
            sessionId={data.session_id}
            initialTerms={data.terms}
            initialPagination={data.pagination}
          />
        </div>
      )}

      <footer className="mt-10 border-t border-[#232d42] pt-6 text-center text-xs text-[#5c6677]">
        Google Shopping Search Term Analyzer
      </footer>
    </main>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
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
      width="16"
      height="16"
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
