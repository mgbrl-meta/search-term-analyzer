"use client";

import type { GoogleOsModel } from "../../../lib/googleOs/types";
import { money, pct, pctChange, x } from "../../../lib/googleOs/format";
import { GoogleOsTable } from "../shared/GoogleOsTable";

export function CampaignsTab({ model }: { model: GoogleOsModel }) {
  return (
    <section className="gos-page">
      <div className="gos-panel">
        <div className="gos-panel-head">
          <div>
            <span>Campaigns</span>
            <h2>Campaign-level diagnosis</h2>
            <p>Sorted by spend. Use this to identify where Google is allocating budget and where efficiency is breaking.</p>
          </div>
        </div>

        <GoogleOsTable
          rows={model.campaigns as unknown as Record<string, unknown>[]}
          columns={[
            { key: "label", label: "Campaign" },
            { key: "campaignType", label: "Type" },
            { key: "campaignStatus", label: "Status" },
            { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
            { key: "spendShare", label: "Spend share", right: true, render: (row) => pct(row.spendShare) },
            { key: "conversionValue", label: "Revenue", right: true, render: (row) => money(row.conversionValue) },
            { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
            { key: "roasDodPct", label: "ROAS DoD", right: true, render: (row) => pctChange(row.roasDodPct) },
            { key: "conversions", label: "Conv.", right: true },
            { key: "cpa", label: "CPA", right: true, render: (row) => money(row.cpa) },
            { key: "cvr", label: "CVR", right: true, render: (row) => pct(row.cvr) },
            { key: "status", label: "Decision" },
            { key: "action", label: "Action" },
          ]}
        />
      </div>
    </section>
  );
}
