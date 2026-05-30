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
        className="panel flex cursor-pointer flex-col items-center justify-center px-6 py-20 text-center transition"
        style={{
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: dragging ? 'var(--accent)' : 'var(--border-strong)',
          background: dragging ? 'var(--accent-soft)' : undefined,
          opacity: loading ? 0.7 : 1,
          pointerEvents: loading ? 'none' : undefined,
        }}
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
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              This can take a moment for large files.
            </p>
          </>
        ) : (
          <>
            <div
              className="rounded-2xl p-4"
              style={{ background: 'var(--accent-soft)' }}
            >
              <UploadIcon />
            </div>
            <p className="mt-4 text-base font-semibold">
              Drag &amp; drop your file here
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              or click to browse — CSV or XLSX
            </p>
          </>
        )}
      </div>

      {error && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-sm"
          style={{
            border: '1px solid var(--neg)',
            background: 'var(--accent-soft)',
            color: 'var(--neg)',
          }}
        >
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
      stroke="var(--accent)"
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
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
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
