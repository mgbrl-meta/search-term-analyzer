// types/analysis.ts — TypeScript interfaces matching the Python API response

export interface Thresholds {
  spend_threshold: number;
  clicks_threshold: number;
  target_roas: number;
  ngram_spend_threshold: number;
  ngram_clicks_threshold: number;
  campaign_filter: string;
}

export interface Summary {
  total_spend: number;
  total_clicks: number;
  total_impressions: number;
  total_purchases: number;
  total_conversions: number;
  total_conv_value: number;
  overall_roas: number;
  avg_cpc: number;
  cpa: number;
  wasted_spend: number;
  wasted_spend_pct: number;
  recommendation_count: number;
}

export interface CampaignRow {
  campaign: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  purchases: number;
  conversion_value: number;
  wasted_spend: number;
  ctr: number;
  avg_cpc: number;
  conversion_rate: number;
  cost_per_conv: number;
  cost_per_purchase: number;
  roas: number;
  risky_terms_count: number;
}

export interface AdGroupRow {
  campaign: string;
  ad_group: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  purchases: number;
  conversion_value: number;
  wasted_spend: number;
  ctr: number;
  avg_cpc: number;
  roas: number;
}

export interface SearchTermRow {
  campaign: string;
  ad_group: string;
  search_term: string;
  category: string;
  match_type: string;
  clicks: number;
  impressions: number;
  cost: number;
  purchases: number;
  conversions: number;
  conversion_value: number;
  ctr_calc: number;
  avg_cpc_calc: number;
  cost_per_purchase: number;
  roas_calc: number;
  wasted_spend: number;
}

export interface CategoryRow {
  category: string;
  category_label: string;
  term_count: number;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  conversions: number;
  conversion_value: number;
  wasted_spend: number;
  roas: number;
  spend_pct: number;
}

export interface NgramRow {
  ngram: string;
  gram_type: string;
  term_count: number;
  campaign_count: number;
  impressions: number;
  clicks: number;
  cost: number;
  purchases: number;
  conversions: number;
  conversion_value: number;
  avg_cpc: number;
  cpa: number;
  roas: number;
  conversion_rate: number;
  wasted_spend: number;
  flag: boolean;
  flag_reason: string;
}

export interface Recommendation {
  type: string;
  gram_type?: string;
  campaign: string;
  ad_group: string;
  keyword: string;
  category: string;
  match_type: string;
  broad: string;
  phrase: string;
  exact: string;
  clicks: number;
  cost: number;
  purchases: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  reason: string;
  confidence: "high" | "medium" | "low";
  action: string;
}

export interface Metadata {
  filename: string;
  total_rows: number;
  filtered_rows: number;
  campaigns: string[];
  has_dates: boolean;
  date_min: string | null;
  date_max: string | null;
  thresholds: Thresholds;
  warnings: string[];
}

export interface AnalysisResult {
  metadata: Metadata;
  summary: Summary;
  campaigns: CampaignRow[];
  ad_groups: AdGroupRow[];
  search_terms: SearchTermRow[];
  categories: CategoryRow[];
  ngrams: NgramRow[];
  recommendations: Recommendation[];
}
