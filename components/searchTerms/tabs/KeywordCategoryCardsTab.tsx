"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchType, SearchTermModel, SearchTermRow } from "../../../lib/searchTerms/types";
import { loadAiBrain } from "../../../lib/searchTerms/aiBrain";
import { applyCategories, buildCategoryCards } from "../../../lib/searchTerms/categories";
import { exportRowsCsv } from "../../../lib/searchTerms/exports";
import { int, money, negativeSyntax, normalizeTerm, pct, x } from "../../../lib/searchTerms/format";

type SortKey =
  | "searchTerm"
  | "spend"
  | "impressions"
  | "costPerImpression"
  | "ctr"
  | "conversions"
  | "conversionValue"
  | "roas"
  | "clicks";

type SortDir = "asc" | "desc";

type UiCategoryCard = {
  category: string;
  verdict: string;
  color: string;
  terms: SearchTermRow[];
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  negativeCandidates: SearchTermRow[];
};

const COLORS = [
  "#3a7bd5",
  "#d4604f",
  "#9b8cff",
  "#c98a2b",
  "#2f9e6f",
  "#ff8a4d",
  "#7d8a9c",
  "#14b8a6",
  "#a855f7",
  "#ef4444",
];

function actionTag(actionInput: unknown) {
  const action = String(actionInput || "").toUpperCase();

  if (action.includes("SCALE")) return { label: "SCALE", cls: "stkc-tag-scale" };
  if (action.includes("KEEP")) return { label: "KEEP", cls: "stkc-tag-keep" };
  if (action.includes("WATCH") || action.includes("PDP")) return { label: "WATCH", cls: "stkc-tag-watch" };
  if (action.includes("INVESTIGATE")) return { label: "INVESTIGATE", cls: "stkc-tag-watch" };
  if (action.includes("CONTENT")) return { label: "CONTENT", cls: "stkc-tag-watch" };

  return { label: "NEGATIVE", cls: "stkc-tag-neg" };
}

function costPerImpression(row: SearchTermRow) {
  return row.impressions > 0 ? row.spend / row.impressions : 0;
}

function getSortValue(row: SearchTermRow, key: SortKey) {
  if (key === "searchTerm") return normalizeTerm(row.searchTerm);
  if (key === "costPerImpression") return costPerImpression(row);
  return Number(row[key] || 0);
}

function sortRows(rows: SearchTermRow[], key: SortKey, dir: SortDir) {
  return rows.slice().sort((a, b) => {
    const av = getSortValue(a, key);
    const bv = getSortValue(b, key);

    let result = 0;

    if (typeof av === "string" || typeof bv === "string") {
      result = String(av).localeCompare(String(bv));
    } else {
      result = Number(av) - Number(bv);
    }

    return dir === "asc" ? result : -result;
  });
}

function buildVerdictFromAi(category: string, model: SearchTermModel) {
  const aiCategory = model.aiBrain?.categories?.find(
    (item) => normalizeTerm(item.name) === normalizeTerm(category)
  );

  return (
    aiCategory?.operator_note ||
    aiCategory?.default_action ||
    aiCategory?.definition ||
    "Review this category before taking action."
  );
}

function buildUiCards(model: SearchTermModel): UiCategoryCard[] {
  const aiBrain = loadAiBrain() || model.aiBrain;

  const rows = applyCategories(model.terms, aiBrain);
  const baseCards = buildCategoryCards(rows);

  return baseCards.map((card, index) => ({
    category: card.category,
    verdict: buildVerdictFromAi(card.category, { ...model, aiBrain }),
    color: COLORS[index % COLORS.length],
    terms: card.terms,
    spend: card.spend,
    clicks: card.clicks,
    impressions: card.impressions,
    ctr: card.ctr,
    conversions: card.conversions,
    conversionValue: card.conversionValue,
    roas: card.roas,
    negativeCandidates: card.negativeCandidates,
  }));
}

export function KeywordCategoryCardsTab({
  model,
  matchType = "exact",
}: {
  model: SearchTermModel;
  matchType?: MatchType;
}) {
  const [openCategory, setOpenCategory] = useState("");
  const [minSpend, setMinSpend] = useState(0);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [sortState, setSortState] = useState<Record<string, { key: SortKey; dir: SortDir }>>({});
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

  const hasAiBrain = Boolean((loadAiBrain() || model.aiBrain)?.term_classifications?.length);

  const cards = useMemo(() => {
    return buildUiCards(model)
      .map((card) => ({
        ...card,
        terms: card.terms.filter((row) => row.spend >= minSpend),
      }))
      .filter((card) => card.terms.length > 0)
      .map((card) => {
        const spend = card.terms.reduce((s, row) => s + row.spend, 0);
        const clicks = card.terms.reduce((s, row) => s + row.clicks, 0);
        const impressions = card.terms.reduce((s, row) => s + row.impressions, 0);
        const conversions = card.terms.reduce((s, row) => s + row.conversions, 0);
        const conversionValue = card.terms.reduce((s, row) => s + row.conversionValue, 0);

        return {
          ...card,
          spend,
          clicks,
          impressions,
          conversions,
          conversionValue,
          ctr: impressions > 0 ? clicks / impressions : 0,
          roas: spend > 0 ? conversionValue / spend : 0,
          negativeCandidates: card.terms.filter((row) => {
            const action = String(row.action || "").toLowerCase();
            return row.spend > 0 && row.conversions === 0 && action.includes("negative");
          }),
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [model, minSpend, version]);

  function getVisibleRows(card: UiCategoryCard) {
    const localSort = sortState[card.category] || { key: "spend" as SortKey, dir: "desc" as SortDir };

    let rows = card.terms;

    if (query.trim()) {
      const q = normalizeTerm(query);
      rows = rows.filter((row) =>
        [
          row.searchTerm,
          row.campaign,
          row.adGroup,
          row.category,
          row.action,
          row.aiReason,
        ]
          .filter(Boolean)
          .some((value) => normalizeTerm(value).includes(q))
      );
    }

    if (actionFilter !== "all") {
      rows = rows.filter((row) => {
        const action = String(row.action || "").toUpperCase();

        if (actionFilter === "scale") return action.includes("SCALE");
        if (actionFilter === "keep") return action.includes("KEEP");
        if (actionFilter === "watch") return action.includes("WATCH") || action.includes("PDP") || action.includes("INVESTIGATE");
        if (actionFilter === "negative") return action.includes("NEGATIVE");

        return true;
      });
    }

    return sortRows(rows, localSort.key, localSort.dir);
  }

  function toggleSort(category: string, key: SortKey) {
    setSortState((current) => {
      const existing = current[category] || { key: "spend" as SortKey, dir: "desc" as SortDir };

      if (existing.key === key) {
        return {
          ...current,
          [category]: {
            key,
            dir: existing.dir === "asc" ? "desc" : "asc",
          },
        };
      }

      return {
        ...current,
        [category]: {
          key,
          dir: key === "searchTerm" ? "asc" : "desc",
        },
      };
    });
  }

  function sortArrow(category: string, key: SortKey) {
    const existing = sortState[category] || { key: "spend" as SortKey, dir: "desc" as SortDir };
    if (existing.key !== key) return "⇅";
    return existing.dir === "asc" ? "▲" : "▼";
  }

  function exportCategory(card: UiCategoryCard) {
    exportRowsCsv(
      `${card.category.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}-keywords.csv`,
      getVisibleRows(card).map((row) => ({
        Category: row.category,
        Campaign: row.campaign,
        "Ad group": row.adGroup,
        Keyword: row.searchTerm,
        Cost: Math.round(row.spend),
        Clicks: Math.round(row.clicks),
        Impressions: Math.round(row.impressions),
        "Cost/Impr": costPerImpression(row).toFixed(2),
        CTR: `${(row.ctr * 100).toFixed(2)}%`,
        Purchases: row.conversions.toFixed(2),
        "Conv. value": Math.round(row.conversionValue),
        ROI: row.roas.toFixed(2),
        Action: row.action,
        "AI applied": row.aiApplied ? "Y" : "N",
        "AI reason": row.aiReason || "",
      }))
    );
  }

  function exportNegatives(card: UiCategoryCard) {
    exportRowsCsv(
      `${card.category.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}-negatives.csv`,
      card.negativeCandidates.map((row) => ({
        Campaign: row.campaign,
        "Ad group": row.adGroup,
        Keyword: negativeSyntax(
          row.searchTerm,
          row.aiNegativeMatchType && row.aiNegativeMatchType !== "none" ? row.aiNegativeMatchType : matchType
        ),
        "Match type":
          row.aiNegativeMatchType && row.aiNegativeMatchType !== "none"
            ? row.aiNegativeMatchType
            : matchType,
        Reason: row.aiReason || row.action,
        Cost: Math.round(row.spend),
        Clicks: Math.round(row.clicks),
        Purchases: row.conversions.toFixed(2),
      }))
    );
  }

  return (
    <section className="stkc-wrap">
      <div className="stkc-head">
        <div>
          <h2>Keyword Categories</h2>
          <p>
            {hasAiBrain
              ? "AI Brain categories applied · open a card, filter rows, click any column header to sort."
              : "AI Brain not applied yet · fallback classification is shown. Apply AI Brain for dynamic bifurcation."}
          </p>
        </div>

        <div className="stkc-controls">
          <label>
            Min spend
            <input
              type="number"
              min={0}
              value={minSpend}
              onChange={(event) => setMinSpend(Number(event.target.value || 0))}
            />
          </label>

          <label>
            Search table
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="keyword, campaign, action..."
            />
          </label>

          <label>
            Action
            <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
              <option value="all">All actions</option>
              <option value="scale">Scale</option>
              <option value="keep">Keep</option>
              <option value="watch">Watch / PDP</option>
              <option value="negative">Negative</option>
            </select>
          </label>
        </div>
      </div>

      <div className="stkc-list">
        {cards.map((card) => {
          const isOpen = openCategory === card.category;
          const visibleRows = getVisibleRows(card);

          return (
            <article
              key={card.category}
              className={`stkc-card ${isOpen ? "open" : ""}`}
              style={{ ["--stkc-color" as string]: card.color }}
            >
              <div className="stkc-bar" />

              <div className="stkc-body">
                <div className="stkc-top">
                  <div className="stkc-name">
                    <span />
                    {card.category}
                  </div>
                  <div className="stkc-verdict">{card.verdict}</div>
                </div>

                <div className="stkc-stats">
                  <div>
                    <strong>{int(card.terms.length)}</strong>
                    <span>Keywords</span>
                  </div>
                  <div>
                    <strong>{money(card.spend)}</strong>
                    <span>Spend</span>
                  </div>
                  <div>
                    <strong className={card.conversions > 0 ? "pos" : ""}>{card.conversions.toFixed(1)}</strong>
                    <span>Purchases</span>
                  </div>
                  <div>
                    <strong className={card.roas >= 1 ? "pos" : card.roas > 0 ? "" : "neg"}>{x(card.roas)}</strong>
                    <span>ROI</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="stkc-toggle"
                  onClick={() => setOpenCategory(isOpen ? "" : card.category)}
                >
                  <span>{isOpen ? "Hide" : "View"} {visibleRows.length} keywords</span>
                  <b>{isOpen ? "▲" : "▼"}</b>
                </button>

                {isOpen ? (
                  <div className="stkc-panel">
                    <div className="stkc-panel-actions">
                      <button type="button" onClick={() => exportCategory(card)}>
                        Export current table
                      </button>
                      <button
                        type="button"
                        onClick={() => exportNegatives(card)}
                        disabled={!card.negativeCandidates.length}
                      >
                        Export negatives
                      </button>
                    </div>

                    <div className="stkc-scroll">
                      <table className="stkc-table">
                        <thead>
                          <tr>
                            <th className="left" onClick={() => toggleSort(card.category, "searchTerm")}>
                              Keyword <span>{sortArrow(card.category, "searchTerm")}</span>
                            </th>
                            <th onClick={() => toggleSort(card.category, "spend")}>
                              Cost <span>{sortArrow(card.category, "spend")}</span>
                            </th>
                            <th onClick={() => toggleSort(card.category, "impressions")}>
                              Impr. <span>{sortArrow(card.category, "impressions")}</span>
                            </th>
                            <th onClick={() => toggleSort(card.category, "costPerImpression")}>
                              Cost/Impr <span>{sortArrow(card.category, "costPerImpression")}</span>
                            </th>
                            <th onClick={() => toggleSort(card.category, "ctr")}>
                              CTR <span>{sortArrow(card.category, "ctr")}</span>
                            </th>
                            <th onClick={() => toggleSort(card.category, "conversions")}>
                              Purch. <span>{sortArrow(card.category, "conversions")}</span>
                            </th>
                            <th onClick={() => toggleSort(card.category, "conversionValue")}>
                              Conv. val <span>{sortArrow(card.category, "conversionValue")}</span>
                            </th>
                            <th onClick={() => toggleSort(card.category, "roas")}>
                              ROI <span>{sortArrow(card.category, "roas")}</span>
                            </th>
                            <th className="left">Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {visibleRows.map((row, index) => {
                            const tag = actionTag(row.action);

                            return (
                              <tr key={`${row.searchTerm}-${index}`}>
                                <td className="left kw" title={row.searchTerm}>{row.searchTerm}</td>
                                <td>{money(row.spend)}</td>
                                <td>{int(row.impressions)}</td>
                                <td>{money(costPerImpression(row))}</td>
                                <td>{pct(row.ctr)}</td>
                                <td className={row.conversions > 0 ? "pos" : ""}>{row.conversions.toFixed(2)}</td>
                                <td className={row.conversionValue > 0 ? "pos" : ""}>{money(row.conversionValue)}</td>
                                <td className={row.roas >= 1 ? "pos" : row.roas > 0 ? "" : "neg"}>{x(row.roas)}</td>
                                <td className="left">
                                  <span className={`stkc-tag ${tag.cls}`}>{tag.label}</span>
                                  {row.aiApplied ? <span className="stkc-ai">AI</span> : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="stkc-foot">
        “Purchases” = conversions · “ROI” = conversion value ÷ cost · “Cost/Impr” = cost ÷ impressions
      </div>
    </section>
  );
}
