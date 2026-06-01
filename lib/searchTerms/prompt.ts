import type { SearchTermModel, SearchTermRow } from "./types";

function termPayload(row: SearchTermRow) {
  return {
    search_term: row.searchTerm,
    campaign: row.campaign,
    ad_group: row.adGroup,
    spend: Math.round(row.spend),
    clicks: Math.round(row.clicks),
    impressions: Math.round(row.impressions),
    ctr: Number(row.ctr.toFixed(4)),
    conversions: Number(row.conversions.toFixed(2)),
    conversion_value: Math.round(row.conversionValue),
    roas: Number(row.roas.toFixed(2)),
  };
}

export function buildAiBrainPrompt(model: SearchTermModel) {
  const payload = {
    account_summary: model.summary,

    top_spend_terms: model.terms
      .slice()
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 300)
      .map(termPayload),

    zero_purchase_terms: model.terms
      .filter((r) => r.spend > 0 && r.conversions === 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 250)
      .map(termPayload),

    converting_terms: model.terms
      .filter((r) => r.conversions > 0)
      .sort((a, b) => b.conversionValue - a.conversionValue)
      .slice(0, 150)
      .map(termPayload),

    ngrams: model.ngrams.slice(0, 100),
  };

  return `You are a top 0.001% Google Shopping search-term operator.

Goal:
Create a dynamic taxonomy for this uploaded search-term file.
Do not assume the product category.
Do not use fixed dandruff-only logic.
Classify by intent, relevance, buying stage, wrong-category leakage, competitor terms, marketplace terms, DIY/informational terms, and core conversion intent.

Return ONLY valid JSON. No markdown. No explanation.

Schema:
{
  "detected_theme": "string",
  "strategic_summary": ["max 8 concise lines"],
  "categories": [
    {
      "name": "string",
      "definition": "string",
      "default_action": "string",
      "negative_aggressiveness": "low|medium|high",
      "operator_note": "string"
    }
  ],
  "term_classifications": [
    {
      "search_term": "string",
      "category": "string",
      "suggested_action": "SCALE|KEEP|WATCH|PDP_ISSUE|NEGATIVE_EXACT|NEGATIVE_PHRASE|NEGATIVE_BROAD|CONTENT_SEO|INVESTIGATE",
      "confidence": 0.0,
      "reason": "string",
      "negative_match_type": "none|exact|phrase|broad"
    }
  ],
  "negative_candidates": [
    {
      "search_term": "string",
      "match_type": "exact|phrase|broad",
      "reason": "string",
      "confidence": 0.0
    }
  ],
  "watchouts": ["string"]
}

Important rules:
- Do not recommend negative for terms with strong conversions.
- Core product/problem intent with clicks but no purchases should usually be PDP_ISSUE or WATCH, not immediate negative.
- Competitor/marketplace/wrong-category/DIY can be negative if spend and conversion data supports it.
- Explain category logic clearly.
- Keep JSON valid.

Dataset:
${JSON.stringify(payload, null, 2)}
`;
}
