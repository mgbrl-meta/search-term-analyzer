"""
exports.py — Export generation utilities.

Produces CSV strings (and optionally Excel bytes) for:
- Full analyzed search term report
- Negative keyword recommendations
- Broad / phrase / exact match export files
- N-gram analysis report
- Daily operator report
"""

import io
import csv
from datetime import datetime
from typing import Any, Dict, List

import pandas as pd


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _df_to_csv_string(df: pd.DataFrame) -> str:
    """Return a DataFrame as a UTF-8 CSV string."""
    return df.to_csv(index=False, encoding="utf-8")


def _list_to_csv_string(rows: List[Dict], fieldnames: List[str]) -> str:
    """Convert a list of dicts to a CSV string with explicit column order."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


# ─── Search Term Report ───────────────────────────────────────────────────────

SEARCH_TERM_COLS = [
    "campaign", "ad_group", "search_term", "category", "match_type",
    "clicks", "impressions", "cost", "purchases", "conversions",
    "conversion_value", "ctr_calc", "avg_cpc_calc",
    "cost_per_purchase", "roas_calc", "wasted_spend",
]

def export_search_term_report(df: pd.DataFrame) -> str:
    """Full analyzed search term report as CSV."""
    cols = [c for c in SEARCH_TERM_COLS if c in df.columns]
    rename = {
        "ctr_calc":     "CTR",
        "avg_cpc_calc": "Avg CPC",
        "roas_calc":    "ROAS",
    }
    out = df[cols].rename(columns=rename)
    return _df_to_csv_string(out)


# ─── Negative Keyword Exports ─────────────────────────────────────────────────

NEG_FULL_COLS = [
    "type", "campaign", "ad_group", "keyword", "category",
    "match_type", "broad", "phrase", "exact",
    "clicks", "cost", "purchases", "conversions", "conversion_value",
    "roas", "confidence", "reason", "action",
]

def export_negative_recommendations(recs: List[Dict]) -> str:
    """Full negative keyword recommendation list as CSV."""
    return _list_to_csv_string(recs, NEG_FULL_COLS)


def export_broad_match_negatives(recs: List[Dict]) -> str:
    """Broad match negative keywords, one per line (no header — ready for Google Ads bulk upload)."""
    lines = ["Keyword"]
    for r in recs:
        if r.get("broad"):
            lines.append(r["broad"])
    return "\n".join(lines)


def export_phrase_match_negatives(recs: List[Dict]) -> str:
    """Phrase match negative keywords with quotes."""
    lines = ["Keyword"]
    for r in recs:
        if r.get("phrase"):
            lines.append(r["phrase"])
    return "\n".join(lines)


def export_exact_match_negatives(recs: List[Dict]) -> str:
    """Exact match negative keywords with brackets."""
    lines = ["Keyword"]
    for r in recs:
        if r.get("exact"):
            lines.append(r["exact"])
    return "\n".join(lines)


# ─── N-gram Export ────────────────────────────────────────────────────────────

NGRAM_COLS = [
    "ngram", "gram_type", "term_count", "campaign_count",
    "impressions", "clicks", "cost", "purchases", "conversions",
    "conversion_value", "avg_cpc", "cpa", "roas", "conversion_rate",
    "wasted_spend", "flag", "flag_reason",
]

def export_ngram_report(ngram_df: pd.DataFrame) -> str:
    """N-gram analysis report as CSV."""
    cols = [c for c in NGRAM_COLS if c in ngram_df.columns]
    return _df_to_csv_string(ngram_df[cols])


# ─── Daily Operator Report ────────────────────────────────────────────────────

def export_daily_report(
    summary: Dict[str, Any],
    search_term_df: pd.DataFrame,
    ngram_df: pd.DataFrame,
    recommendations: List[Dict],
    thresholds: Dict[str, Any],
    campaign_filter: str = "All",
) -> str:
    """
    Produce a comprehensive daily operator report as a multi-section CSV.

    Sections:
    1. Report metadata
    2. Summary KPIs
    3. High-click, no-purchase terms
    4. High-spend, no-purchase terms
    5. Poor-performing n-grams
    6. Recommended negatives
    """
    spend_threshold  = thresholds.get("spend_threshold",  1000)
    clicks_threshold = thresholds.get("clicks_threshold", 20)

    sections = []

    # ── Section 1: Metadata ──
    sections.append("=== DAILY REPORT METADATA ===")
    sections.append(f"Report Date,{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    sections.append(f"Campaign Filter,{campaign_filter}")
    sections.append(f"High Clicks Threshold,{clicks_threshold}")
    sections.append(f"High Spend Threshold,{spend_threshold}")
    sections.append(f"Target ROAS,{thresholds.get('target_roas', 2.0)}")
    sections.append("")

    # ── Section 2: Summary ──
    sections.append("=== SUMMARY KPIs ===")
    for k, v in summary.items():
        sections.append(f"{k},{v}")
    sections.append("")

    # ── Section 3: High clicks, no purchase ──
    sections.append("=== SEARCH TERMS: HIGH CLICKS, NO PURCHASE ===")
    mask = (search_term_df["clicks"] >= clicks_threshold) & (search_term_df["purchases"] == 0)
    high_clicks = search_term_df[mask].sort_values("clicks", ascending=False)
    if high_clicks.empty:
        sections.append("None found")
    else:
        cols = ["campaign", "ad_group", "search_term", "category", "clicks", "cost", "purchases"]
        cols = [c for c in cols if c in high_clicks.columns]
        sections.append(",".join(cols))
        for _, row in high_clicks[cols].iterrows():
            sections.append(",".join(str(row[c]) for c in cols))
    sections.append("")

    # ── Section 4: High spend, no purchase ──
    sections.append("=== SEARCH TERMS: HIGH SPEND, NO PURCHASE ===")
    mask2 = (search_term_df["cost"] >= spend_threshold) & (search_term_df["purchases"] == 0)
    high_spend = search_term_df[mask2].sort_values("cost", ascending=False)
    if high_spend.empty:
        sections.append("None found")
    else:
        cols = ["campaign", "ad_group", "search_term", "category", "clicks", "cost", "purchases"]
        cols = [c for c in cols if c in high_spend.columns]
        sections.append(",".join(cols))
        for _, row in high_spend[cols].iterrows():
            sections.append(",".join(str(row[c]) for c in cols))
    sections.append("")

    # ── Section 5: Poor n-grams ──
    sections.append("=== POOR-PERFORMING N-GRAMS ===")
    poor_ngrams = ngram_df[ngram_df.get("flag", False) == True] if not ngram_df.empty else pd.DataFrame()
    if poor_ngrams.empty:
        sections.append("None found")
    else:
        cols = ["ngram", "gram_type", "clicks", "cost", "purchases", "roas", "flag_reason"]
        cols = [c for c in cols if c in poor_ngrams.columns]
        sections.append(",".join(cols))
        for _, row in poor_ngrams[cols].iterrows():
            sections.append(",".join(str(row[c]) for c in cols))
    sections.append("")

    # ── Section 6: Recommendations ──
    sections.append("=== RECOMMENDED NEGATIVE KEYWORDS ===")
    if not recommendations:
        sections.append("None")
    else:
        cols = ["keyword", "match_type", "campaign", "ad_group", "confidence", "reason", "action"]
        sections.append(",".join(cols))
        for r in recommendations:
            sections.append(",".join(str(r.get(c, "")) for c in cols))

    return "\n".join(sections)
