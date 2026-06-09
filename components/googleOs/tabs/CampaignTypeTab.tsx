"use client";

import { useMemo, useState } from "react";
import type { GoogleOsModel } from "@/lib/googleOs/types";
import {
  buildGoogleOsPeriodOptions,
  filterRowsByCampaignType,
  filterRowsByGoogleOsPeriod,
  formatCompactMoney,
  formatPercent,
  formatX,
  getRowsForCampaign,
  groupRowsByAdGroup,
  groupRowsByCampaign,
  type GoogleOsCampaignType,
  type GoogleOsPeriodMode,
} from "@/lib/googleOs/periodToolkit";
import { GoogleOsSummaryHeader } from "../shared/GoogleOsSummaryHeader";

const TYPE_META: Record<GoogleOsCampaignType, { color: string; title: string }> = {
  Search: { color: "#4285F4", title: "Search campaign performance" },
  Shopping: { color: "#34A853", title: "Shopping campaign performance" },
  "Demand Gen": { color: "#FBBC04", title: "Demand Gen campaign performance" },
  Video: { color: "#EA4335", title: "Video campaign performance" },
  Other: { color: "#94A3B8", title: "Other campaign performance" },
};

function metricTone(metric: "roas" | "cpa" | "decision", value: number | string) {
  if (metric === "decision") {
    if (value === "SCALE" || value === "KEEP") return "green";
    if (value === "WATCH" || value === "INVESTIGATE") return "amber";
    return "red";
  }

  if (metric === "roas") {
    if (Number(value) >= 2) return "green";
    if (Number(value) >= 1) return "amber";
    return "red";
  }

  if (metric === "cpa") {
    if (Number(value) <= 400) return "green";
    if (Number(value) <= 800) return "amber";
    return "red";
  }

  return "";
}

export function CampaignTypeTab({
  model,
  type,
}: {
  model: GoogleOsModel;
  type: GoogleOsCampaignType;
}) {
  const [periodMode, setPeriodMode] = useState<GoogleOsPeriodMode>("daily");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [openCampaigns, setOpenCampaigns] = useState<Record<string, boolean>>({});

  const typeMeta = TYPE_META[type] || TYPE_META.Other;

  const baseRows = useMemo(() => {
    return filterRowsByCampaignType(model.rows, type);
  }, [model.rows, type]);

  const periodOptions = useMemo(() => {
    return buildGoogleOsPeriodOptions(baseRows, periodMode);
  }, [baseRows, periodMode]);

  const activePeriod = selectedPeriod || periodOptions[0]?.value || "";

  const periodRows = useMemo(() => {
    return filterRowsByGoogleOsPeriod(baseRows, periodMode, activePeriod);
  }, [baseRows, periodMode, activePeriod]);

  const campaignRows = useMemo(() => {
    return groupRowsByCampaign(periodRows);
  }, [periodRows]);

  function toggleCampaign(campaignKey: string) {
    setOpenCampaigns((current) => ({
      ...current,
      [campaignKey]: !current[campaignKey],
    }));
  }

  return (
    <section className="gos-page campaign-type-main-tab gos-toolkit-campaign-type-tab">
      <GoogleOsSummaryHeader
        kicker={type}
        title={typeMeta.title}
        description={`Selected period summary for ${type} campaigns. Campaign rows below use the same selected period.`}
        baseRows={baseRows}
        periodMode={periodMode}
        selectedPeriod={activePeriod}
        onPeriodModeChange={setPeriodMode}
        onSelectedPeriodChange={setSelectedPeriod}
      />

      <div className="gos-toolkit-campaign-panel">
        <div className="gos-toolkit-campaign-panel-head">
          <div>
            <span>{type}</span>
            <h2>{type} campaign breakdown</h2>
            <p>Rows below are calculated from the same period selected in the summary header above.</p>
          </div>

          <strong>{campaignRows.length} campaigns</strong>
        </div>

        <div className="gos-toolkit-campaign-list">
          {campaignRows.map((campaign) => {
            const isOpen = Boolean(openCampaigns[campaign.campaignKey]);
            const adGroups = isOpen ? groupRowsByAdGroup(periodRows, campaign.campaignKey) : [];

            return (
              <div key={campaign.campaignKey} className="gos-toolkit-campaign-block">
                <button
                  type="button"
                  className="gos-toolkit-campaign-row"
                  onClick={() => toggleCampaign(campaign.campaignKey)}
                >
                  <span className="campaign-name-cell">
                    <b>{isOpen ? "−" : "+"}</b>
                    <i style={{ background: typeMeta.color }} />
                    <span>
                      <strong>{campaign.campaignName}</strong>
                      <small>{campaign.campaignType}{campaign.status ? ` · ${campaign.status}` : ""}</small>
                    </span>
                  </span>

                  <span>
                    <small>Spend</small>
                    <strong className="red">{formatCompactMoney(campaign.spend)}</strong>
                  </span>

                  <span>
                    <small>Revenue</small>
                    <strong className="green">{formatCompactMoney(campaign.revenue)}</strong>
                  </span>

                  <span>
                    <small>ROAS</small>
                    <strong className={metricTone("roas", campaign.roas)}>{formatX(campaign.roas)}</strong>
                  </span>

                  <span>
                    <small>Purch.</small>
                    <strong>{campaign.purchases.toFixed(0)}</strong>
                  </span>

                  <span>
                    <small>CPA</small>
                    <strong className={metricTone("cpa", campaign.cpa)}>{formatCompactMoney(campaign.cpa)}</strong>
                  </span>

                  <span>
                    <small>Share</small>
                    <strong>{formatPercent(campaign.share)}</strong>
                  </span>

                  <span>
                    <small>CTR</small>
                    <strong>{formatPercent(campaign.ctr)}</strong>
                  </span>

                  <span>
                    <small>CVR</small>
                    <strong>{formatPercent(campaign.cvr)}</strong>
                  </span>

                  <span>
                    <small>Decision</small>
                    <strong className={metricTone("decision", campaign.decision)}>{campaign.decision}</strong>
                  </span>
                </button>

                {isOpen ? (
                  <div className="gos-toolkit-adgroup-table">
                    <div className="gos-toolkit-adgroup-title">
                      <strong>Ad groups inside this campaign</strong>
                      <small>{adGroups.length} ad groups</small>
                    </div>

                    <div className="gos-toolkit-adgroup-header">
                      <span>Ad Group</span>
                      <span>Status</span>
                      <span>Spend</span>
                      <span>Revenue</span>
                      <span>ROAS</span>
                      <span>Purch.</span>
                      <span>CPA</span>
                      <span>CTR</span>
                      <span>CVR</span>
                      <span>CPC</span>
                    </div>

                    {adGroups.map((adGroup) => (
                      <div key={adGroup.adGroupKey} className="gos-toolkit-adgroup-row">
                        <span>{adGroup.adGroupName}</span>
                        <span>{adGroup.status || "—"}</span>
                        <span className="red">{formatCompactMoney(adGroup.spend)}</span>
                        <span className="green">{formatCompactMoney(adGroup.revenue)}</span>
                        <span className={metricTone("roas", adGroup.roas)}>{formatX(adGroup.roas)}</span>
                        <span>{adGroup.purchases.toFixed(0)}</span>
                        <span className={metricTone("cpa", adGroup.cpa)}>{formatCompactMoney(adGroup.cpa)}</span>
                        <span>{formatPercent(adGroup.ctr)}</span>
                        <span>{formatPercent(adGroup.cvr)}</span>
                        <span>{formatCompactMoney(adGroup.cpc)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {!campaignRows.length ? (
            <div className="gos-toolkit-empty-state">
              No {type} campaign data found for this selected period.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
