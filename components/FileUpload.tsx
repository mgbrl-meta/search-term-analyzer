"use client";

import React, { useRef, useState } from "react";

type FileUploadProps = {
  onFileSelect?: (file: File) => void;
  onFileUpload?: (file: File) => void;
  onUpload?: (file: File) => void;
  onChange?: (file: File) => void;
  isLoading?: boolean;
  loading?: boolean;
  error?: string | null;
  [key: string]: any;
};

const brainCards = [
  {
    title: "Spend Wasters",
    body: "Terms and query themes burning budget below break-even ROAS.",
    tag: "CUT",
    metric: "Waste",
  },
  {
    title: "Negative Brain",
    body: "Exact, phrase, and broad negatives with winner-overlap protection.",
    tag: "BLOCK",
    metric: "Negatives",
  },
  {
    title: "N-Gram Waste",
    body: "Repeated phrases poisoning multiple search terms at scale.",
    tag: "THEMES",
    metric: "Patterns",
  },
  {
    title: "PDP Diagnosis",
    body: "High CTR but low CVR terms that are funnel issues, not keyword issues.",
    tag: "FIX",
    metric: "Funnel",
  },
  {
    title: "Scale Signals",
    body: "Profitable significant terms worth isolating, bidding up, or feeding.",
    tag: "SCALE",
    metric: "Winners",
  },
  {
    title: "True ROAS",
    body: "Separate brand harvesting from real non-brand acquisition efficiency.",
    tag: "SPLIT",
    metric: "Brand / NB",
  },
];

const pipeline = ["Parse", "Clean", "Filter", "Classify", "Diagnose", "Export"];

const requiredColumns = [
  "Search term",
  "Clicks",
  "Impr.",
  "Cost",
  "Conversions",
  "Conv. value",
];

function callUploadHandler(props: FileUploadProps, file: File) {
  const handlers = [
    props.onFileSelect,
    props.onFileUpload,
    props.onUpload,
    props.onChange,
  ].filter(Boolean);

  handlers.forEach((handler) => {
    try {
      handler?.(file);
    } catch {
      // Keep upload UI resilient.
    }
  });
}

function isValidFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
}

export default function FileUpload(props: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isLoading = Boolean(props.isLoading || props.loading);
  const error = props.error || localError;

  function handleFile(file?: File | null) {
    if (!file) return;

    if (!isValidFile(file)) {
      setLocalError("Upload a CSV or XLSX file exported from Google Ads.");
      return;
    }

    setLocalError(null);
    setSelectedFile(file);
    callUploadHandler(props, file);
  }

  return (
    <div className="relative mx-auto min-h-[calc(100vh-80px)] w-full max-w-7xl overflow-hidden px-4 pb-10 pt-4 font-sans sm:px-6 lg:px-8">
      <style jsx global>{`
        body {
          font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }

        .font-serif {
          font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.06)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="absolute left-[-12%] top-[-20%] h-[520px] w-[520px] rounded-full bg-cyan-500/15 blur-[110px]" />
        <div className="absolute right-[-8%] top-[8%] h-[540px] w-[540px] rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute bottom-[-18%] left-[30%] h-[420px] w-[420px] rounded-full bg-violet-600/10 blur-[110px]" />
      </div>

      <section className="grid items-center gap-8 py-8 lg:grid-cols-[1.03fr_0.97fr] lg:py-14">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
            Google Ads Intelligence Engine
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.07em] text-slate-950 sm:text-6xl lg:text-7xl">
            Search Term
            <span className="block bg-gradient-to-r from-blue-700 via-slate-950 to-violet-700 bg-clip-text text-transparent">
              Command Brain
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-[15px] font-medium leading-7 text-slate-600 sm:text-base">
            Upload one Google Ads search-term export. The engine converts raw queries into
            negative keywords, spend-waster cuts, n-gram waste, PDP issues, scale signals,
            and true non-brand ROAS actions.
          </p>

          <div className="mt-7 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["ROAS", "mapped"],
              ["0-spend", "ignored"],
              ["Overlap", "guard"],
              ["Actions", "exportable"],
            ].map(([top, bottom]) => (
              <div
                key={top}
                className="rounded-2xl border border-slate-200/80 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-xl"
              >
                <div className="text-sm font-black tracking-[-0.03em] text-slate-950">{top}</div>
                <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {bottom}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-blue-500/20 via-transparent to-violet-500/20 blur-2xl" />

          <div className="relative rounded-[2rem] border border-slate-200/80 bg-white/70 p-3 shadow-2xl shadow-blue-950/10 backdrop-blur-2xl">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                handleFile(event.dataTransfer.files?.[0]);
              }}
              className={[
                "group relative overflow-hidden rounded-[1.7rem] border p-7 transition-all sm:p-8",
                dragActive
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-200 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/40",
              ].join(" ")}
            >
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.22),transparent_32%),radial-gradient(circle_at_10%_90%,rgba(139,92,246,0.16),transparent_35%)]" />
              <div className="absolute right-5 top-5 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                CSV / XLSX
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />

              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-700 shadow-[0_0_35px_rgba(59,130,246,0.25)] transition group-hover:scale-105">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 16V4M12 4L7 9M12 4L17 9"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 16.5V18.5C20 19.3284 19.3284 20 18.5 20H5.5C4.67157 20 4 19.3284 4 18.5V16.5"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="min-w-0">
                  <h2 className="text-2xl font-black tracking-[-0.05em] text-slate-950">
                    Upload report
                  </h2>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                    Drop your Google Ads search-term report or click to browse.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                {selectedFile ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-700">
                    Selected: {selectedFile.name}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-center text-sm font-bold text-slate-500">
                    Drag file here to start analysis
                  </div>
                )}

                {isLoading ? (
                  <div className="mt-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-700">
                    Building operator action brain…
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white/60 p-4 backdrop-blur">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Required signal columns
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {requiredColumns.map((col) => (
                    <span
                      key={col}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {brainCards.map((card) => (
          <div
            key={card.title}
            className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/60 p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:border-blue-400/60 hover:shadow-xl hover:shadow-blue-950/5"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent opacity-0 transition group-hover:opacity-100" />

            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="rounded-full border border-blue-500/20 bg-blue-500/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                {card.tag}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                {card.metric}
              </span>
            </div>

            <h3 className="text-[17px] font-black leading-tight tracking-[-0.04em] text-slate-950">
              {card.title}
            </h3>
            <p className="mt-2 text-sm font-medium leading-5 text-slate-500">
              {card.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-[2rem] border border-slate-200/80 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-700">
              Analysis pipeline
            </p>
            <h3 className="mt-1 text-2xl font-black tracking-[-0.05em] text-slate-950">
              Raw export → decision-ready action sheet
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pipeline.map((step, index) => (
              <React.Fragment key={step}>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
                  {index + 1}. {step}
                </span>
                {index < pipeline.length - 1 ? (
                  <span className="hidden text-slate-300 sm:inline">→</span>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
