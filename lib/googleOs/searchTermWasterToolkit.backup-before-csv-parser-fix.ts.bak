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

function parseCsvLine(line: string) {
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

    if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
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

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

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
  const cleaned = String(value || "")
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const n = Number(cleaned || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const parts = raw.split(/[/-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4) {
      return `${c}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }
  }

  return raw;
}

export function normalizeUploadedSearchTermRows(rawRows: Record<string, string>[]): SearchTermRawRow[] {
  return rawRows
    .map((row) => {
      const cost = num(pick(row, ["Cost", "Cost (INR)", "Spend", "Amount spent"]));
      const clicks = num(pick(row, ["Clicks"]));
      const impressions = num(pick(row, ["Impr.", "Impressions"]));
      const conversions = num(pick(row, ["Conversions", "Conv.", "Purchases"]));
      const conversionValue = num(pick(row, ["Conv. value", "Conversion value", "Revenue", "Purchase value"]));

      return {
        date: normalizeDate(pick(row, ["Date", "Day"])),
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
          "Search query",
          "Search Query",
          "Query",
          "User search term",
          "Customer search term",
          "Matched search term",
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
