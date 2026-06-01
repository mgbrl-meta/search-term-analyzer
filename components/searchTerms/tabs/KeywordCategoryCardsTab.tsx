"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchType, SearchTermModel } from "../../../lib/searchTerms/types";
import { loadAiBrain } from "../../../lib/searchTerms/aiBrain";
import { applyCategories, buildCategoryCards } from "../../../lib/searchTerms/categories";
import { exportRowsCsv } from "../../../lib/searchTerms/exports";
import { int, money, negativeSyntax, pct, x } from "../../../lib/searchTerms/format";
import { Kpi } from "../shared/Kpi";
import { DataTable } from "../shared/DataTable";

export function KeywordCategoryCardsTab({
  model,
  matchType = "exact",
}: {
  model: SearchTermModel;
  matchType?: MatchType;
}) {
  const [openCategory, setOpenCategory] = useState("");
  const [minSpend, setMinSpend] = useState(0);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    function refresh() {
      setVersion((current) => current + 1);
    }

    window.addEventListener("search-term-os-ai-brain-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("search-term-os-ai-brain-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const cards = useMemo(() => {
    const aiBrain = loadAiBrain();
    const rows = applyCategories(model.terms, aiBrain).filter((row) => row.spend >= minSpend);
    return buildCategoryCards(rows);
  }, [model.terms, minSpend, version]);

  function exportCategory(category: string) {
    const card = cards.find((item) => item.category === category);
    if (!card) return;

    exportRowsCsv(
      `${category.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}-keywords.csv`,
      card.terms.map((row) => ({
        Category: row.category,
        Campaign: row.campaign,
        "Ad group": row.adGroup,
        "Search term": row.searchTerm,
        "Negative keyword": negativeSyntax(row.searchTerm, matchType),
        "Match type": matchType,
        Action: row.action,
        Spend: Math.round(row.spend),
        Clicks: Math.round(row.clicks),
        Impressions: Math.round(row.impressions),
        CTR: `${(row.ctr * 100).toFixed(2)}%`,
        Conversions: row.conversions.toFixed(2),
        "Conv. value": Math.round(row.conversionValue),
        ROAS: row.roas.toFixed(2),
        "AI applied": row.aiApplied ? "Y" : "N",
        "AI reason": row.aiReason ?? "",
      }))
    );
  }

  function exportNegatives(category: string) {
    const card = cards.find((item) => item.category === category);
    if (!card) return;

    exportRowsCsv(
      `${category.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}-negatives.csv`,
      card.negativeCandidates.map((row) => ({
        Campaign: row.campaign,
        "Ad group": row.adGroup,
        Keyword: negativeSyntax(
          row.searchTerm,
          row.aiNegativeMatchType && row.aiNegativeMatchType !== "none" ? row.aiNegativeMatchType : matchType
        ),
        "Match type": row.aiNegativeMatchType && row.aiNegativeMatchType !== "none" ? row.aiNegativeMatchType : matchType,
        Reason: row.aiReason || row.action,
        Spend: Math.round(row.spend),
        Clicks: Math.round(row.clicks),
        Conversions: row.conversions.toFixed(2),
      }))
    );
  }

  return (
    <section className="st-panel">
      <div className="st-panel-head">
        <div>
          <span>Keyword Category Cards</span>
          <h2>Dynamic category-level keyword diagnosis</h2>
          <p>Uses AI Brain classification when available, otherwise falls back to deterministic category logic.</p>
        </div>

        <label className="st-filter">
          Minimum spend
          <input
            type="number"
            value={minSpend}
            min={0}
            onChange={(e) => setMinSpend(Number(e.target.value || 0))}
          />
        </label>
      </div>

      <div className="st-category-list">
        {cards.map((card) => {
          const open = openCategory === card.category;

          return (
            <article key={card.category} className="st-category-card">
              <button
                type="button"
                className="st-category-top"
                onClick={() => setOpenCategory(open ? "" : card.category)}
              >
                <div>
                  <h3>{card.category}</h3>
                  <p>
                    {int(card.terms.length)} terms · {money(card.spend)} spend · {pct(card.ctr)} CTR · {x(card.roas)} ROAS
                  </p>
                </div>

                <strong>{open ? "↑" : "↓"}</strong>
              </button>

              <div className="st-kpi-grid">
                <Kpi label="Terms" value={int(card.terms.length)} />
                <Kpi label="Spend" value={money(card.spend)} tone="red" />
                <Kpi label="Clicks" value={int(card.clicks)} />
                <Kpi label="CTR" value={pct(card.ctr)} tone="blue" />
                <Kpi label="Purchases" value={card.conversions.toFixed(2)} />
                <Kpi label="Revenue" value={money(card.conversionValue)} tone={card.conversionValue > 0 ? "green" : "neutral"} />
                <Kpi label="ROAS" value={x(card.roas)} tone={card.roas >= 2.5 ? "green" : "red"} />
                <Kpi label="Negatives" value={int(card.negativeCandidates.length)} tone={card.negativeCandidates.length ? "red" : "green"} />
              </div>

              <p className="st-note">{card.actionSummary}</p>

              {open ? (
                <div className="st-card-open">
                  <div className="st-actions">
                    <button type="button" onClick={() => exportCategory(card.category)}>Export category CSV</button>
                    <button type="button" onClick={() => exportNegatives(card.category)} disabled={!card.negativeCandidates.length}>
                      Export negatives CSV
                    </button>
                  </div>

                  <DataTable
                    rows={card.terms as unknown as Record<string, unknown>[]}
                    columns={[
                      { key: "searchTerm", label: "Search term" },
                      { key: "campaign", label: "Campaign" },
                      { key: "adGroup", label: "Ad group" },
                      { key: "spend", label: "Spend", right: true, render: (row) => money(row.spend) },
                      { key: "clicks", label: "Clicks", right: true, render: (row) => int(row.clicks) },
                      { key: "ctr", label: "CTR", right: true, render: (row) => pct(row.ctr) },
                      { key: "conversions", label: "Conv.", right: true },
                      { key: "conversionValue", label: "Conv. value", right: true, render: (row) => money(row.conversionValue) },
                      { key: "roas", label: "ROAS", right: true, render: (row) => x(row.roas) },
                      { key: "action", label: "Action", render: (row) => `${row.action}${row.aiApplied ? " · AI" : ""}` },
                    ]}
                    empty="No search terms in this category."
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
