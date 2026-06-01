import type { AnalyzeResponse, SearchTermModel, SearchTermRow } from "./types";
import { num, str } from "./format";
import { loadAiBrain } from "./aiBrain";
import { applyCategories, buildCategoryCards, fallbackCategory, fallbackAction } from "./categories";

function arr<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readRows(data: AnalyzeResponse): Record<string, unknown>[] {
  return (
    arr(data.terms) ||
    arr(data.search_terms) ||
    arr(data.rows) ||
    arr(data.table)
  );
}

export function normalizeAnalyzeResponse(data: AnalyzeResponse): SearchTermModel {
  const rawRows = readRows(data);

  let terms: SearchTermRow[] = rawRows
    .map((row) => {
      const searchTerm = str(
        row.search_term ??
          row.searchTerm ??
          row.term ??
          row["Search term"]
      );

      const spend = num(row.cost ?? row.spend ?? row.Cost);
      const clicks = num(row.clicks ?? row.Clicks);
      const impressions = num(row.impressions ?? row.impr ?? row.Impr);
      const conversions = num(row.conversions ?? row.conv ?? row.Conversions);
      const conversionValue = num(
        row.revenue ??
          row.conv_value ??
          row.conversion_value ??
          row["Conv. value"] ??
          row["Conversion value"]
      );

      const ctr = impressions > 0 ? clicks / impressions : num(row.ctr);
      const cpc = clicks > 0 ? spend / clicks : num(row.avg_cpc ?? row.cpc);
      const roas = spend > 0 ? conversionValue / spend : num(row.roas);
      const cvr = clicks > 0 ? conversions / clicks : num(row.cvr);

      const base: SearchTermRow = {
        searchTerm,
        campaign: str(row.campaign ?? row.campaign_name ?? row.Campaign ?? row["Campaign"], "-"),
        adGroup: str(row.ad_group ?? row.ad_group_name ?? row.adgroup ?? row["Ad group"] ?? row["Ad group name"], "-"),
        spend,
        clicks,
        impressions,
        ctr,
        cpc,
        conversions,
        conversionValue,
        roas,
        cvr,
        category: str(row.category, ""),
        action: str(row.action, ""),
        raw: row,
      };

      base.category = base.category || fallbackCategory(searchTerm);
      base.action = base.action || fallbackAction(base);

      return base;
    })
    .filter((row) => row.searchTerm);

  const aiBrain = typeof window !== "undefined" ? loadAiBrain() : null;
  terms = applyCategories(terms, aiBrain);

  const spend = terms.reduce((total, row) => total + row.spend, 0);
  const revenue = terms.reduce((total, row) => total + row.conversionValue, 0);
  const clicks = terms.reduce((total, row) => total + row.clicks, 0);

  const zeroPurchaseSpend = terms
    .filter((row) => row.spend > 0 && row.conversions === 0)
    .reduce((total, row) => total + row.spend, 0);

  const killListSpend = terms
    .filter((row) => row.action.toLowerCase().includes("negative"))
    .reduce((total, row) => total + row.spend, 0);

  return {
    terms,
    categories: buildCategoryCards(terms),
    ngrams: arr(data.ngrams),
    recommendations: arr(data.recommendations),
    aiBrain,
    summary: {
      spend,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      zeroPurchaseSpend,
      killListSpend,
      clicks,
      terms: terms.length,
    },
  };
}
