"use client";

import { useRef, useState } from "react";
import type { AnalyzeResponse } from "@/types/api";
import { analyzeFile } from "@/lib/apiClient";

export function CompactSearchTermUpload({
  onResult,
}: {
  onResult: (res: AnalyzeResponse, fileName: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  async function handleFile(file: File | null) {
    if (!file) return;

    setFileName(file.name);
    setError("");
    setLoading(true);

    try {
      const result = await analyzeFile(file);
      onResult(result, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze search-term report.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="gos-compact-upload">
      <div>
        <span>Manual Upload</span>
        <h2>Search term report</h2>
        <p>
          Upload only the Google Ads search-term report here. Required columns:
          Search term, Cost, Clicks, Impr., Conversions, Conv. value.
        </p>
      </div>

      <label className="gos-compact-upload-button">
        {loading ? "Analyzing..." : "Upload Search Term CSV/XLSX"}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => handleFile(event.target.files?.[0] || null)}
        />
      </label>

      {fileName ? <small className="gos-pill">Selected: {fileName}</small> : null}
      {error ? <small className="gos-pill error">{error}</small> : null}
    </div>
  );
}
