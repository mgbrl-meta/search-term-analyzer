"use client";

import type { GoogleOsModel } from "../../../lib/googleOs/types";
import { money, pct, pctChange, x } from "../../../lib/googleOs/format";
import { GoogleOsTable } from "../shared/GoogleOsTable";

export function AdGroupsTab({ model }: { model: GoogleOsModel }) {
  return (
    <section className="gos-page">
      <div className="gos-panel">
        <div className="gos-panel-head">
          <div>
            <span>Ad Groups</span>
            <h2>Ad group / product diagnosis</h2>
            <p>Shopping and Search performance at the level where bid and pause decisions are made.</p>
          </div>
        </div>

        <GoogleOsTable
          rows={model.adGroups as unknown as Record<string, unknown>[]}
          columns={[
            { key: "campaign", label: "Campaign" },
            { key: "label", label: "Ad group" },
            { key: "adGroupStatus", label: "State" },
            { key: "cost", label: "Spend", right: true, render: (row) => money(row.cost) },
            { key: "spendShare", label: "Spend share", right: true, render: (row) => pct(row.spendShare) },
            { key: "conversionValue", label: "Revenue", right: true, render: (row) => money(row.conversionValue) },
            { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
            { key: "conversions", label: "Conv.", right: true },
            { key: "cpa", label: "CPA", right: true, render: (row) => money(row.cpa) },
            { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
            { key: "cvr", label: "CVR", right: true, render: (row) => pct(row.cvr) },
            { key: "avgCpc", label: "Avg CPC", right: true, render: (row) => money(row.avgCpc) },
            { key: "costDodPct", label: "Spend DoD", right: true, render: (row) => pctChange(row.costDodPct) },
            { key: "roasDodPct", label: "ROAS DoD", right: true, render: (row) => pctChange(row.roasDodPct) },
            { key: "status", label: "Decision" },
            { key: "action", label: "Action" },
          ]}
        />
      </div>
    </section>
  );
}
