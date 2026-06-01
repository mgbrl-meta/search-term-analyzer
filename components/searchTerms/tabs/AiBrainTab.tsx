"use client";

import { useMemo, useState } from "react";
import type { AiBrainResponse, SearchTermModel } from "../../../lib/searchTerms/types";
import { buildAiBrainPrompt } from "../../../lib/searchTerms/prompt";
import { clearAiBrain, parseAiBrainResponse, saveAiBrain } from "../../../lib/searchTerms/aiBrain";
import { copyText, exportRowsCsv } from "../../../lib/searchTerms/exports";
import { int } from "../../../lib/searchTerms/format";
import { Kpi } from "../shared/Kpi";
import { DataTable } from "../shared/DataTable";

export function AiBrainTab({
  model,
  onApplied,
}: {
  model: SearchTermModel;
  onApplied?: () => void;
}) {
  const [rawResponse, setRawResponse] = useState("");
  const [parsed, setParsed] = useState<AiBrainResponse | null>(model.aiBrain);
  const [error, setError] = useState("");

  const prompt = useMemo(() => buildAiBrainPrompt(model), [model]);

  async function handleCopyPrompt() {
    await copyText(prompt);
    alert("AI Brain prompt copied.");
  }

  function handleApply() {
    if (!rawResponse.trim()) {
      setError("Paste the JSON response from ChatGPT/Claude first.");
      return;
    }

    try {
      const result = parseAiBrainResponse(rawResponse);
      saveAiBrain(result);
      setParsed(result);
      setError("");
      onApplied?.();
    } catch (err) {
      setParsed(null);
      setError(err instanceof Error ? err.message : "Invalid JSON response.");
    }
  }

  function handleClear() {
    clearAiBrain();
    setParsed(null);
    setRawResponse("");
    setError("");
    onApplied?.();
  }

  const categories = parsed?.categories ?? [];
  const negatives = parsed?.negative_candidates ?? [];
  const summary = parsed?.strategic_summary ?? [];

  return (
    <section className="st-panel st-ai">
      <div className="st-panel-head">
        <div>
          <span>Manual AI Brain</span>
          <h2>ChatGPT / Claude workflow without API cost</h2>
          <p>Copy the prompt, paste it into ChatGPT or Claude, then paste the JSON response back here.</p>
        </div>

        <div className="st-actions">
          <button type="button" onClick={handleCopyPrompt}>Copy prompt</button>
          <button type="button" onClick={() => window.open("https://chatgpt.com", "_blank")}>Open ChatGPT</button>
          <button type="button" onClick={() => window.open("https://claude.ai", "_blank")}>Open Claude</button>
          <button type="button" onClick={handleClear}>Clear AI Brain</button>
        </div>
      </div>

      <div className="st-ai-grid">
        <textarea className="st-textarea" readOnly value={prompt} />
        <div>
          <textarea
            className="st-textarea"
            value={rawResponse}
            onChange={(e) => {
              setRawResponse(e.target.value);
              if (error) setError("");
            }}
            placeholder="Paste valid JSON response here..."
          />

          <div className="st-actions st-actions-left">
            <button type="button" onClick={handleApply}>Apply / Validate</button>
          </div>

          {error ? <p className="st-error">{error}</p> : null}
        </div>
      </div>

      {parsed ? (
        <div className="st-ai-output">
          <div className="st-panel-head">
            <div>
              <span>AI Brain Applied</span>
              <h2>{parsed.detected_theme}</h2>
              <p>Open Keyword Category Cards to see AI categories/actions applied where search terms match.</p>
            </div>

            <div className="st-actions">
              <button type="button" onClick={() => exportRowsCsv("ai-brain-categories.csv", categories)}>
                Export categories
              </button>
              <button type="button" onClick={() => exportRowsCsv("ai-negative-candidates.csv", negatives)}>
                Export negatives
              </button>
            </div>
          </div>

          <div className="st-kpi-grid">
            <Kpi label="Categories" value={int(categories.length)} />
            <Kpi label="Negative candidates" value={int(negatives.length)} tone={negatives.length ? "red" : "green"} />
            <Kpi label="Uploaded terms" value={int(model.terms.length)} />
          </div>

          {summary.length ? (
            <div className="st-summary">
              {summary.slice(0, 8).map((line, index) => (
                <p key={index}><strong>{index + 1}.</strong> {line}</p>
              ))}
            </div>
          ) : null}

          <DataTable
            rows={categories as unknown as Record<string, unknown>[]}
            columns={[
              { key: "name", label: "Category" },
              { key: "definition", label: "Definition" },
              { key: "default_action", label: "Default action" },
              { key: "negative_aggressiveness", label: "Negative aggression" },
            ]}
            empty="No AI categories found."
          />

          <DataTable
            rows={negatives as unknown as Record<string, unknown>[]}
            columns={[
              { key: "search_term", label: "Search term" },
              { key: "match_type", label: "Match type" },
              { key: "reason", label: "Reason" },
              { key: "confidence", label: "Confidence", right: true },
            ]}
            empty="No AI negative candidates found."
          />
        </div>
      ) : null}
    </section>
  );
}
