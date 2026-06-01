import type { AiBrainResponse, CategoryCard, SearchTermRow } from "./types";
import { normalizeTerm, num } from "./format";

function sum(rows: SearchTermRow[], key: keyof SearchTermRow): number {
  return rows.reduce((total, row) => total + num(row[key]), 0);
}

export function buildAiClassificationMap(aiBrain: AiBrainResponse | null) {
  const map = new Map<string, NonNullable<AiBrainResponse["term_classifications"]>[number]>();

  if (!aiBrain?.term_classifications) return map;

  for (const item of aiBrain.term_classifications) {
    const key = normalizeTerm(item.search_term);
    if (!key) continue;
    map.set(key, item);
  }

  return map;
}

export function fallbackCategory(termInput: string): string {
  const term = normalizeTerm(termInput);

  const marketplace = ["amazon", "flipkart", "nykaa", "myntra", "meesho", "ajio"];
  const diy = ["home remedy", "diy", "homemade", "how to", "tips", "kaise", "ghar", "natural remedy"];
  const competitorSignals = ["olaplex", "traya", "vedix", "loreal", "matrix", "biolage", "minimalist", "himalaya"];
  const wrongCategory = ["body wash", "hand cream", "sunscreen", "makeup", "soap", "perfume", "beard"];

  if (marketplace.some((word) => term.includes(word))) return "Marketplace";
  if (competitorSignals.some((word) => term.includes(word))) return "Competitor / Other Brand";
  if (wrongCategory.some((word) => term.includes(word))) return "Off-product / Wrong Category";
  if (diy.some((word) => term.includes(word))) return "DIY / Informational";

  return "Core / Product Intent";
}

export function fallbackAction(row: SearchTermRow): string {
  if (row.conversions > 0 && row.roas >= 2.5) return "SCALE";
  if (row.conversions > 0) return "KEEP / WATCH";

  const category = row.category.toLowerCase();

  if (category.includes("competitor")) return "NEGATIVE unless conquesting";
  if (category.includes("marketplace")) return "NEGATIVE / REVIEW";
  if (category.includes("off-product")) return "NEGATIVE";
  if (category.includes("diy") || category.includes("informational")) return "CONTENT_SEO / NEGATIVE";
  if (row.clicks >= 30 && row.conversions === 0) return "PDP_ISSUE / WATCH";

  return "MONITOR";
}

export function isNegativeCandidate(row: SearchTermRow): boolean {
  const action = row.action.toLowerCase();
  const category = row.category.toLowerCase();

  if (row.spend <= 0) return false;
  if (row.conversions > 0) return false;

  return (
    action.includes("negative") ||
    category.includes("competitor") ||
    category.includes("marketplace") ||
    category.includes("off-product") ||
    category.includes("informational")
  );
}

export function applyCategories(rows: SearchTermRow[], aiBrain: AiBrainResponse | null): SearchTermRow[] {
  const aiMap = buildAiClassificationMap(aiBrain);

  return rows.map((row) => {
    const ai = aiMap.get(normalizeTerm(row.searchTerm));
    const category = ai?.category || row.category || fallbackCategory(row.searchTerm);

    return {
      ...row,
      category,
      action: ai?.suggested_action || row.action || fallbackAction({ ...row, category }),
      aiCategory: ai?.category,
      aiAction: ai?.suggested_action,
      aiReason: ai?.reason,
      aiConfidence: ai ? num(ai.confidence) : undefined,
      aiNegativeMatchType: ai?.negative_match_type,
      aiApplied: Boolean(ai),
    };
  });
}

export function summarizeCategory(category: string, rows: SearchTermRow[]): string {
  const spend = sum(rows, "spend");
  const conversions = sum(rows, "conversions");
  const conversionValue = sum(rows, "conversionValue");
  const roas = spend > 0 ? conversionValue / spend : 0;

  const c = category.toLowerCase();

  if (conversions > 0 && roas >= 2.5) return "Profitable cluster — protect and scale carefully.";
  if (c.includes("competitor")) return "Competitor leakage — add negatives unless conquesting intentionally.";
  if (c.includes("marketplace")) return "Marketplace leakage — usually negative unless intentional.";
  if (c.includes("off-product")) return "Wrong-category spend — strong negative candidate.";
  if (c.includes("diy") || c.includes("informational")) return "Research traffic — move to SEO/content or negative.";
  if (spend > 0 && conversions === 0) return "Relevant but not converting — check PDP, offer, pricing, and reviews.";

  return "Review cluster manually before action.";
}

export function buildCategoryCards(rows: SearchTermRow[]): CategoryCard[] {
  const grouped = new Map<string, SearchTermRow[]>();

  for (const row of rows) {
    const category = row.category || "Unclassified / Review";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(row);
  }

  return Array.from(grouped.entries())
    .map(([category, terms]) => {
      const spend = sum(terms, "spend");
      const clicks = sum(terms, "clicks");
      const impressions = sum(terms, "impressions");
      const conversions = sum(terms, "conversions");
      const conversionValue = sum(terms, "conversionValue");

      return {
        category,
        terms: terms.slice().sort((a, b) => b.spend - a.spend),
        spend,
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        conversions,
        conversionValue,
        roas: spend > 0 ? conversionValue / spend : 0,
        actionSummary: summarizeCategory(category, terms),
        negativeCandidates: terms.filter(isNegativeCandidate),
      };
    })
    .sort((a, b) => b.spend - a.spend);
}
