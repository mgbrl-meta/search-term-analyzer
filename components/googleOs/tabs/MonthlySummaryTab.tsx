"use client";

import type { GoogleOsModel } from "@/lib/googleOs/types";
import { GoogleOsSummaryHeader } from "../shared/GoogleOsSummaryHeader";
import { GoogleOsMonthlyCharts } from "../shared/GoogleOsMonthlyCharts";

export function MonthlySummaryTab({ model }: { model: GoogleOsModel }) {
  return (
    <section className="gos-page monthly-summary-page">
      <GoogleOsSummaryHeader
        kicker="Monthly Summary"
        title="Monthly Summary"
        description="Lifetime and selected-period Google Ads performance with weekly scale efficiency charts."
        rows={model.rows}
      />

      <GoogleOsMonthlyCharts rows={model.rows} />
    </section>
  );
}
