"use client";

import { useMemo } from "react";
import type { GoogleOsModel } from "../../../lib/googleOs/types";
import { buildGoogleOsMarkdownReport } from "../../../lib/googleOs/operatorReport";

export function AiOperatorReportTab({ model }: { model: GoogleOsModel }) {
  const report = useMemo(() => buildGoogleOsMarkdownReport(model), [model]);

  async function copyReport() {
    await navigator.clipboard.writeText(report);
    alert("Google OS report copied.");
  }

  return (
    <section className="gos-page">
      <div className="gos-panel">
        <div className="gos-panel-head">
          <div>
            <span>AI Operator Report</span>
            <h2>Copy-ready Google Ads action report</h2>
            <p>This is the deterministic report. Later we will add AI Brain narrative on top.</p>
          </div>

          <div className="gos-actions">
            <button type="button" onClick={copyReport}>Copy report</button>
          </div>
        </div>

        <pre className="gos-report">{report}</pre>
      </div>
    </section>
  );
}
