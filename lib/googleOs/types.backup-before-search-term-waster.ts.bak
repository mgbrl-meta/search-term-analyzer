export type GoogleOsRow = {
  date: string;

  campaign: string;
  campaignId: string;
  campaignType: string;
  campaignStatus: string;

  adGroup: string;
  adGroupId: string;
  adGroupStatus: string;
  adGroupType: string;

  avgCpc: number;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;

  conversions: number;
  conversionValue: number;
  roas: number;
  cpa: number;
  cvr: number;
  aov: number;

  allConversions: number;
  allConversionValue: number;

  searchImpressionShare: number;
  searchLostIsRank: number;
  searchTopIs: number;
  searchAbsTopIs: number;

  interactions: number;
  interactionRate: number;

  raw: Record<string, unknown>;
};

export type GoogleOsStatus =
  | "SCALE"
  | "KEEP"
  | "WATCH"
  | "REDUCE"
  | "PAUSE"
  | "INVESTIGATE";

export type GoogleOsGroupRow = {
  key: string;
  label: string;

  campaign?: string;
  campaignId?: string;
  campaignType?: string;
  campaignStatus?: string;

  adGroup?: string;
  adGroupId?: string;
  adGroupStatus?: string;

  dates: string[];

  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpc: number;

  conversions: number;
  conversionValue: number;
  roas: number;
  cpa: number;
  cvr: number;
  aov: number;

  spendShare: number;

  yesterdayCost: number;
  previousCost: number;
  costDodPct: number;

  yesterdayRevenue: number;
  previousRevenue: number;
  revenueDodPct: number;

  yesterdayRoas: number;
  previousRoas: number;
  roasDodPct: number;

  yesterdayCtr: number;
  previousCtr: number;
  ctrDodPct: number;

  yesterdayCvr: number;
  previousCvr: number;
  cvrDodPct: number;

  yesterdayCpc: number;
  previousCpc: number;
  cpcDodPct: number;

  status: GoogleOsStatus;
  action: string;
  reason: string;
};

export type GoogleOsSummary = {
  startDate: string;
  endDate: string;
  days: number;

  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpc: number;

  conversions: number;
  conversionValue: number;
  roas: number;
  cpa: number;
  cvr: number;
  aov: number;

  yesterdayCost: number;
  previousCost: number;
  costDodPct: number;

  yesterdayRevenue: number;
  previousRevenue: number;
  revenueDodPct: number;

  yesterdayRoas: number;
  previousRoas: number;
  roasDodPct: number;

  biggestIssue: string;
  immediateAction: string;
  budgetRecommendation: string;
};

export type GoogleOsModel = {
  rows: GoogleOsRow[];
  campaigns: GoogleOsGroupRow[];
  adGroups: GoogleOsGroupRow[];
  summary: GoogleOsSummary;
};

export type GoogleOsSettings = {
  recoveryRoas: number;
  targetRoas: number;
  scaleRoas: number;

  minSpendForAction: number;
  zeroConversionPauseSpend: number;
  hardCutSpend: number;

  budgetBelow1Roas: number;
  budget1To2Roas: number;
  budget2To3Roas: number;
  budget3PlusRoas: number;
  budget4PlusRoas: number;
};
