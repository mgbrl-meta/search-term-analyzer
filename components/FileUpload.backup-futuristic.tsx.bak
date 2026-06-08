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
    body: "Find search terms and themes burning budget below break-even ROAS.",
    tag: "Cut waste",
  },
  {
    title: "Negative Keyword Brain",
    body: "Exact, phrase, and broad negative recommendations with overlap guard.",
    tag: "Stop leakage",
  },
  {
    title: "N-Gram Waste",
    body: "Detect repeated bad phrases across hundreds of search terms.",
    tag: "Theme cuts",
  },
  {
    title: "PDP / Offer Issues",
    body: "Separate bad keywords from high-interest terms failing after the click.",
    tag: "Fix funnel",
  },
  {
    title: "Scale Opportunities",
    body: "Surface profitable significant terms worth isolating or scaling.",
    tag: "Scale winners",
  },
  {
    title: "Brand vs Non-Brand",
    body: "Separate brand harvesting from true acquisition efficiency.",
    tag: "True ROAS",
  },
];

const pipeline = [
  "Parse",
  "Clean",
  "Ignore zero-spend",
  "Classify intent",
  "Detect waste",
  "Export actions",
];

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
      // Keep upload UI resilient even if one optional handler fails.
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
      setLocalError("Please upload a CSV or XLSX file exported from Google Ads.");
      return;
    }

    setLocalError(null);
    setSelectedFile(file);
    callUploadHandler(props, file);
  }

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute right-10 top-36 h-[320px] w-[320px] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-[280px] w-[280px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <section className="grid items-center gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Operator-grade Google Shopping intelligence
          </div>

          <h1 className="max-w-4xl font-serif text-5xl leading-[0.95] tracking-tight text-[color:var(--foreground)] sm:text-6xl lg:text-7xl">
            Google Shopping Search Term Brain
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--muted-foreground)] sm:text-lg">
            Upload one Google Ads search-term report and get a prioritized action plan:
            spend wasters, negative keywords, n-gram waste, PDP issues, scale opportunities,
            and brand vs non-brand efficiency.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              "Revenue / ROAS mapped",
              "Zero-spend rows ignored",
              "Negative overlap guard",
              "Exportable action sheet",
            ].map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)] shadow-sm backdrop-blur"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-4 shadow-2xl shadow-black/5 backdrop-blur-xl">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                inputRef.current?.click();
              }
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
              "group relative overflow-hidden rounded-[1.6rem] border border-dashed p-7 transition-all sm:p-8",
              dragActive
                ? "border-blue-500 bg-blue-500/10"
                : "border-[color:var(--border)] bg-[color:var(--background)] hover:border-blue-500/50 hover:bg-blue-500/5",
            ].join(" ")}
          >
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.14),transparent_35%)]" />

            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-600 shadow-sm transition group-hover:scale-105">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 16V4M12 4L7 9M12 4L17 9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M20 16.5V18.5C20 19.3284 19.3284 20 18.5 20H5.5C4.67157 20 4 19.3284 4 18.5V16.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="mt-5 text-center">
              <h2 className="font-serif text-2xl text-[color:var(--foreground)]">
                Upload search-term report
              </h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                Drag & drop your Google Ads CSV/XLSX here, or click to browse.
              </p>

              {selectedFile ? (
                <div className="mx-auto mt-4 max-w-md rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Selected: {selectedFile.name}
                </div>
              ) : null}

              {isLoading ? (
                <div className="mx-auto mt-4 max-w-md rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-700">
                  Analyzing report and building action brain…
                </div>
              ) : null}

              {error ? (
                <div className="mx-auto mt-4 max-w-md rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-left text-sm font-medium text-red-600">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                Recommended columns
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {requiredColumns.map((col) => (
                  <span
                    key={col}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)]"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {brainCards.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--panel)] p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="mb-3 inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-600">
              {card.tag}
            </div>
            <h3 className="font-serif text-lg leading-tight text-[color:var(--foreground)]">
              {card.title}
            </h3>
            <p className="mt-2 text-sm leading-5 text-[color:var(--muted-foreground)]">
              {card.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              Analysis pipeline
            </p>
            <h3 className="mt-1 font-serif text-2xl text-[color:var(--foreground)]">
              From raw export to operator action sheet
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pipeline.map((step, index) => (
              <React.Fragment key={step}>
                <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]">
                  {index + 1}. {step}
                </span>
                {index < pipeline.length - 1 ? (
                  <span className="hidden text-[color:var(--muted-foreground)] sm:inline">→</span>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
