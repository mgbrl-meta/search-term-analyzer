export type Tier = 'Star' | 'Solid' | 'Weak' | 'Drain' | 'Untested';
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Summary {
  unique_terms: number;
  total_impressions: number;
  total_clicks: number;
  total_cost: number;
  total_conversions: number;
  total_revenue: number;
  blended_roas: number;
  blended_ctr: number;
  blended_cvr: number;
  blended_cpa: number;
  tier_counts: Record<string, number>;
}

export interface CategorySummary {
  category: string;
  terms: number;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  roas: number;
  ctr: number;
}

export interface IntentSummary {
  intent: string;
  terms: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  roas: number;
}

export interface Ngram {
  ngram: string;
  count: number;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  roas: number;
  ctr: number;
  cvr: number;
  cpa: number;
}

export interface Recommendation {
  id: string;
  priority: Priority;
  type: string;
  title: string;
  description: string;
  terms: string[];
  impact: number;
}

export interface Term {
  search_term: string;
  campaign: string;
  ad_group: string;
  match_type: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  cpc: number;
  conversions: number;
  cvr: number;
  conv_value: number;
  roas: number;
  cpa: number;
  tier: Tier;
  intent: string;
  category: string;
  quality_score: number;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

export interface NgramsResponse {
  '1': Ngram[];
  '2': Ngram[];
  '3': Ngram[];
}

export interface AnalyzeResponse {
  session_id: string;
  summary: Summary;
  category_summary: CategorySummary[];
  intent_summary: IntentSummary[];
  ngrams: NgramsResponse;
  recommendations: Recommendation[];
  terms: Term[];
  pagination: Pagination;
}

export interface TermsResponse {
  terms: Term[];
  pagination: Pagination;
}

export interface TermsQuery {
  session_id: string;
  page?: number;
  per_page?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  tier?: string;
  intent?: string;
  category?: string;
  q?: string;
}

export interface HealthResponse {
  status: string;
}
