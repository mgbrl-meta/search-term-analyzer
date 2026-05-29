'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import type { AnalyzeResponse } from '@/types/api';
import { analyzeFile } from '@/lib/apiClient';

interface Props {
  onResult: (res: AnalyzeResponse, fileName: string) => void;
}

const ACCEPTED = ['.csv', '.xlsx', '.xls'];

function isAccepted(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED.some((ext) => lower.endsWith(ext));
}

export default function FileUpload({ onResult }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    async (file: File) => {
      setError(null);
      if (!isAccepted(file.name)) {
        setError('Unsupported file type. Please upload a CSV or XLSX file.');
        return;
      }
      setLoading(true);
      try {
        const res = await analyzeFile(file);
        onResult(res, file.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to analyze file.');
      } finally {
        setLoading(false);
      }
    },
    [onResult]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (loading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) process(file);
    },
    [loading, process]
  );

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) process(file);
      e.target.value = '';
    },
    [process]
  );

  return (
    <div className="fade-in mx-auto max-w-2xl">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !loading) {
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!loading) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
          dragging
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-[#2c3851] bg-[#111827] hover:border-[#3a4866]'
        } ${loading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={onChange}
        />

        {loading ? (
          <>
            <Spinner />
            <p className="mt-4 text-sm font-medium">Analyzing your report…</p>
            <p className="mt-1 text-xs text-[#8b95a8]">
              This can take a moment for large files.
            </p>
          </>
        ) : (
          <>
            <div className="rounded-full bg-[#1a2234] p-4">
              <UploadIcon />
            </div>
            <p className="mt-4 text-base font-semibold">
              Drag &amp; drop your file here
            </p>
            <p className="mt-1 text-sm text-[#8b95a8]">
              or click to browse — CSV or XLSX
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="spin"
      width="36"
      height="36"
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

function UploadIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3b82f6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
