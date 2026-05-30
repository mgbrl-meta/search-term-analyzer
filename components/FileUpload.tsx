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

const cards = [
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

function UploadIcon({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <svg className="sta-spin" width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M21 12a9 9 0 1 1-6.2-8.6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 8 12 3 7 8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3v12"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <div className="sta-google-mark" aria-hidden="true">
      <span style={{ color: GOOGLE.blue }}>G</span>
    </div>
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
    <div className="sta-home">
      <style jsx global>{`
        :root,
        html[data-theme="light"] {
          --sta-bg: #f8fafc;
          --sta-bg-soft: rgba(255, 255, 255, 0.78);
          --sta-surface: rgba(255, 255, 255, 0.84);
          --sta-surface-strong: #ffffff;
          --sta-border: rgba(15, 23, 42, 0.1);
          --sta-border-strong: rgba(15, 23, 42, 0.16);
          --sta-text: #0f172a;
          --sta-text-soft: #475569;
          --sta-muted: #94a3b8;
          --sta-grid: rgba(15, 23, 42, 0.045);
          --sta-shadow: 0 22px 60px rgba(15, 23, 42, 0.08);
          --sta-card-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        html[data-theme="dark"] {
          --sta-bg: #050816;
          --sta-bg-soft: rgba(15, 23, 42, 0.72);
          --sta-surface: rgba(15, 23, 42, 0.78);
          --sta-surface-strong: rgba(30, 41, 59, 0.9);
          --sta-border: rgba(148, 163, 184, 0.18);
          --sta-border-strong: rgba(226, 232, 240, 0.24);
          --sta-text: #f8fafc;
          --sta-text-soft: #cbd5e1;
          --sta-muted: #94a3b8;
          --sta-grid: rgba(148, 163, 184, 0.075);
          --sta-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
          --sta-card-shadow: 0 16px 44px rgba(0, 0, 0, 0.24);
        }

        body {
          font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          background: var(--sta-bg);
        }

        .font-serif,
        .display {
          font-family: Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        }

        .sta-theme-toggle {
          display: inline-flex;
          height: 38px;
          width: 38px;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          border: 1px solid var(--sta-border);
          background: var(--sta-surface);
          color: var(--sta-text);
          box-shadow: var(--sta-card-shadow);
          backdrop-filter: blur(18px);
          transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
        }

        .sta-theme-toggle:hover {
          transform: translateY(-1px);
          border-color: var(--sta-border-strong);
          background: var(--sta-surface-strong);
        }

        .sta-home {
          position: relative;
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 24px 48px;
          color: var(--sta-text);
          overflow: hidden;
        }

        .sta-home::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          background:
            radial-gradient(circle at 18% 12%, rgba(66, 133, 244, 0.14), transparent 30%),
            radial-gradient(circle at 72% 16%, rgba(52, 168, 83, 0.12), transparent 28%),
            radial-gradient(circle at 48% 72%, rgba(251, 188, 4, 0.1), transparent 26%),
            radial-gradient(circle at 90% 62%, rgba(234, 67, 53, 0.09), transparent 25%);
          filter: blur(10px);
        }

        .sta-home::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background:
            linear-gradient(to right, var(--sta-grid) 1px, transparent 1px),
            linear-gradient(to bottom, var(--sta-grid) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(to bottom, black, transparent 90%);
        }

        .sta-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 0.92fr);
          gap: 48px;
          align-items: center;
          padding: 48px 0 44px;
        }

        .sta-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--sta-border);
          background: var(--sta-surface);
          color: var(--sta-text-soft);
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          box-shadow: var(--sta-card-shadow);
          backdrop-filter: blur(18px);
        }

        .sta-dot {
          height: 8px;
          width: 8px;
          border-radius: 999px;
          background: #34a853;
          box-shadow: 0 0 14px rgba(52, 168, 83, 0.78);
        }

        .sta-os-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 28px;
          color: var(--sta-muted);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .sta-google-mark {
          display: grid;
          place-items: center;
          height: 34px;
          width: 34px;
          border-radius: 13px;
          border: 1px solid var(--sta-border);
          background: var(--sta-surface-strong);
          box-shadow: var(--sta-card-shadow);
          font-size: 17px;
          font-weight: 600;
        }

        .sta-title {
          margin-top: 26px;
          max-width: 760px;
          font-size: clamp(42px, 6vw, 66px);
          line-height: 0.98;
          letter-spacing: -0.058em;
          font-weight: 600;
          color: var(--sta-text);
        }

        .sta-title span {
          display: block;
          font-weight: 500;
          background: linear-gradient(90deg, #4285f4, #34a853 48%, #fbbc04 78%, #ea4335);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .sta-subtitle {
          margin-top: 22px;
          max-width: 650px;
          color: var(--sta-text-soft);
          font-size: 15px;
          line-height: 1.75;
          font-weight: 400;
        }

        .sta-signal-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 28px;
          max-width: 650px;
        }

        .sta-signal {
          border: 1px solid var(--sta-border);
          background: var(--sta-surface);
          border-radius: 18px;
          padding: 13px 15px;
          box-shadow: var(--sta-card-shadow);
          backdrop-filter: blur(18px);
        }

        .sta-signal strong {
          display: block;
          font-size: 14px;
          line-height: 1;
          letter-spacing: -0.02em;
          font-weight: 600;
        }

        .sta-signal span {
          display: block;
          margin-top: 7px;
          color: var(--sta-muted);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .sta-upload-shell {
          position: relative;
        }

        .sta-upload-shell::before {
          content: "";
          position: absolute;
          inset: -14px;
          z-index: -1;
          border-radius: 34px;
          background: conic-gradient(
            from 180deg,
            rgba(66, 133, 244, 0.2),
            rgba(52, 168, 83, 0.17),
            rgba(251, 188, 4, 0.16),
            rgba(234, 67, 53, 0.14),
            rgba(66, 133, 244, 0.2)
          );
          filter: blur(24px);
          opacity: 0.9;
        }

        .sta-upload-card {
          border: 1px solid var(--sta-border);
          background: var(--sta-surface);
          border-radius: 30px;
          padding: 12px;
          box-shadow: var(--sta-shadow);
          backdrop-filter: blur(24px);
        }

        .sta-dropzone {
          position: relative;
          overflow: hidden;
          border: 1px solid var(--sta-border);
          background: var(--sta-bg-soft);
          border-radius: 24px;
          padding: 26px;
          cursor: pointer;
          transition: border-color 160ms ease, background 160ms ease, opacity 160ms ease;
        }

        .sta-dropzone:hover,
        .sta-dropzone.dragging {
          border-color: rgba(66, 133, 244, 0.58);
          background: rgba(66, 133, 244, 0.08);
        }

        .sta-dropzone.loading {
          cursor: progress;
          opacity: 0.78;
          pointer-events: none;
        }

        .sta-upload-head {
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }

        .sta-upload-icon {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          height: 50px;
          width: 50px;
          border-radius: 18px;
          border: 1px solid rgba(66, 133, 244, 0.24);
          background: rgba(66, 133, 244, 0.1);
          color: #4285f4;
          box-shadow: 0 12px 28px rgba(66, 133, 244, 0.15);
        }

        .sta-upload-copy {
          min-width: 0;
          flex: 1;
        }

        .sta-upload-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .sta-upload-title {
          color: var(--sta-text);
          font-size: 22px;
          line-height: 1.1;
          letter-spacing: -0.035em;
          font-weight: 600;
        }

        .sta-upload-help {
          margin-top: 8px;
          color: var(--sta-text-soft);
          font-size: 14px;
          line-height: 1.55;
        }

        .sta-file-type {
          flex: 0 0 auto;
          border: 1px solid var(--sta-border);
          background: var(--sta-surface-strong);
          color: var(--sta-text-soft);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .sta-file-status,
        .sta-file-empty,
        .sta-loading,
        .sta-error {
          margin-top: 24px;
          border-radius: 18px;
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 500;
        }

        .sta-file-empty {
          border: 1px dashed var(--sta-border-strong);
          background: var(--sta-surface);
          color: var(--sta-text-soft);
          text-align: center;
        }

        .sta-file-status {
          border: 1px solid rgba(52, 168, 83, 0.28);
          background: rgba(52, 168, 83, 0.1);
          color: #34a853;
        }

        .sta-loading {
          border: 1px solid rgba(66, 133, 244, 0.28);
          background: rgba(66, 133, 244, 0.1);
          color: #4285f4;
        }

        .sta-error {
          border: 1px solid rgba(234, 67, 53, 0.28);
          background: rgba(234, 67, 53, 0.1);
          color: #ea4335;
        }

        .sta-required {
          margin-top: 22px;
          border: 1px solid var(--sta-border);
          background: var(--sta-surface);
          border-radius: 20px;
          padding: 16px;
        }

        .sta-required-title {
          color: var(--sta-muted);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .sta-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 13px;
        }

        .sta-chip {
          border: 1px solid var(--sta-border);
          background: var(--sta-surface-strong);
          color: var(--sta-text-soft);
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 500;
        }

        .sta-card-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
        }

        .sta-info-card {
          border: 1px solid var(--sta-border);
          background: var(--sta-surface);
          border-radius: 22px;
          padding: 18px;
          box-shadow: var(--sta-card-shadow);
          backdrop-filter: blur(20px);
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .sta-info-card:hover {
          transform: translateY(-2px);
          border-color: var(--sta-border-strong);
          background: var(--sta-surface-strong);
        }

        .sta-info-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
        }

        .sta-tag {
          border: 1px solid var(--sta-border);
          background: var(--sta-surface-strong);
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .sta-mini-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
        }

        .sta-card-title {
          color: var(--sta-text);
          font-size: 16px;
          line-height: 1.2;
          letter-spacing: -0.025em;
          font-weight: 600;
        }

        .sta-card-body {
          margin-top: 10px;
          color: var(--sta-text-soft);
          font-size: 14px;
          line-height: 1.5;
          font-weight: 400;
        }

        .sta-pipeline {
          margin-top: 24px;
          border: 1px solid var(--sta-border);
          background: var(--sta-surface);
          border-radius: 26px;
          padding: 20px;
          box-shadow: var(--sta-card-shadow);
          backdrop-filter: blur(20px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .sta-pipeline-label {
          color: #4285f4;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .sta-pipeline-title {
          margin-top: 8px;
          color: var(--sta-text);
          font-size: 24px;
          line-height: 1.12;
          letter-spacing: -0.04em;
          font-weight: 600;
        }

        .sta-pipeline-steps {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .sta-step {
          border: 1px solid var(--sta-border);
          background: var(--sta-surface-strong);
          color: var(--sta-text-soft);
          border-radius: 999px;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .sta-spin {
          animation: sta-spin 0.8s linear infinite;
        }

        @keyframes sta-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1060px) {
          .sta-hero {
            grid-template-columns: 1fr;
            padding-top: 24px;
          }

          .sta-card-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .sta-pipeline {
            align-items: flex-start;
            flex-direction: column;
          }

          .sta-pipeline-steps {
            justify-content: flex-start;
          }
        }

        @media (max-width: 720px) {
          .sta-home {
            padding: 20px 16px 36px;
          }

          .sta-title {
            font-size: 42px;
          }

          .sta-signal-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sta-card-grid {
            grid-template-columns: 1fr;
          }

          .sta-upload-head {
            flex-direction: column;
          }

          .sta-upload-top {
            flex-direction: column;
          }
        }
      `}</style>

      <section className="sta-hero">
        <div>
          <div className="sta-eyebrow">
            <span className="sta-dot" />
            Google Ads intelligence engine
          </div>

          <div className="sta-os-row">
            <GoogleMark />
            <span>Search term operating system</span>
          </div>

          <h1 className="sta-title">
            Search Term
            <span>Command Brain</span>
          </h1>

          <p className="sta-subtitle">
            Upload a Google Ads search-term export. The engine turns raw queries into
            spend-waster cuts, negative keywords, n-gram waste, PDP issues, scale signals,
            and true non-brand ROAS actions.
          </p>

          <div className="sta-signal-grid">
            {[
              ["ROAS", "mapped", GOOGLE.blue],
              ["0-spend", "ignored", GOOGLE.green],
              ["Overlap", "guard", GOOGLE.yellow],
              ["Actions", "exportable", GOOGLE.red],
            ].map(([top, bottom, color]) => (
              <div className="sta-signal" key={top}>
                <strong style={{ color }}>{top}</strong>
                <span>{bottom}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sta-upload-shell">
          <div className="sta-upload-card">
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
                "sta-dropzone",
                dragging ? "dragging" : "",
                loading ? "loading" : "",
              ].join(" ")}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                hidden
                onChange={onChange}
              />

              <div className="sta-upload-head">
                <div className="sta-upload-icon">
                  <UploadIcon loading={loading} />
                </div>

                <div className="sta-upload-copy">
                  <div className="sta-upload-top">
                    <div>
                      <h2 className="sta-upload-title">
                        {loading ? "Analyzing report" : "Upload report"}
                      </h2>
                      <p className="sta-upload-help">
                        {loading
                          ? "Building action tabs and export-ready recommendations."
                          : "Drop your Google Ads report or click to browse."}
                      </p>
                    </div>

                    <span className="sta-file-type">CSV / XLSX</span>
                  </div>

                  {selectedFile ? (
                    <div className="sta-file-status">Selected: {selectedFile}</div>
                  ) : (
                    <div className="sta-file-empty">Drag file here to start analysis</div>
                  )}

                  {loading ? (
                    <div className="sta-loading">
                      Uploading and analyzing. Large exports may take a few seconds.
                    </div>
                  ) : null}

                  {error ? <div className="sta-error">{error}</div> : null}

                  <div className="sta-required">
                    <div className="sta-required-title">Required signal columns</div>
                    <div className="sta-chip-row">
                      {requiredColumns.map((col, index) => {
                        const colors = [GOOGLE.blue, GOOGLE.red, GOOGLE.yellow, GOOGLE.green];
                        return (
                          <span
                            key={col}
                            className="sta-chip"
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

      <section className="sta-card-grid">
        {cards.map((card) => (
          <div className="sta-info-card" key={card.title}>
            <div className="sta-info-top">
              <span className="sta-tag" style={{ color: card.color }}>
                {card.tag}
              </span>
              <span className="sta-mini-dot" style={{ backgroundColor: card.color }} />
            </div>
            <h3 className="sta-card-title">{card.title}</h3>
            <p className="sta-card-body">{card.body}</p>
          </div>
        ))}
      </section>

      <section className="sta-pipeline">
        <div>
          <div className="sta-pipeline-label">Analysis pipeline</div>
          <h3 className="sta-pipeline-title">
            Raw export → decision-ready action sheet
          </h3>
        </div>

        <div className="sta-pipeline-steps">
          {pipeline.map((step, index) => {
            const colors = [GOOGLE.blue, GOOGLE.red, GOOGLE.yellow, GOOGLE.green];
            return (
              <span
                key={step}
                className="sta-step"
                style={{ boxShadow: `inset 3px 0 0 ${colors[index % colors.length]}` }}
              >
                {index + 1}. {step}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
