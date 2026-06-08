"use client";

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react";
import type { AnalyzeResponse } from "@/types/api";
import { analyzeFile } from "@/lib/apiClient";

interface Props {
  onResult: (res: AnalyzeResponse, fileName: string) => void;
}

const ACCEPTED = [".csv", ".xlsx", ".xls"];

const brainCards = [
  {
    title: "Spend Wasters",
    body: "Terms and query themes burning budget below break-even ROAS.",
    tag: "CUT",
    accent: "text-[#EA4335]",
  },
  {
    title: "Negative Brain",
    body: "Exact, phrase, and broad negatives with winner-overlap protection.",
    tag: "BLOCK",
    accent: "text-[#4285F4]",
  },
  {
    title: "N-Gram Waste",
    body: "Repeated phrases poisoning multiple search terms at scale.",
    tag: "THEMES",
    accent: "text-[#FBBC04]",
  },
  {
    title: "PDP Diagnosis",
    body: "High CTR but low CVR terms that are funnel issues, not keyword issues.",
    tag: "FIX",
    accent: "text-[#34A853]",
  },
  {
    title: "Scale Signals",
    body: "Profitable significant terms worth isolating, bidding up, or feeding.",
    tag: "SCALE",
    accent: "text-[#4285F4]",
  },
  {
    title: "True ROAS",
    body: "Separate brand harvesting from real non-brand acquisition efficiency.",
    tag: "SPLIT",
    accent: "text-[#EA4335]",
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

function isAccepted(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED.some((ext) => lower.endsWith(ext));
}

function GoogleG() {
  return (
    <div className="relative h-8 w-8 rounded-full bg-white shadow-sm">
      <div className="absolute inset-0 rounded-full border-[6px] border-[#4285F4]" />
      <div className="absolute left-0 top-0 h-4 w-4 rounded-tl-full border-l-[6px] border-t-[6px] border-[#EA4335]" />
      <div className="absolute bottom-0 left-0 h-4 w-4 rounded-bl-full border-b-[6px] border-l-[6px] border-[#FBBC04]" />
      <div className="absolute bottom-0 right-0 h-4 w-4 rounded-br-full border-b-[6px] border-r-[6px] border-[#34A853]" />
      <div className="absolute right-0 top-[13px] h-[6px] w-4 bg-[#4285F4]" />
      <div className="absolute right-0 top-0 h-3 w-3 bg-white" />
    </div>
  );
}

export default function FileUpload({ onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>("");

  const process = useCallback(
    async (file: File) => {
      setError(null);

      if (!isAccepted(file.name)) {
        setError("Upload a CSV or XLSX file exported from Google Ads.");
        return;
      }

      setSelectedFile(file.name);
      setLoading(true);

      try {
        const res = await analyzeFile(file);
        onResult(res, file.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to analyze file.");
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
      e.target.value = "";
    },
    [process]
  );

  return (
    <div className="relative mx-auto min-h-[calc(100vh-150px)] w-full max-w-7xl overflow-hidden px-4 pb-10 pt-4 font-sans sm:px-6 lg:px-8">
      <style jsx global>{`
        body {
          font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }

        .font-serif,
        .display {
          font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(66,133,244,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(66,133,244,0.055)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute left-[-10%] top-[-18%] h-[500px] w-[500px] rounded-full bg-[#4285F4]/12 blur-[110px]" />
        <div className="absolute right-[-8%] top-[4%] h-[470px] w-[470px] rounded-full bg-[#34A853]/12 blur-[110px]" />
        <div className="absolute bottom-[-18%] left-[20%] h-[420px] w-[420px] rounded-full bg-[#FBBC04]/12 blur-[110px]" />
        <div className="absolute bottom-[-12%] right-[18%] h-[320px] w-[320px] rounded-full bg-[#EA4335]/10 blur-[100px]" />
      </div>

      <section className="grid items-center gap-8 py-8 lg:grid-cols-[1.03fr_0.97fr] lg:py-14">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-700 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#34A853] shadow-[0_0_14px_rgba(52,168,83,0.8)]" />
            Google Ads Intelligence Engine
          </div>

          <div className="mb-5 flex items-center gap-3">
            <GoogleG />
            <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Search term operating system
            </span>
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.07em] text-slate-950 sm:text-6xl lg:text-7xl">
            Search Term
            <span className="block bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#FBBC04] bg-clip-text text-transparent">
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
              ["ROAS", "mapped", "#4285F4"],
              ["0-spend", "ignored", "#34A853"],
              ["Overlap", "guard", "#FBBC04"],
              ["Actions", "exportable", "#EA4335"],
            ].map(([top, bottom, color]) => (
              <div
                key={top}
                className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl"
              >
                <div
                  className="text-sm font-black tracking-[-0.03em]"
                  style={{ color }}
                >
                  {top}
                </div>
                <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {bottom}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[2.5rem] bg-[conic-gradient(from_180deg,#4285F433,#34A85333,#FBBC0433,#EA433533,#4285F433)] blur-2xl" />

          <div className="relative rounded-[2rem] border border-slate-200/80 bg-white/75 p-3 shadow-2xl shadow-slate-950/10 backdrop-blur-2xl">
            <div
              role="button"
              tabIndex={0}
              onClick={() => !loading && inputRef.current?.click()}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !loading) {
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!loading) setDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragging(false);
              }}
              onDrop={onDrop}
              className={[
                "group relative overflow-hidden rounded-[1.7rem] border p-7 transition-all sm:p-8",
                dragging
                  ? "border-[#4285F4] bg-[#4285F4]/10"
                  : "border-slate-200 bg-slate-50/70 hover:border-[#4285F4]/60 hover:bg-white",
                loading ? "pointer-events-none opacity-75" : "cursor-pointer",
              ].join(" ")}
            >
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_10%,rgba(66,133,244,0.18),transparent_32%),radial-gradient(circle_at_10%_90%,rgba(52,168,83,0.14),transparent_35%),radial-gradient(circle_at_50%_110%,rgba(251,188,4,0.14),transparent_35%)]" />

              <div className="absolute right-5 top-5 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                CSV / XLSX
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onChange}
              />

              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#4285F4]/20 bg-[#4285F4]/10 text-[#4285F4] shadow-[0_0_35px_rgba(66,133,244,0.25)] transition group-hover:scale-105">
                  {loading ? <Spinner /> : <UploadIcon />}
                </div>

                <div className="min-w-0">
                  <h2 className="text-2xl font-black tracking-[-0.05em] text-slate-950">
                    {loading ? "Analyzing report" : "Upload report"}
                  </h2>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                    {loading
                      ? "Building action tabs, n-gram waste, negatives, and scale signals."
                      : "Drop your Google Ads search-term report or click to browse."}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                {selectedFile ? (
                  <div className="rounded-2xl border border-[#34A853]/25 bg-[#34A853]/10 px-4 py-3 text-sm font-black text-[#137333]">
                    Selected: {selectedFile}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/65 px-4 py-5 text-center text-sm font-bold text-slate-500">
                    Drag file here to start analysis
                  </div>
                )}

                {loading ? (
                  <div className="mt-3 rounded-2xl border border-[#4285F4]/20 bg-[#4285F4]/10 px-4 py-3 text-sm font-black text-[#1967D2]">
                    Uploading and analyzing. This may take a moment for large exports…
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-3 rounded-2xl border border-[#EA4335]/25 bg-[#EA4335]/10 px-4 py-3 text-sm font-bold text-[#C5221F]">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white/65 p-4 backdrop-blur">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Required signal columns
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {requiredColumns.map((col, index) => {
                    const colors = ["#4285F4", "#EA4335", "#FBBC04", "#34A853"];
                    return (
                      <span
                        key={col}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
                        style={{ boxShadow: `inset 3px 0 0 ${colors[index % colors.length]}` }}
                      >
                        {col}
                      </span>
                    );
                  })}
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
            className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/65 p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-950/5"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#FBBC04] opacity-0 transition group-hover:opacity-100" />

            <div className="mb-5 flex items-center justify-between gap-3">
              <span className={`rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${card.accent}`}>
                {card.tag}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#34A853] shadow-[0_0_10px_rgba(52,168,83,0.8)]" />
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

      <section className="mt-6 rounded-[2rem] border border-slate-200/80 bg-white/65 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#4285F4]">
              Analysis pipeline
            </p>
            <h3 className="mt-1 text-2xl font-black tracking-[-0.05em] text-slate-950">
              Raw export → decision-ready action sheet
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pipeline.map((step, index) => {
              const colors = ["#4285F4", "#EA4335", "#FBBC04", "#34A853"];
              return (
                <span
                  key={step}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700"
                  style={{ boxShadow: `inset 3px 0 0 ${colors[index % colors.length]}` }}
                >
                  {index + 1}. {step}
                </span>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="spin"
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
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
      stroke="currentColor"
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
