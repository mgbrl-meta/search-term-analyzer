import type { GoogleOsRow } from "@/lib/googleOs/types";

export type NegativeMatchType = "exact" | "phrase" | "broad";

export type SearchTermMode =
  | "all_waste"
  | "spend_waste"
  | "click_waste"
  | "low_roas"
  | "high_cpa"
  | "intent_mismatch"
  | "positive_keywords";

export type SearchTermSettings = {
  minSpend: number;
  minClicks: number;
  targetRoas: number;
  maxCpa: number;
  minImpressions: number;
  minCtr: number;
  minPositivePurchases: number;
  defaultMatchType: NegativeMatchType;
  brandTerms: string[];
  protectedTerms: string[];
  badIntentWords: string[];
  marketplaceWords: string[];
};

export type SearchTermRawRow = {
  date: string;
  campaign: string;
  campaignId: string;
  campaignType: string;
  campaignStatus: string;
  adGroup: string;
  adGroupId: string;
  adGroupStatus: string;
  searchTerm: string;
  keyword: string;
  keywordMatchType: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
};

export type SearchTermWasterRow = {
  id: string;
  searchTerm: string;
  campaign: string;
  campaignId: string;
  campaignType: string;
  adGroup: string;
  adGroupId: string;
  keyword: string;
  keywordMatchType: string;
  spend: number;
  revenue: number;
  purchases: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cvr: number;
  roas: number;
  cpa: number;
  wasteReason: string;
  recommendation: string;
  negativeMatchType: NegativeMatchType;
  exactSyntax: string;
  phraseSyntax: string;
  broadSyntax: string;
  isProtected: boolean;
};

export const DEFAULT_SEARCH_TERM_SETTINGS: SearchTermSettings = {
  minSpend: 500,
  minClicks: 20,
  targetRoas: 2,
  maxCpa: 600,
  minImpressions: 100,
  minCtr: 0.005,
  minPositivePurchases: 2,
  defaultMatchType: "exact",
  brandTerms: ["brillare", "brillare science", "oil shots", "rosemary oil shots"],
  protectedTerms: ["rosemary", "hair fall", "dandruff", "hair growth", "scalp"],
  badIntentWords: [
    "free",
    "job",
    "jobs",
    "salary",
    "wholesale",
    "supplier",
    "distributor",
    "meaning",
    "definition",
    "pdf",
    "side effects",
    "review",
    "reviews",
    "near me",
    "how to",
    "home remedy",
    "homemade",
  ],
  marketplaceWords: ["amazon", "flipkart", "nykaa", "meesho", "myntra", "zepto", "blinkit"],
};

function normalizeHeader(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectDelimiter(headerLine: string) {
  const candidates = [",", "\t", ";"];
  let best = ",";
  let bestCount = 0;

  candidates.forEach((delimiter) => {
    const count = headerLine.split(delimiter).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  });

  return best;
}

function parseDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function looksLikeSearchTermHeader(headers: string[]) {
  const normalized = headers.map(normalizeHeader);

  const hasSearchTerm = normalized.some((header) =>
    ["search_term", "search_terms", "search_query", "query", "customer_search_term", "user_search_term"].includes(header)
  );

  const hasCampaign = normalized.some((header) =>
    ["campaign", "campaign_name"].includes(header)
  );

  const hasCost = normalized.some((header) =>
    ["cost", "spend", "amount_spent", "cost_inr"].includes(header)
  );

  const hasClicks = normalized.includes("clicks");
  const hasImpressions = normalized.includes("impr") || normalized.includes("impressions");

  return hasSearchTerm && hasCampaign && hasCost && (hasClicks || hasImpressions);
}

export function parseCsvText(csvText: string) {
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return [];
  }

  let headerLineIndex = 0;
  let delimiter = ",";
  let originalHeaders: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 20); i += 1) {
    const testDelimiter = detectDelimiter(lines[i]);
    const candidateHeaders = parseDelimitedLine(lines[i], testDelimiter);

    if (looksLikeSearchTermHeader(candidateHeaders)) {
      headerLineIndex = i;
      delimiter = testDelimiter;
      originalHeaders = candidateHeaders;
      break;
    }
  }

  // Fallback: if no proper header detected, use first row.
  if (!originalHeaders.length) {
    delimiter = detectDelimiter(lines[0]);
    originalHeaders = parseDelimitedLine(lines[0], delimiter);
  }

  const headers = originalHeaders.map(normalizeHeader);

  return lines.slice(headerLineIndex + 1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    const row: Record<string, string> = {
      __detected_delimiter: delimiter === "\t" ? "tab" : delimiter,
      __detected_headers: originalHeaders.join(" | "),
      __header_line_index: String(headerLineIndex),
    };

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    return row;
  });
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    if (row[normalized] !== undefined && row[normalized] !== "") return row[normalized];
  }

  return "";
}

function num(value: unknown) {
  const raw = String(value || "").trim();

  // Handles ₹1,234.56, 1,234.56, 12.34%, and Google Ads blanks.
  const cleaned = raw
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/--/g, "0")
    .trim();

  const n = Number(cleaned || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Handles DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY, Google Ads textual dates.
  const parts = raw.split(/[/-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map((x) => x.trim());

    if (c.length === 4) {
      const first = Number(a);
      const second = Number(b);

      // India/Google Ads usually exports DD/MM/YYYY. If first > 12, definitely DD/MM.
      if (first > 12) {
        return `${c}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
      }

      // Safe default: DD/MM/YYYY for Indian account exports.
      return `${c}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
    }
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return raw;
}

export function normalizeUploadedSearchTermRows(rawRows: Record<string, string>[]): SearchTermRawRow[] {
  return rawRows
    .map((row) => {
      const cost = num(pick(row, ["Cost", "Cost (INR)", "Spend", "Amount spent", "Amount Spent"]));
      const clicks = num(pick(row, ["Clicks", "Interactions"]));
      const impressions = num(pick(row, ["Impr.", "Impressions", "Impr"]));
      const conversions = num(pick(row, ["Conversions", "Conv.", "Purchases", "Purchase", "Orders"]));
      const conversionValue = num(pick(row, ["Conv. value", "Conversion value", "Revenue", "Purchase value", "Conversion Value", "Conv value"]));

      return {
        date: normalizeDate(pick(row, ["Date", "Day", "Date range"])),
        campaign: pick(row, ["Campaign", "Campaign name"]),
        campaignId: pick(row, ["Campaign ID", "Campaign id"]),
        campaignType: pick(row, ["Campaign type", "Advertising channel type", "Channel type"]),
        campaignStatus: pick(row, ["Campaign status", "Campaign state"]),
        adGroup: pick(row, ["Ad group", "Ad group name"]),
        adGroupId: pick(row, ["Ad group ID", "Ad group id"]),
        adGroupStatus: pick(row, ["Ad group status", "Ad group state"]),
        searchTerm: cleanTerm(pick(row, [
          "Search term",
          "Search Term",
          "Search terms",
          "Search query",
          "Search Query",
          "Query",
          "User search term",
          "Customer search term",
          "Matched search term",
          "Customer search query",
          "Search term text"
        ])),
        keyword: pick(row, ["Keyword", "Keyword text", "Keyword Text", "Matched keyword"]),
        keywordMatchType: pick(row, ["Keyword match type", "Match type", "Search term match type"]),
        cost,
        clicks,
        impressions,
        conversions,
        conversionValue,
      };
    })
    .filter((row) => row.searchTerm && (row.cost > 0 || row.clicks > 0 || row.impressions > 0));
}

export function convertSearchTermRawRowsToGoogleRows(rows: SearchTermRawRow[]): GoogleOsRow[] {
  return rows.map((row) => {
    const ctr = safeDiv(row.clicks, row.impressions);
    const cpc = safeDiv(row.cost, row.clicks);
    const cpa = safeDiv(row.cost, row.conversions);
    const cvr = safeDiv(row.conversions, row.clicks);
    const roas = safeDiv(row.conversionValue, row.cost);
    const aov = safeDiv(row.conversionValue, row.conversions);

    return {
      date: row.date,

      campaign: row.campaign,
      campaignId: row.campaignId,
      campaignType: row.campaignType,
      campaignStatus: row.campaignStatus,
      budget: 0,

      adGroup: row.adGroup,
      adGroupId: row.adGroupId,
      adGroupStatus: row.adGroupStatus,
      adGroupType: "",

      searchTerm: row.searchTerm,
      keyword: row.keyword,
      keywordMatchType: row.keywordMatchType,
      queryMatchType: row.keywordMatchType,

      impressions: row.impressions,
      clicks: row.clicks,
      interactions: row.clicks,
      interactionRate: ctr,

      cost: row.cost,
      avgCpc: cpc,
      cpc,

      conversions: row.conversions,
      conversionValue: row.conversionValue,
      allConversions: row.conversions,
      allConversionValue: row.conversionValue,
      viewThroughConversions: 0,

      ctr,
      cpa,
      costPerConversion: cpa,
      cvr,
      conversionRate: cvr,
      roas,
      aov,

      searchImpressionShare: 0,
      searchLostIsRank: 0,
      searchTopIs: 0,
      searchAbsTopIs: 0,

      raw: {
        source: "search-term-csv-upload",
        date: row.date,
        campaign: row.campaign,
        campaignId: row.campaignId,
        campaignType: row.campaignType,
        campaignStatus: row.campaignStatus,
        adGroup: row.adGroup,
        adGroupId: row.adGroupId,
        adGroupStatus: row.adGroupStatus,
        searchTerm: row.searchTerm,
        keyword: row.keyword,
        keywordMatchType: row.keywordMatchType,
        cost: row.cost,
        clicks: row.clicks,
        impressions: row.impressions,
        conversions: row.conversions,
        conversionValue: row.conversionValue,
      },
    };
  });
}

function read(row: GoogleOsRow, key: string) {
  return String((row as unknown as Record<string, unknown>)[key] || "");
}

export function safeDiv(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

export function cleanTerm(term: string) {
  return term.trim().replace(/\s+/g, " ");
}

export function exactSyntax(term: string) {
  return `[${cleanTerm(term)}]`;
}

export function phraseSyntax(term: string) {
  return `"${cleanTerm(term)}"`;
}

export function broadSyntax(term: string) {
  return cleanTerm(term);
}

export function formatMoney(value: number) {
  const abs = Math.abs(value);

  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(value / 1000).toFixed(1)}K`;

  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatX(value: number) {
  return `${value.toFixed(2)}x`;
}

export function getSearchTerm(row: GoogleOsRow) {
  return cleanTerm(
    row.searchTerm ||
      read(row, "search_term") ||
      read(row, "search query") ||
      read(row, "Search term") ||
      read(row, "Search Term") ||
      read(row, "Query")
  );
}

function includesAny(term: string, words: string[]) {
  const lower = term.toLowerCase();
  return words.some((word) => word && lower.includes(word.toLowerCase()));
}

function getMatchType(row: GoogleOsRow) {
  return row.keywordMatchType || row.queryMatchType || read(row, "matchType") || read(row, "match_type") || "";
}

export function aggregateSearchTerms(rows: GoogleOsRow[], settings: SearchTermSettings): SearchTermWasterRow[] {
  const groups = new Map<string, GoogleOsRow[]>();

  rows.forEach((row) => {
    const searchTerm = getSearchTerm(row);
    if (!searchTerm) return;

    const campaign = row.campaign || read(row, "campaignName") || "Unknown Campaign";
    const adGroup = row.adGroup || read(row, "adGroupName") || "Unknown Ad Group";
    const key = `${searchTerm}::${campaign}::${adGroup}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries())
    .map(([id, termRows]) => {
      const first = termRows[0];
      const searchTerm = getSearchTerm(first);
      const spend = termRows.reduce((sum, row) => sum + num(row.cost), 0);
      const revenue = termRows.reduce((sum, row) => sum + num(row.conversionValue), 0);
      const purchases = termRows.reduce((sum, row) => sum + num(row.conversions), 0);
      const clicks = termRows.reduce((sum, row) => sum + num(row.clicks), 0);
      const impressions = termRows.reduce((sum, row) => sum + num(row.impressions), 0);

      const ctr = safeDiv(clicks, impressions);
      const cvr = safeDiv(purchases, clicks);
      const roas = safeDiv(revenue, spend);
      const cpa = safeDiv(spend, purchases);

      const isBrand = includesAny(searchTerm, settings.brandTerms);
      const isProtected = isBrand || includesAny(searchTerm, settings.protectedTerms);
      const badIntent = includesAny(searchTerm, settings.badIntentWords);
      const marketplace = includesAny(searchTerm, settings.marketplaceWords);

      let recommendation = "WATCH";
      let wasteReason = "No clear waste rule triggered.";
      let negativeMatchType: NegativeMatchType = settings.defaultMatchType;

      if (isProtected && purchases > 0) {
        recommendation = "PROTECT";
        wasteReason = "Protected brand/product term with conversion history.";
        negativeMatchType = "exact";
      } else if (purchases >= settings.minPositivePurchases && roas >= settings.targetRoas) {
        recommendation = "PROMOTE TO KEYWORD";
        wasteReason = "Profitable search term. Consider adding as exact/phrase keyword.";
        negativeMatchType = "exact";
      } else if ((badIntent || marketplace) && spend >= settings.minSpend) {
        recommendation = "NEGATIVE PHRASE";
        wasteReason = badIntent ? "Intent mismatch term wasting spend." : "Marketplace/competitor leakage term wasting spend.";
        negativeMatchType = "phrase";
      } else if (spend >= settings.minSpend && purchases === 0) {
        recommendation = "NEGATIVE EXACT";
        wasteReason = "Spend above threshold with zero purchases.";
        negativeMatchType = "exact";
      } else if (clicks >= settings.minClicks && purchases === 0) {
        recommendation = "NEGATIVE EXACT";
        wasteReason = "Clicks above threshold with zero purchases.";
        negativeMatchType = "exact";
      } else if (purchases > 0 && roas < settings.targetRoas) {
        recommendation = "BID DOWN / ISOLATE";
        wasteReason = "Has purchases but ROAS below target.";
        negativeMatchType = "exact";
      } else if (purchases > 0 && cpa > settings.maxCpa) {
        recommendation = "BID DOWN";
        wasteReason = "CPA above maximum threshold.";
        negativeMatchType = "exact";
      } else if (impressions >= settings.minImpressions && ctr < settings.minCtr) {
        recommendation = "INVESTIGATE";
        wasteReason = "High impressions with low CTR.";
        negativeMatchType = "exact";
      }

      return {
        id,
        searchTerm,
        campaign: first.campaign || read(first, "campaignName") || "Unknown Campaign",
        campaignId: first.campaignId || "",
        campaignType: first.campaignType || "",
        adGroup: first.adGroup || read(first, "adGroupName") || "Unknown Ad Group",
        adGroupId: first.adGroupId || "",
        keyword: first.keyword || "",
        keywordMatchType: getMatchType(first),
        spend,
        revenue,
        purchases,
        clicks,
        impressions,
        ctr,
        cvr,
        roas,
        cpa,
        wasteReason,
        recommendation,
        negativeMatchType,
        exactSyntax: exactSyntax(searchTerm),
        phraseSyntax: phraseSyntax(searchTerm),
        broadSyntax: broadSyntax(searchTerm),
        isProtected,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

export function filterSearchTermRows({
  rows,
  mode,
  minSpend,
  minClicks,
  targetRoas,
  maxCpa,
  contains,
  campaign,
  matchType,
}: {
  rows: SearchTermWasterRow[];
  mode: SearchTermMode;
  minSpend: number;
  minClicks: number;
  targetRoas: number;
  maxCpa: number;
  contains: string;
  campaign: string;
  matchType: NegativeMatchType | "all";
}) {
  const q = contains.trim().toLowerCase();

  return rows.filter((row) => {
    if (q && !row.searchTerm.toLowerCase().includes(q)) return false;
    if (campaign !== "all" && row.campaign !== campaign) return false;
    if (matchType !== "all" && row.negativeMatchType !== matchType) return false;

    if (mode === "spend_waste") return row.spend >= minSpend && row.purchases === 0;
    if (mode === "click_waste") return row.clicks >= minClicks && row.purchases === 0;
    if (mode === "low_roas") return row.purchases > 0 && row.roas < targetRoas;
    if (mode === "high_cpa") return row.purchases > 0 && row.cpa > maxCpa;
    if (mode === "intent_mismatch") return row.recommendation.includes("NEGATIVE PHRASE");
    if (mode === "positive_keywords") return row.recommendation === "PROMOTE TO KEYWORD";

    return row.recommendation !== "PROTECT" && row.recommendation !== "WATCH";
  });
}

export function buildSearchTermSummary(rows: SearchTermWasterRow[]) {
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const wastedRows = rows.filter((row) =>
    ["NEGATIVE EXACT", "NEGATIVE PHRASE", "BID DOWN / ISOLATE", "BID DOWN"].includes(row.recommendation)
  );
  const wastedSpend = wastedRows.reduce((sum, row) => sum + row.spend, 0);

  return {
    totalTerms: rows.length,
    totalSpend,
    wastedTerms: wastedRows.length,
    wastedSpend,
    wasteShare: safeDiv(wastedSpend, totalSpend),
    zeroSaleTerms: rows.filter((row) => row.spend > 0 && row.purchases === 0).length,
    highClickZeroSaleTerms: rows.filter((row) => row.clicks > 0 && row.purchases === 0).length,
    negativeCandidates: rows.filter((row) => row.recommendation.includes("NEGATIVE")).length,
    positiveCandidates: rows.filter((row) => row.recommendation === "PROMOTE TO KEYWORD").length,
  };
}

export function escapeCsv(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildSearchTermCsv(rows: SearchTermWasterRow[]) {
  const headers = [
    "Search Term",
    "Campaign",
    "Ad Group",
    "Spend",
    "Clicks",
    "Impressions",
    "CTR",
    "Purchases",
    "Revenue",
    "ROAS",
    "CPA",
    "Waste Reason",
    "Recommendation",
    "Negative Match Type",
    "Exact Syntax",
    "Phrase Syntax",
    "Broad Syntax",
  ];

  const lines = rows.map((row) => [
    row.searchTerm,
    row.campaign,
    row.adGroup,
    row.spend,
    row.clicks,
    row.impressions,
    formatPercent(row.ctr),
    row.purchases,
    row.revenue,
    formatX(row.roas),
    row.cpa,
    row.wasteReason,
    row.recommendation,
    row.negativeMatchType,
    row.exactSyntax,
    row.phraseSyntax,
    row.broadSyntax,
  ]);

  return [headers, ...lines]
    .map((line) => line.map(escapeCsv).join(","))
    .join("\n");
}

/* =========================================================
   SEARCH TERM WASTER — DYNAMIC HEADS + N-GRAM TOOLKIT
   ========================================================= */

export type SearchTermHeadKey =
  | "click_zero_purchase"
  | "spend_zero_purchase"
  | "high_spend_low_roas"
  | "high_cpa"
  | "high_impression_low_ctr"
  | "intent_mismatch"
  | "marketplace_leakage"
  | "phrase_waster"
  | "repeat_waster"
  | "positive_keywords"
  | "protected_terms";

export type SearchTermDynamicRules = {
  clickWasteClicks: number;
  spendWasteAmount: number;
  lowRoasSpend: number;
  lowRoasTarget: number;
  highCpaAmount: number;
  lowCtrImpressions: number;
  lowCtrPercent: number;
  phraseMinWords: number;
  phraseMaxWords: number;
  phraseMinTerms: number;
  phraseMinSpend: number;
  repeatMinCampaigns: number;
  repeatMinSpend: number;
  positivePurchases: number;
  positiveRoas: number;
};

export type SearchTermAnalysisHead = {
  key: SearchTermHeadKey;
  title: string;
  subtitle: string;
  action: string;
  risk: "High" | "Medium" | "Low" | "Protect" | "Opportunity";
  rows: SearchTermWasterRow[];
  totalSpend: number;
  totalRevenue: number;
  purchases: number;
};

export type PhraseWasterGroup = {
  phrase: string;
  rows: SearchTermWasterRow[];
  totalSpend: number;
  totalClicks: number;
  totalPurchases: number;
  totalRevenue: number;
  roas: number;
};

export const DEFAULT_SEARCH_TERM_DYNAMIC_RULES: SearchTermDynamicRules = {
  clickWasteClicks: 10,
  spendWasteAmount: 500,
  lowRoasSpend: 500,
  lowRoasTarget: 2,
  highCpaAmount: 600,
  lowCtrImpressions: 500,
  lowCtrPercent: 1,
  phraseMinWords: 2,
  phraseMaxWords: 3,
  phraseMinTerms: 3,
  phraseMinSpend: 1000,
  repeatMinCampaigns: 2,
  repeatMinSpend: 500,
  positivePurchases: 2,
  positiveRoas: 2,
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "best",
  "buy",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "near",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "without",
]);

export function getSearchTermRisk(row: SearchTermWasterRow, rules: SearchTermDynamicRules) {
  if (row.isProtected || row.recommendation === "PROTECT") return "Protect";
  if (row.purchases >= rules.positivePurchases && row.roas >= rules.positiveRoas) return "Opportunity";
  if (row.spend >= rules.spendWasteAmount * 2 && row.purchases === 0) return "High";
  if (row.spend >= rules.spendWasteAmount && row.purchases === 0) return "Medium";
  if (row.clicks >= rules.clickWasteClicks && row.purchases === 0) return "Low";
  return "Low";
}

export function buildTermNgrams(term: string, minWords: number, maxWords: number) {
  const words = cleanTerm(term)
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word && !STOP_WORDS.has(word));

  const ngrams: string[] = [];

  for (let size = minWords; size <= maxWords; size += 1) {
    for (let i = 0; i <= words.length - size; i += 1) {
      ngrams.push(words.slice(i, i + size).join(" "));
    }
  }

  return Array.from(new Set(ngrams));
}

export function buildPhraseWasterGroups(rows: SearchTermWasterRow[], rules: SearchTermDynamicRules): PhraseWasterGroup[] {
  const map = new Map<string, SearchTermWasterRow[]>();

  rows.forEach((row) => {
    if (row.purchases > 0 || row.isProtected) return;

    const phrases = buildTermNgrams(row.searchTerm, rules.phraseMinWords, rules.phraseMaxWords);

    phrases.forEach((phrase) => {
      if (!map.has(phrase)) map.set(phrase, []);
      map.get(phrase)!.push(row);
    });
  });

  return Array.from(map.entries())
    .map(([phrase, phraseRows]) => {
      const uniqueRows = Array.from(new Map(phraseRows.map((row) => [row.id, row])).values());
      const totalSpend = uniqueRows.reduce((sum, row) => sum + row.spend, 0);
      const totalClicks = uniqueRows.reduce((sum, row) => sum + row.clicks, 0);
      const totalPurchases = uniqueRows.reduce((sum, row) => sum + row.purchases, 0);
      const totalRevenue = uniqueRows.reduce((sum, row) => sum + row.revenue, 0);

      return {
        phrase,
        rows: uniqueRows,
        totalSpend,
        totalClicks,
        totalPurchases,
        totalRevenue,
        roas: safeDiv(totalRevenue, totalSpend),
      };
    })
    .filter((group) => {
      return group.rows.length >= rules.phraseMinTerms && group.totalSpend >= rules.phraseMinSpend && group.totalPurchases === 0;
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

export function buildRepeatWasterRows(rows: SearchTermWasterRow[], rules: SearchTermDynamicRules) {
  const map = new Map<string, SearchTermWasterRow[]>();

  rows.forEach((row) => {
    if (row.purchases > 0 || row.isProtected) return;

    const key = row.searchTerm.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  });

  const repeatedIds = new Set<string>();

  Array.from(map.values()).forEach((termRows) => {
    const campaigns = new Set(termRows.map((row) => row.campaign));
    const spend = termRows.reduce((sum, row) => sum + row.spend, 0);

    if (campaigns.size >= rules.repeatMinCampaigns && spend >= rules.repeatMinSpend) {
      termRows.forEach((row) => repeatedIds.add(row.id));
    }
  });

  return rows.filter((row) => repeatedIds.has(row.id)).sort((a, b) => b.spend - a.spend);
}

export function buildSearchTermAnalysisHeads(
  rows: SearchTermWasterRow[],
  rules: SearchTermDynamicRules,
  settings: SearchTermSettings
): SearchTermAnalysisHead[] {
  const badIntentRows = rows.filter((row) => {
    const term = row.searchTerm.toLowerCase();
    return settings.badIntentWords.some((word) => term.includes(word.toLowerCase())) && !row.isProtected;
  });

  const marketplaceRows = rows.filter((row) => {
    const term = row.searchTerm.toLowerCase();
    return settings.marketplaceWords.some((word) => term.includes(word.toLowerCase())) && !row.isProtected;
  });

  const phraseGroups = buildPhraseWasterGroups(rows, rules);
  const phraseRows = Array.from(
    new Map(phraseGroups.flatMap((group) => group.rows).map((row) => [row.id, row])).values()
  ).sort((a, b) => b.spend - a.spend);

  const heads: Omit<SearchTermAnalysisHead, "totalSpend" | "totalRevenue" | "purchases">[] = [
    {
      key: "click_zero_purchase",
      title: `More than ${rules.clickWasteClicks} clicks, 0 purchase`,
      subtitle: "Search terms consuming clicks without generating purchases.",
      action: "Exact negative / investigate before adding negative if term is strategic.",
      risk: "Medium",
      rows: rows.filter((row) => row.clicks >= rules.clickWasteClicks && row.purchases === 0 && !row.isProtected),
    },
    {
      key: "spend_zero_purchase",
      title: `More than ₹${rules.spendWasteAmount}, 0 purchase`,
      subtitle: "Search terms spending above threshold with no conversion output.",
      action: "Exact negative. Phrase negative if repeated pattern appears.",
      risk: "High",
      rows: rows.filter((row) => row.spend >= rules.spendWasteAmount && row.purchases === 0 && !row.isProtected),
    },
    {
      key: "high_spend_low_roas",
      title: `Spend > ₹${rules.lowRoasSpend}, ROAS < ${rules.lowRoasTarget}x`,
      subtitle: "Terms that convert but below efficiency threshold.",
      action: "Bid down, isolate into exact campaign, or review landing-page intent.",
      risk: "Medium",
      rows: rows.filter((row) => row.spend >= rules.lowRoasSpend && row.purchases > 0 && row.roas < rules.lowRoasTarget && !row.isProtected),
    },
    {
      key: "high_cpa",
      title: `CPA above ₹${rules.highCpaAmount}`,
      subtitle: "Converted terms with acquisition cost above target.",
      action: "Bid down or isolate. Do not negative if strategically important.",
      risk: "Medium",
      rows: rows.filter((row) => row.purchases > 0 && row.cpa > rules.highCpaAmount && !row.isProtected),
    },
    {
      key: "high_impression_low_ctr",
      title: `Impressions > ${rules.lowCtrImpressions}, CTR < ${rules.lowCtrPercent}%`,
      subtitle: "High visibility but poor search intent or weak relevance.",
      action: "Review ad relevance. Negative if term is irrelevant.",
      risk: "Low",
      rows: rows.filter((row) => row.impressions >= rules.lowCtrImpressions && row.ctr < rules.lowCtrPercent / 100 && !row.isProtected),
    },
    {
      key: "intent_mismatch",
      title: "Intent mismatch terms",
      subtitle: `Contains bad-intent words like ${settings.badIntentWords.slice(0, 6).join(", ")}.`,
      action: "Phrase negative unless it has profitable conversion history.",
      risk: "High",
      rows: badIntentRows,
    },
    {
      key: "marketplace_leakage",
      title: "Marketplace leakage terms",
      subtitle: `Contains marketplace words like ${settings.marketplaceWords.join(", ")}.`,
      action: "Phrase negative unless marketplace comparison terms are profitable.",
      risk: "Medium",
      rows: marketplaceRows,
    },
    {
      key: "phrase_waster",
      title: "Phrase wasters from n-gram analysis",
      subtitle: `Repeated ${rules.phraseMinWords}-${rules.phraseMaxWords} word phrases across ${rules.phraseMinTerms}+ terms with ₹${rules.phraseMinSpend}+ wasted spend.`,
      action: "Phrase negative candidate. Review rows before upload.",
      risk: "High",
      rows: phraseRows,
    },
    {
      key: "repeat_waster",
      title: `Repeat wasters across ${rules.repeatMinCampaigns}+ campaigns`,
      subtitle: "Same search term wasting spend across multiple campaigns/ad groups.",
      action: "Account-level negative exact or phrase depending on pattern.",
      risk: "High",
      rows: buildRepeatWasterRows(rows, rules),
    },
    {
      key: "positive_keywords",
      title: `Positive keyword candidates: ${rules.positivePurchases}+ purchases, ROAS > ${rules.positiveRoas}x`,
      subtitle: "Terms to promote into exact/phrase keywords.",
      action: "Add as exact keyword or isolate into high-intent ad group.",
      risk: "Opportunity",
      rows: rows.filter((row) => row.purchases >= rules.positivePurchases && row.roas >= rules.positiveRoas),
    },
    {
      key: "protected_terms",
      title: "Protected brand/product terms",
      subtitle: "Terms that should not be blindly added as negatives.",
      action: "Protect. Review separately for bid strategy.",
      risk: "Protect",
      rows: rows.filter((row) => row.isProtected || row.recommendation === "PROTECT"),
    },
  ];

  return heads
    .map((head) => ({
      ...head,
      rows: head.rows.sort((a, b) => b.spend - a.spend),
      totalSpend: head.rows.reduce((sum, row) => sum + row.spend, 0),
      totalRevenue: head.rows.reduce((sum, row) => sum + row.revenue, 0),
      purchases: head.rows.reduce((sum, row) => sum + row.purchases, 0),
    }))
    .sort((a, b) => {
      const priority: Record<SearchTermHeadKey, number> = {
        spend_zero_purchase: 1,
        click_zero_purchase: 2,
        phrase_waster: 3,
        repeat_waster: 4,
        intent_mismatch: 5,
        marketplace_leakage: 6,
        high_spend_low_roas: 7,
        high_cpa: 8,
        high_impression_low_ctr: 9,
        positive_keywords: 10,
        protected_terms: 11,
      };

      return priority[a.key] - priority[b.key];
    });
}

export function buildHeadCsv(head: SearchTermAnalysisHead) {
  return buildSearchTermCsv(head.rows);
}

export function buildHeadNegativeText(head: SearchTermAnalysisHead, matchType: NegativeMatchType) {
  return head.rows
    .map((row) => {
      if (matchType === "exact") return row.exactSyntax;
      if (matchType === "phrase") return row.phraseSyntax;
      return row.broadSyntax;
    })
    .join("\n");
}

export function buildPhraseWasterCsv(groups: PhraseWasterGroup[]) {
  const headers = [
    "Phrase",
    "Terms Count",
    "Total Spend",
    "Clicks",
    "Purchases",
    "Revenue",
    "ROAS",
    "Phrase Negative Syntax",
  ];

  const rows = groups.map((group) => [
    group.phrase,
    group.rows.length,
    group.totalSpend,
    group.totalClicks,
    group.totalPurchases,
    group.totalRevenue,
    formatX(group.roas),
    phraseSyntax(group.phrase),
  ]);

  return [headers, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n");
}
