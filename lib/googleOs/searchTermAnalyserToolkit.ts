import type { GoogleOsModel, GoogleOsRow } from "@/lib/googleOs/types";
import type { SearchTermRawRow, SearchTermWasterRow } from "@/lib/googleOs/searchTermWasterToolkit";

export type SearchTermIntentType =
  | "Brand"
  | "Category"
  | "Product"
  | "Problem"
  | "Ingredient"
  | "Competitor"
  | "Marketplace"
  | "DIY / Home Remedy"
  | "Research"
  | "Price / Offer"
  | "Review / Comparison"
  | "Location"
  | "Medical"
  | "Irrelevant / Junk"
  | "Excluded But Winning"
  | "Needs Review";

export type SearchTermDecision =
  | "Increase Bid"
  | "Decrease Bid"
  | "Keep"
  | "Add Exact Keyword"
  | "Add Negative"
  | "Bring Back"
  | "Protect"
  | "Move to SEO"
  | "Separate Campaign"
  | "Manual Review";

export type SearchTermAnalyserRules = {
  targetRoas: number;
  targetCpa: number;
  minSpendForDecision: number;
  minClicksForDecision: number;
  winningPurchases: number;
  winningRoas: number;
  winningMaxCpa: number;
};

export type SearchTermClassifierSettings = {
  brandTerms: string[];
  productTerms: string[];
  categoryTerms: string[];
  problemTerms: string[];
  ingredientTerms: string[];
  competitorTerms: string[];
  marketplaceTerms: string[];
  diyTerms: string[];
  researchTerms: string[];
  priceTerms: string[];
  reviewTerms: string[];
  locationTerms: string[];
  medicalTerms: string[];
  junkTerms: string[];
};

export type CampaignContext = {
  campaign: string;
  campaignType: string;
  spend: number;
  revenue: number;
  purchases: number;
  clicks: number;
  impressions: number;
  roas: number;
  cpa: number;
  ctr: number;
};

export type ClassifiedSearchTermRow = SearchTermWasterRow & {
  intentType: SearchTermIntentType;
  confidence: "High" | "Medium" | "Low";
  intentReason: string;
  commercialScore: number;
  performanceScore: number;
  strategicScore: number;
  riskScore: number;
  priorityScore: number;
  decision: SearchTermDecision;
  recommendedAction: string;
  campaignContext?: CampaignContext;
  campaignRoas: number;
  campaignCpa: number;
  termVsCampaign: string;
};

export type IntentSummaryRow = {
  intentType: SearchTermIntentType;
  terms: number;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  purchases: number;
  revenue: number;
  cpa: number;
  roas: number;
  wasteSpend: number;
  wasteShare: number;
  bestDecision: string;
};

export const DEFAULT_ANALYSER_RULES: SearchTermAnalyserRules = {
  targetRoas: 2,
  targetCpa: 600,
  minSpendForDecision: 500,
  minClicksForDecision: 10,
  winningPurchases: 2,
  winningRoas: 2,
  winningMaxCpa: 600,
};

export const DEFAULT_CLASSIFIER_SETTINGS: SearchTermClassifierSettings = {
  brandTerms: [
    "brillare",
    "brillare science",
    "root deep",
    "oil shots",
    "hydroil",
  ],
  productTerms: [
    "shampoo",
    "serum",
    "conditioner",
    "hair oil",
    "oil shot",
    "oil shots",
    "mask",
    "scalp food",
    "moisturizer",
    "face wash",
  ],
  categoryTerms: [
    "hair oil",
    "dandruff shampoo",
    "hair fall shampoo",
    "hair growth serum",
    "anti dandruff shampoo",
    "scalp serum",
    "hair serum",
  ],
  problemTerms: [
    "hair fall",
    "hair loss",
    "hair growth",
    "dandruff",
    "itchy scalp",
    "frizzy hair",
    "dry hair",
    "hair thinning",
    "regrowth",
    "damaged hair",
    "split ends",
  ],
  ingredientTerms: [
    "rosemary",
    "redensyl",
    "anagain",
    "ketoconazole",
    "minoxidil",
    "finasteride",
    "niacinamide",
    "ceramide",
    "panthenol",
    "salicylic",
    "tea tree",
    "argan",
  ],
  competitorTerms: [
    "mamaearth",
    "wishcare",
    "minimalist",
    "ordinary",
    "the ordinary",
    "plum",
    "wow",
    "bare anatomy",
    "pilgrim",
    "biotique",
    "khadi",
    "forest essentials",
    "nykaa naturals",
    "arata",
    "fix my curls",
    "traya",
    "man matters",
    "be bodywise",
    "bodywise",
  ],
  marketplaceTerms: [
    "amazon",
    "flipkart",
    "nykaa",
    "meesho",
    "myntra",
    "blinkit",
    "zepto",
    "swiggy",
    "instamart",
  ],
  diyTerms: [
    "home remedy",
    "homemade",
    "home made",
    "at home",
    "diy",
    "natural remedy",
    "gharelu",
    "kaise banaye",
    "remedy",
    "ghar par",
  ],
  researchTerms: [
    "what is",
    "how to",
    "meaning",
    "benefits",
    "side effects",
    "does it work",
    "before after",
    "result",
    "results",
    "use of",
    "uses",
  ],
  priceTerms: [
    "price",
    "cost",
    "cheap",
    "best price",
    "offer",
    "discount",
    "under 500",
    "under 1000",
    "low price",
  ],
  reviewTerms: [
    "review",
    "reviews",
    "vs",
    "versus",
    "comparison",
    "better than",
    "before after",
    "rating",
  ],
  locationTerms: [
    "near me",
    "shop near me",
    "store near me",
    "salon",
    "clinic",
    "chemist",
    "medical store",
  ],
  medicalTerms: [
    "ketoconazole",
    "minoxidil",
    "finasteride",
    "dermatologist",
    "prescription",
    "fungal infection",
    "alopecia",
    "psoriasis",
    "seborrheic",
    "doctor",
  ],
  junkTerms: [
    "job",
    "jobs",
    "course",
    "pdf",
    "supplier",
    "wholesale",
    "manufacturer",
    "image",
    "photo",
    "free",
    "download",
    "formula",
  ],
};

function safeDiv(a: number, b: number) {
  return b ? a / b : 0;
}

function includesAny(term: string, words: string[]) {
  const lower = term.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function classifySearchTerm(
  row: SearchTermWasterRow,
  settings: SearchTermClassifierSettings
): {
  intentType: SearchTermIntentType;
  confidence: "High" | "Medium" | "Low";
  reason: string;
} {
  const term = row.searchTerm.toLowerCase();
  const isExcluded = Boolean((row as any).isExcluded);

  if (isExcluded && row.purchases > 0) {
    return {
      intentType: "Excluded But Winning",
      confidence: "High",
      reason: "Search term is already excluded but has purchase data.",
    };
  }

  if (includesAny(term, settings.brandTerms)) {
    return { intentType: "Brand", confidence: "High", reason: "Contains brand / owned product term." };
  }

  if (includesAny(term, settings.competitorTerms)) {
    return { intentType: "Competitor", confidence: "High", reason: "Contains competitor brand term." };
  }

  if (includesAny(term, settings.marketplaceTerms)) {
    return { intentType: "Marketplace", confidence: "High", reason: "Contains marketplace/platform term." };
  }

  if (includesAny(term, settings.diyTerms)) {
    return { intentType: "DIY / Home Remedy", confidence: "High", reason: "Contains DIY, homemade, or remedy intent." };
  }

  if (includesAny(term, settings.medicalTerms)) {
    return { intentType: "Medical", confidence: "Medium", reason: "Contains medical/pharma/condition term." };
  }

  if (includesAny(term, settings.junkTerms)) {
    return { intentType: "Irrelevant / Junk", confidence: "High", reason: "Contains low commercial or irrelevant word." };
  }

  if (includesAny(term, settings.priceTerms)) {
    return { intentType: "Price / Offer", confidence: "Medium", reason: "Contains price, offer, discount, or budget intent." };
  }

  if (includesAny(term, settings.reviewTerms)) {
    return { intentType: "Review / Comparison", confidence: "Medium", reason: "Contains review, comparison, vs, or result intent." };
  }

  if (includesAny(term, settings.locationTerms)) {
    return { intentType: "Location", confidence: "High", reason: "Contains local / near-me intent." };
  }

  if (includesAny(term, settings.researchTerms)) {
    return { intentType: "Research", confidence: "Medium", reason: "Contains informational/research intent." };
  }

  if (includesAny(term, settings.ingredientTerms)) {
    return { intentType: "Ingredient", confidence: "High", reason: "Contains ingredient-led search intent." };
  }

  if (includesAny(term, settings.problemTerms)) {
    return { intentType: "Problem", confidence: "High", reason: "Contains problem / concern-led search intent." };
  }

  if (includesAny(term, settings.productTerms)) {
    return { intentType: "Product", confidence: "Medium", reason: "Contains product-format term." };
  }

  if (includesAny(term, settings.categoryTerms)) {
    return { intentType: "Category", confidence: "Medium", reason: "Contains category search intent." };
  }

  return {
    intentType: "Needs Review",
    confidence: "Low",
    reason: "No strong classification rule matched.",
  };
}

function getCommercialScore(intentType: SearchTermIntentType, row: SearchTermWasterRow) {
  const base: Record<SearchTermIntentType, number> = {
    Brand: 90,
    Category: 75,
    Product: 78,
    Problem: 72,
    Ingredient: 78,
    Competitor: 62,
    Marketplace: 48,
    "DIY / Home Remedy": 28,
    Research: 35,
    "Price / Offer": 58,
    "Review / Comparison": 65,
    Location: 25,
    Medical: 45,
    "Irrelevant / Junk": 5,
    "Excluded But Winning": 80,
    "Needs Review": 40,
  };

  let score = base[intentType] || 40;
  if (row.purchases > 0) score += 12;
  if (row.revenue > 0) score += 8;
  return clamp(score);
}

function getPerformanceScore(row: SearchTermWasterRow, rules: SearchTermAnalyserRules) {
  let score = 50;

  if (row.purchases >= rules.winningPurchases) score += 20;
  if (row.roas >= rules.winningRoas) score += 20;
  if (row.cpa > 0 && row.cpa <= rules.winningMaxCpa) score += 15;

  if (row.spend >= rules.minSpendForDecision && row.purchases === 0) score -= 35;
  if (row.clicks >= rules.minClicksForDecision && row.purchases === 0) score -= 20;
  if (row.roas > 0 && row.roas < rules.targetRoas) score -= 15;
  if (row.cpa > rules.targetCpa) score -= 15;

  return clamp(score);
}

function getStrategicScore(intentType: SearchTermIntentType, row: SearchTermWasterRow) {
  let score = 50;

  if (["Brand", "Product", "Problem", "Ingredient", "Category"].includes(intentType)) score += 25;
  if (intentType === "Excluded But Winning") score += 30;
  if (intentType === "Competitor") score += 5;
  if (["DIY / Home Remedy", "Research", "Location", "Irrelevant / Junk"].includes(intentType)) score -= 25;
  if (Boolean((row as any).isProtected)) score += 15;

  return clamp(score);
}

function getRiskScore(intentType: SearchTermIntentType, row: SearchTermWasterRow, rules: SearchTermAnalyserRules) {
  let score = 30;

  if (row.spend >= rules.minSpendForDecision && row.purchases === 0) score += 35;
  if (row.clicks >= rules.minClicksForDecision && row.purchases === 0) score += 20;
  if (["DIY / Home Remedy", "Irrelevant / Junk", "Location", "Marketplace"].includes(intentType)) score += 20;
  if (["Brand", "Excluded But Winning"].includes(intentType)) score -= 15;
  if (row.purchases > 0) score -= 20;

  return clamp(score);
}

function getDecision(args: {
  row: SearchTermWasterRow;
  intentType: SearchTermIntentType;
  rules: SearchTermAnalyserRules;
  commercialScore: number;
  performanceScore: number;
  strategicScore: number;
  riskScore: number;
}): { decision: SearchTermDecision; action: string } {
  const { row, intentType, rules } = args;
  const isExcluded = Boolean((row as any).isExcluded);
  const isProtected = Boolean((row as any).isProtected);

  if (
    isExcluded &&
    row.purchases >= 1 &&
    row.roas >= rules.winningRoas &&
    row.cpa <= rules.winningMaxCpa
  ) {
    return {
      decision: "Bring Back",
      action: "Remove from negative list and re-add as exact keyword if still commercially valid.",
    };
  }

  if (
    row.purchases >= rules.winningPurchases &&
    row.roas >= rules.winningRoas &&
    row.cpa <= rules.winningMaxCpa
  ) {
    return {
      decision: "Increase Bid",
      action: "Increase bid / add as exact keyword / isolate into high-intent ad group.",
    };
  }

  if (isProtected && row.spend >= rules.minSpendForDecision && row.purchases === 0) {
    return {
      decision: "Manual Review",
      action: "Protected but wasting spend. Do not negative blindly. Review bid, match type, query fit, and landing page.",
    };
  }

  if (
    row.spend >= rules.minSpendForDecision &&
    row.purchases === 0 &&
    !isProtected &&
    !isExcluded
  ) {
    return {
      decision: "Add Negative",
      action: "Add exact negative. Use phrase negative only if repeated pattern is clearly irrelevant.",
    };
  }

  if (
    row.clicks >= rules.minClicksForDecision &&
    row.purchases === 0 &&
    !isProtected &&
    !isExcluded
  ) {
    return {
      decision: "Add Negative",
      action: "Review and add exact negative if search term is not commercially useful.",
    };
  }

  if (intentType === "Competitor" && row.purchases > 0) {
    return {
      decision: "Separate Campaign",
      action: "Move to separate competitor campaign with capped budget and separate ROAS expectations.",
    };
  }

  if (intentType === "Marketplace" && row.purchases === 0) {
    return {
      decision: "Add Negative",
      action: "Marketplace leakage. Add phrase/exact negative unless intentionally running marketplace comparison.",
    };
  }

  if (intentType === "DIY / Home Remedy") {
    return {
      decision: row.purchases > 0 ? "Keep" : "Move to SEO",
      action: row.purchases > 0
        ? "Keep only if profitable; monitor closely."
        : "Move learning to SEO/content. Avoid scaling paid search on DIY intent.",
    };
  }

  if (intentType === "Research") {
    return {
      decision: row.purchases > 0 ? "Keep" : "Move to SEO",
      action: row.purchases > 0
        ? "Keep if profitable; consider proof-led landing page."
        : "Use as SEO/content opportunity rather than paid acquisition keyword.",
    };
  }

  if (row.purchases > 0 && row.roas < rules.targetRoas) {
    return {
      decision: "Decrease Bid",
      action: "Converts but below efficiency. Reduce bid or isolate before scaling.",
    };
  }

  if (isProtected) {
    return {
      decision: "Protect",
      action: "Protected term. Do not add as negative without manual review.",
    };
  }

  return {
    decision: "Manual Review",
    action: "Not enough signal. Review manually after more spend/clicks.",
  };
}

export function buildCampaignContext(model: GoogleOsModel): Map<string, CampaignContext> {
  const map = new Map<string, CampaignContext>();

  (model.rows || []).forEach((row: any) => {
    const campaign = String(row.campaign || row.campaignName || "").trim();
    if (!campaign) return;

    const current = map.get(campaign) || {
      campaign,
      campaignType: String(row.campaignType || ""),
      spend: 0,
      revenue: 0,
      purchases: 0,
      clicks: 0,
      impressions: 0,
      roas: 0,
      cpa: 0,
      ctr: 0,
    };

    current.spend += Number(row.spend || row.cost || 0);
    current.revenue += Number(row.revenue || row.purchaseValue || row.conversionValue || 0);
    current.purchases += Number(row.purchases || row.conversions || 0);
    current.clicks += Number(row.clicks || 0);
    current.impressions += Number(row.impressions || 0);
    current.campaignType = current.campaignType || String(row.campaignType || "");

    map.set(campaign, current);
  });

  map.forEach((value) => {
    value.roas = safeDiv(value.revenue, value.spend);
    value.cpa = safeDiv(value.spend, value.purchases);
    value.ctr = safeDiv(value.clicks, value.impressions);
  });

  return map;
}

export function classifySearchTerms(
  rows: SearchTermWasterRow[],
  model: GoogleOsModel,
  rules: SearchTermAnalyserRules = DEFAULT_ANALYSER_RULES,
  settings: SearchTermClassifierSettings = DEFAULT_CLASSIFIER_SETTINGS
): ClassifiedSearchTermRow[] {
  const campaignMap = buildCampaignContext(model);

  return rows.map((row) => {
    const classification = classifySearchTerm(row, settings);
    const campaignContext = campaignMap.get(row.campaign);

    const commercialScore = getCommercialScore(classification.intentType, row);
    const performanceScore = getPerformanceScore(row, rules);
    const strategicScore = getStrategicScore(classification.intentType, row);
    const riskScore = getRiskScore(classification.intentType, row, rules);
    const priorityScore = clamp(
      commercialScore * 0.3 + performanceScore * 0.35 + strategicScore * 0.25 - riskScore * 0.25
    );

    const decision = getDecision({
      row,
      intentType: classification.intentType,
      rules,
      commercialScore,
      performanceScore,
      strategicScore,
      riskScore,
    });

    const campaignRoas = campaignContext?.roas || 0;
    const campaignCpa = campaignContext?.cpa || 0;

    let termVsCampaign = "No campaign benchmark";
    if (campaignContext && campaignContext.spend > 0) {
      if (row.roas > campaignRoas * 1.2) termVsCampaign = "Better than campaign";
      else if (row.roas < campaignRoas * 0.8) termVsCampaign = "Worse than campaign";
      else termVsCampaign = "Similar to campaign";
    }

    return {
      ...row,
      intentType: classification.intentType,
      confidence: classification.confidence,
      intentReason: classification.reason,
      commercialScore,
      performanceScore,
      strategicScore,
      riskScore,
      priorityScore,
      decision: decision.decision,
      recommendedAction: decision.action,
      campaignContext,
      campaignRoas,
      campaignCpa,
      termVsCampaign,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}

export function buildIntentSummary(rows: ClassifiedSearchTermRow[]): IntentSummaryRow[] {
  const map = new Map<SearchTermIntentType, ClassifiedSearchTermRow[]>();

  rows.forEach((row) => {
    if (!map.has(row.intentType)) map.set(row.intentType, []);
    map.get(row.intentType)!.push(row);
  });

  return Array.from(map.entries())
    .map(([intentType, groupRows]) => {
      const spend = groupRows.reduce((sum, row) => sum + row.spend, 0);
      const clicks = groupRows.reduce((sum, row) => sum + row.clicks, 0);
      const impressions = groupRows.reduce((sum, row) => sum + row.impressions, 0);
      const purchases = groupRows.reduce((sum, row) => sum + row.purchases, 0);
      const revenue = groupRows.reduce((sum, row) => sum + row.revenue, 0);
      const wasteSpend = groupRows
        .filter((row) => row.purchases === 0)
        .reduce((sum, row) => sum + row.spend, 0);

      const decisionCounts = new Map<string, number>();
      groupRows.forEach((row) => decisionCounts.set(row.decision, (decisionCounts.get(row.decision) || 0) + 1));

      const bestDecision = Array.from(decisionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Manual Review";

      return {
        intentType,
        terms: groupRows.length,
        spend,
        clicks,
        impressions,
        ctr: safeDiv(clicks, impressions),
        purchases,
        revenue,
        cpa: safeDiv(spend, purchases),
        roas: safeDiv(revenue, spend),
        wasteSpend,
        wasteShare: safeDiv(wasteSpend, spend),
        bestDecision,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

export function groupByDecision(rows: ClassifiedSearchTermRow[]) {
  const map = new Map<SearchTermDecision, ClassifiedSearchTermRow[]>();

  rows.forEach((row) => {
    if (!map.has(row.decision)) map.set(row.decision, []);
    map.get(row.decision)!.push(row);
  });

  return map;
}

export function groupByIntent(rows: ClassifiedSearchTermRow[]) {
  const map = new Map<SearchTermIntentType, ClassifiedSearchTermRow[]>();

  rows.forEach((row) => {
    if (!map.has(row.intentType)) map.set(row.intentType, []);
    map.get(row.intentType)!.push(row);
  });

  return map;
}

export function classifiedRowsForExcel(rows: ClassifiedSearchTermRow[]) {
  return rows.map((row) => ({
    "Search Term": row.searchTerm,
    "Intent Type": row.intentType,
    Confidence: row.confidence,
    "Intent Reason": row.intentReason,
    Decision: row.decision,
    "Recommended Action": row.recommendedAction,
    Campaign: row.campaign,
    "Campaign Type": row.campaignContext?.campaignType || "",
    "Ad Group": row.adGroup,
    "Added/Excluded": (row as any).addedExcluded || "",
    "Is Excluded": Boolean((row as any).isExcluded) ? "Yes" : "No",
    Keyword: row.keyword,
    "Keyword Match Type": row.keywordMatchType,
    Spend: Number(row.spend.toFixed(2)),
    Clicks: row.clicks,
    Impressions: row.impressions,
    CTR: Number((row.ctr * 100).toFixed(2)),
    Purchases: row.purchases,
    Revenue: Number(row.revenue.toFixed(2)),
    CPA: Number(row.cpa.toFixed(2)),
    ROAS: Number(row.roas.toFixed(2)),
    "Campaign ROAS": Number(row.campaignRoas.toFixed(2)),
    "Campaign CPA": Number(row.campaignCpa.toFixed(2)),
    "Term vs Campaign": row.termVsCampaign,
    "Commercial Score": Math.round(row.commercialScore),
    "Performance Score": Math.round(row.performanceScore),
    "Strategic Score": Math.round(row.strategicScore),
    "Risk Score": Math.round(row.riskScore),
    "Priority Score": Math.round(row.priorityScore),
    "Exact Negative": row.exactSyntax,
    "Phrase Negative": row.phraseSyntax,
    "Broad Negative": row.broadSyntax,
  }));
}

export function intentSummaryForExcel(rows: IntentSummaryRow[]) {
  return rows.map((row) => ({
    "Intent Type": row.intentType,
    Terms: row.terms,
    Spend: Number(row.spend.toFixed(2)),
    Clicks: row.clicks,
    Impressions: row.impressions,
    CTR: Number((row.ctr * 100).toFixed(2)),
    Purchases: row.purchases,
    Revenue: Number(row.revenue.toFixed(2)),
    CPA: Number(row.cpa.toFixed(2)),
    ROAS: Number(row.roas.toFixed(2)),
    "Waste Spend": Number(row.wasteSpend.toFixed(2)),
    "Waste Share %": Number((row.wasteShare * 100).toFixed(2)),
    "Main Decision": row.bestDecision,
  }));
}
