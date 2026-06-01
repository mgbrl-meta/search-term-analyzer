export type TabKey =
  | "waste_spender"
  | "keyword_category_cards"
  | "ai_brain"
  | "ngram"
  | "action_report";

export type MatchType = "exact" | "phrase" | "broad";

export type SearchTermRow = {
  searchTerm: string;
  campaign: string;
  adGroup: string;

  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  cvr: number;

  category: string;
  action: string;

  raw?: Record<string, unknown>;

  aiCategory?: string;
  aiAction?: string;
  aiReason?: string;
  aiConfidence?: number;
  aiNegativeMatchType?: "none" | "exact" | "phrase" | "broad";
  aiApplied?: boolean;
};

export type CategoryCard = {
  category: string;
  terms: SearchTermRow[];
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  actionSummary: string;
  negativeCandidates: SearchTermRow[];
};

export type AiBrainResponse = {
  detected_theme: string;
  strategic_summary?: string[];
  categories: {
    name: string;
    definition: string;
    default_action: string;
    negative_aggressiveness: "low" | "medium" | "high";
    operator_note?: string;
  }[];
  term_classifications?: {
    search_term: string;
    category: string;
    suggested_action: string;
    confidence: number;
    reason: string;
    negative_match_type?: "none" | "exact" | "phrase" | "broad";
  }[];
  negative_candidates?: {
    search_term: string;
    match_type: "exact" | "phrase" | "broad";
    reason: string;
    confidence: number;
  }[];
  watchouts?: string[];
};

export type SearchTermSummary = {
  spend: number;
  revenue: number;
  roas: number;
  zeroPurchaseSpend: number;
  killListSpend: number;
  clicks: number;
  terms: number;
};

export type SearchTermModel = {
  terms: SearchTermRow[];
  categories: CategoryCard[];
  ngrams: Record<string, unknown>[];
  recommendations: Record<string, unknown>[];
  aiBrain: AiBrainResponse | null;
  summary: SearchTermSummary;
};

export type AnalyzeResponse = Record<string, unknown>;
