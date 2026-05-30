"use client";

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react";
import type { AnalyzeResponse } from "@/types/api";
import { analyzeFile } from "@/lib/apiClient";

interface Props {
  onResult: (res: AnalyzeResponse, fileName: string) => void;
}

const ACCEPTED = [".csv", ".xlsx", ".xls"];

const GOOGLE = {
  blue: "#4285F4",
  red: "#EA4335",
  yellow: "#FBBC04",
  green: "#34A853",
};

const intelligenceCards = [
  {
    title: "Spend wasters",
    body: "Significant terms and patterns spending below break-even.",
    tag: "Cut",
    color: GOOGLE.red,
  },
  {
    title: "Negative keywords",
    body: "Exact, phrase, and broad suggestions with overlap protection.",
    tag: "Block",
    color: GOOGLE.blue,
  },
  {
    title: "N-gram waste",
    body: "Repeated phrases creating inefficient spend across many queries.",
    tag: "Detect",
    color: GOOGLE.yellow,
  },
  {
    title: "PDP issues",
    body: "High-click intent failing after the click, separated from negatives.",
    tag: "Fix",
    color: GOOGLE.green,
  },
  {
    title: "Scale signals",
    body: "Profitable significant terms to isolate, feed, or scale.",
    tag: "Scale",
    color: GOOGLE.blue,
  },
  {
    title: "True ROAS",
    body: "Brand and non-brand split for real acquisition efficiency.",
    tag: "Split",
    color: GOOGLE.red,
  },
];

const requiredColumns = [
  "Search term",
  "Clicks",
  "Impr.",
  "Cost",
  "Conversions",
  "Conv. value",
];

const pipeline = ["Parse", "Clean", "Filter", "Classify", "Recommend", "Export"];

function isAccepted(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED.some((ext) => lower.endsWith(ext));
}

function GoogleMark() {
  return (
    <div className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm">
      <span className="text-lg font-medium tracking-tight">
        <span style={{ color: GOOGLE.blue }}>G</span>
      </span>
    </div>
  );
}

function UploadIcon({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <svg
        className="animate-spin"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M21 12a9 9 0 1 1-6.2-8.6" />
      </svg>
    );
  }

  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8 12 3 7 8" />
      <path d="M12 3v12" />
    </svg>
  );
}

export default function FileUpload({ onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState("");
  const [error, setError] = useState<string | null>(null);

  const process = useCallback(
    async (file: File) => {
      setError(null);

      if (!isAccepted(file.name)) {
        setError("Please upload a CSV or XLSX file exported from Google Ads.");
        return;
      }

      setSelectedFile(file.name);
      setLoading(true);

      try {
        const result = await analyzeFile(file);
        onResult(result, file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to analyze file.");
      } finally {
        setLoading(false);
      }
    },
    [onResult]
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      if (loading) return;

      const file = event.dataTransfer.files?.[0];
      if (file) process(file);
    },
    [loading, process]
  );

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) process(file);
      event.target.value = "";
    },
    [process]
  );

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-8 font-sans sm:px-6 lg:px-8">
      <style jsx global>{`
        body {
          font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }

        .font-serif,
        .display {
          font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 top-0 mx-auto h-[520px] max-w-6xl rounded-full bg-[radial-gradient(circle_at_20%_20%,rgba(66,133,244,0.10),transparent_28%),radial-gradient(circle_at_70%_25%,rgba(52,168,83,0.10),transparent_28%),radial-gradient(circle_at_50%_70%,rgba(251,188,4,0.10),transparent_26%),radial-gradient(circle_at_90%_60%,rgba(234,67,53,0.08),transparent_25%)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <section className="grid items-center gap-8 py-6 lg:grid-cols-[1fr_0.92fr] lg:py-12">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GOOGLE.green }} />
            Google Ads intelligence engine
          </div>

          <div className="mb-5 flex items-center gap-3">
            <GoogleMark />
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Search term operating system
            </span>
          </div>

          <h1 className="max-w-3xl text-[44px] font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-[58px] lg:text-[64px]">
            Search Term
            <span className="block font-medium">
              Command Brain
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] font-normal leading-7 text-slate-600">
            Upload a Google Ads search-term export. The engine turns raw queries into
            spend-waster cuts, negative keywords, n-gram waste, PDP issues, scale signals,
            and true non-brand ROAS actions.
          </p>

          <div className="mt-7 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["ROAS", "mapped", GOOGLE.blue],
              ["0-spend", "ignored", GOOGLE.green],
              ["Overlap", "guard", GOOGLE.yellow],
              ["Actions", "exportable", GOOGLE.red],
            ].map(([top, bottom, color]) => (
              <div
                key={top}
                className="rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-3 shadow-sm backdrop-blur"
              >
                <div className="text-[14px] font-semibold tracking-[-0.02em]" style={{ color }}>
                  {top}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {bottom}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-3 rounded-[2rem] bg-[conic-gradient(from_180deg,rgba(66,133,244,0.18),rgba(52,168,83,0.16),rgba(251,188,4,0.16),rgba(234,67,53,0.14),rgba(66,133,244,0.18))] blur-2xl" />

          <div className="relative rounded-[1.75rem] border border-slate-200 bg-white/80 p-3 shadow-xl shadow-slate-950/5 backdrop-blur-xl">
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
                "relative overflow-hidden rounded-[1.45rem] border p-6 transition",
                dragging
                  ? "border-[#4285F4] bg-[#4285F4]/8"
                  : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white",
                loading ? "pointer-events-none opacity-75" : "cursor-pointer",
              ].join(" ")}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onChange}
              />

              <div className="flex items-start gap-4">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border bg-white shadow-sm"
                  style={{
                    borderColor: "rgba(66,133,244,0.22)",
                    color: GOOGLE.blue,
                  }}
                >
                  <UploadIcon loading={loading} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-[22px] font-semibold tracking-[-0.035em] text-slate-950">
                        {loading ? "Analyzing report" : "Upload report"}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {loading
                          ? "Building action tabs and export-ready recommendations."
                          : "Drop your Google Ads report or click to browse."}
                      </p>
                    </div>

                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      CSV / XLSX
                    </span>
                  </div>

                  <div className="mt-6">
                    {selectedFile ? (
                      <div className="rounded-2xl border px-4 py-3 text-sm font-medium"
                        style={{
                          borderColor: "rgba(52,168,83,0.22)",
                          backgroundColor: "rgba(52,168,83,0.08)",
                          color: "#137333",
                        }}
                      >
                        Selected: {selectedFile}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-center text-sm font-medium text-slate-500">
                        Drag file here to start analysis
                      </div>
                    )}

                    {loading ? (
                      <div
                        className="mt-3 rounded-2xl border px-4 py-3 text-sm font-medium"
                        style={{
                          borderColor: "rgba(66,133,244,0.22)",
                          backgroundColor: "rgba(66,133,244,0.08)",
                          color: "#1967D2",
                        }}
                      >
                        Uploading and analyzing. Large exports may take a few seconds.
                      </div>
                    ) : null}

                    {error ? (
                      <div
                        className="mt-3 rounded-2xl border px-4 py-3 text-sm font-medium"
                        style={{
                          borderColor: "rgba(234,67,53,0.25)",
                          backgroundColor: "rgba(234,67,53,0.08)",
                          color: "#C5221F",
                        }}
                      >
                        {error}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Required signal columns
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {requiredColumns.map((col, index) => {
                        const colors = [GOOGLE.blue, GOOGLE.red, GOOGLE.yellow, GOOGLE.green];
                        return (
                          <span
                            key={col}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
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
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {intelligenceCards.map((card) => (
          <div
            key={card.title}
            className="group rounded-3xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-slate-950/5"
          >
            <div className="mb-5 flex items-center justify-between">
              <span
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: card.color }}
              >
                {card.tag}
              </span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: card.color }} />
            </div>

            <h3 className="text-[16px] font-semibold leading-tight tracking-[-0.025em] text-slate-950">
              {card.title}
            </h3>
            <p className="mt-2 text-sm font-normal leading-5 text-slate-500">
              {card.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: GOOGLE.blue }}>
              Analysis pipeline
            </p>
            <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-slate-950">
              Raw export → decision-ready action sheet
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pipeline.map((step, index) => {
              const colors = [GOOGLE.blue, GOOGLE.red, GOOGLE.yellow, GOOGLE.green];
              return (
                <span
                  key={step}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
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
