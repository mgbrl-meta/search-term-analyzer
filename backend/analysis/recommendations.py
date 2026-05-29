"""
recommendations.py — Negative keyword recommendation engine.

Evaluates each search term and poor-performing n-gram and generates
actionable negative keyword recommendations with match type suggestions,
reason strings, and confidence levels.
"""

import pandas as pd
from typing import Dict, List, Any

# Categories that are almost always irrelevant for a shopping campaign
ALWAYS_NEGATIVE_CATEGORIES = {"irrelevant", "diy", "informational", "low_intent"}

# Categories that are sometimes worth negating (medium confidence)
REVIEW_CATEGORIES = {"lifestyle", "generic", "price_sensitive"}


def _format_negative(keyword: str) -> Dict[str, str]:
    """Return broad, phrase, and exact match negative format strings."""
    kw = keyword.strip().lower()
    return {
        "broad":  kw,
        "phrase": f'"{kw}"',
        "exact":  f"[{kw}]",
    }


def _confidence(
    purchases: float,
    cost: float,
    clicks: float,
    category: str,
    spend_threshold: float,
    clicks_threshold: int,
) -> str:
    """Determine confidence level for a recommendation."""
    if category in ALWAYS_NEGATIVE_CATEGORIES and (cost > 0 or clicks > 0):
        return "high"
    if purchases == 0:
        if cost >= spend_threshold or clicks >= clicks_threshold:
            return "high"
        if cost >= spend_threshold * 0.3 or clicks >= clicks_threshold * 0.5:
            return "medium"
    return "low"


def _recommended_match_type(
    search_term: str,
    source: str,
    category: str,
) -> str:
    """
    Suggest the best negative match type.

    - Exact   → specific multi-word search terms that are clearly bad
    - Phrase  → recurring patterns / n-grams
    - Broad   → single irrelevant words
    """
    words = search_term.strip().split()
    if source == "ngram" and len(words) >= 2:
        return "phrase"
    if len(words) == 1:
        if category in ALWAYS_NEGATIVE_CATEGORIES:
            return "broad"
        return "exact"
    return "exact"


def generate_search_term_recommendations(
    df: pd.DataFrame,
    spend_threshold: float = 1000.0,
    clicks_threshold: int  = 20,
    target_roas: float     = 2.0,
) -> List[Dict[str, Any]]:
    """
    Evaluate each search term row and produce negative keyword recommendations.

    Triggers:
    1. clicks >= clicks_threshold and purchases == 0
    2. cost >= spend_threshold and purchases == 0
    3. ROAS < target_roas and cost >= spend_threshold * 0.3 (meaningful spend)
    4. Category in ALWAYS_NEGATIVE_CATEGORIES with any spend or clicks
    """
    recommendations = []

    for _, row in df.iterrows():
        clicks           = float(row.get("clicks", 0))
        cost             = float(row.get("cost", 0))
        purchases        = float(row.get("purchases", 0))
        conversions      = float(row.get("conversions", 0))
        conv_value       = float(row.get("conversion_value", 0))
        roas             = float(row.get("roas_calc", 0) or row.get("roas", 0))
        category         = str(row.get("category", "other"))
        search_term      = str(row.get("search_term", ""))
        campaign         = str(row.get("campaign", "Unknown"))
        ad_group         = str(row.get("ad_group", "Unknown"))

        reasons = []

        # Trigger 1: High clicks, no purchase
        if clicks >= clicks_threshold and purchases == 0:
            reasons.append(f"{int(clicks)} clicks with no purchase")

        # Trigger 2: High spend, no purchase
        if cost >= spend_threshold and purchases == 0:
            reasons.append(f"Spend {cost:.2f} with no purchase")

        # Trigger 3: Low ROAS
        if (
            roas > 0
            and roas < target_roas
            and cost >= spend_threshold * 0.3
            and purchases > 0
        ):
            reasons.append(f"ROAS {roas:.2f} below target {target_roas}")

        # Trigger 4: Irrelevant category
        if category in ALWAYS_NEGATIVE_CATEGORIES and (cost > 0 or clicks > 0):
            reasons.append(f"Category: {category}")

        if not reasons:
            continue

        conf = _confidence(purchases, cost, clicks, category, spend_threshold, clicks_threshold)
        match_type = _recommended_match_type(search_term, "search_term", category)
        formats = _format_negative(search_term)

        recommendations.append({
            "type":            "search_term",
            "campaign":        campaign,
            "ad_group":        ad_group,
            "keyword":         search_term,
            "category":        category,
            "match_type":      match_type,
            "broad":           formats["broad"],
            "phrase":          formats["phrase"],
            "exact":           formats["exact"],
            "clicks":          int(clicks),
            "cost":            round(cost, 2),
            "purchases":       round(purchases, 2),
            "conversions":     round(conversions, 2),
            "conversion_value":round(conv_value, 2),
            "roas":            round(roas, 4),
            "reason":          "; ".join(reasons),
            "confidence":      conf,
            "action":          "Add as negative keyword",
        })

    return recommendations


def generate_ngram_recommendations(
    ngram_df: pd.DataFrame,
    spend_threshold: float = 1000.0,
    clicks_threshold: int  = 20,
    target_roas: float     = 2.0,
) -> List[Dict[str, Any]]:
    """
    Generate recommendations from flagged n-grams.
    Only include n-grams with flag=True (poor performers).
    """
    recommendations = []

    flagged = ngram_df[ngram_df["flag"] == True] if "flag" in ngram_df.columns else pd.DataFrame()

    for _, row in flagged.iterrows():
        ngram        = str(row.get("ngram", ""))
        gram_type    = str(row.get("gram_type", ""))
        clicks       = float(row.get("clicks", 0))
        cost         = float(row.get("cost", 0))
        purchases    = float(row.get("purchases", 0))
        conversions  = float(row.get("conversions", 0))
        conv_value   = float(row.get("conversion_value", 0))
        roas         = float(row.get("roas", 0))
        flag_reason  = str(row.get("flag_reason", ""))

        conf = _confidence(purchases, cost, clicks, "other", spend_threshold, clicks_threshold)
        match_type = _recommended_match_type(ngram, "ngram", "other")
        formats = _format_negative(ngram)

        recommendations.append({
            "type":            "ngram",
            "gram_type":       gram_type,
            "campaign":        "Multiple",
            "ad_group":        "Multiple",
            "keyword":         ngram,
            "category":        "n-gram",
            "match_type":      match_type,
            "broad":           formats["broad"],
            "phrase":          formats["phrase"],
            "exact":           formats["exact"],
            "clicks":          int(clicks),
            "cost":            round(cost, 2),
            "purchases":       round(purchases, 2),
            "conversions":     round(conversions, 2),
            "conversion_value":round(conv_value, 2),
            "roas":            round(roas, 4),
            "reason":          flag_reason or "Poor n-gram performance",
            "confidence":      conf,
            "action":          "Add as negative keyword (phrase match recommended)",
        })

    return recommendations


def deduplicate_recommendations(recs: List[Dict]) -> List[Dict]:
    """
    Remove duplicate keyword recommendations.
    Prefer higher confidence and search_term type over ngram.
    """
    seen = {}
    for rec in recs:
        key = rec["keyword"].lower().strip()
        if key not in seen:
            seen[key] = rec
        else:
            # Keep higher confidence
            priority = {"high": 3, "medium": 2, "low": 1}
            if priority.get(rec["confidence"], 0) > priority.get(seen[key]["confidence"], 0):
                seen[key] = rec
    return list(seen.values())


def generate_all_recommendations(
    search_term_df: pd.DataFrame,
    ngram_df: pd.DataFrame,
    spend_threshold: float = 1000.0,
    clicks_threshold: int  = 20,
    target_roas: float     = 2.0,
) -> List[Dict[str, Any]]:
    """
    Run all recommendation engines and return a merged, deduplicated list.
    Sorted by: confidence desc, cost desc.
    """
    st_recs    = generate_search_term_recommendations(search_term_df, spend_threshold, clicks_threshold, target_roas)
    ngram_recs = generate_ngram_recommendations(ngram_df, spend_threshold, clicks_threshold, target_roas)

    all_recs = deduplicate_recommendations(st_recs + ngram_recs)

    conf_order = {"high": 0, "medium": 1, "low": 2}
    all_recs.sort(key=lambda r: (conf_order.get(r["confidence"], 9), -r["cost"]))

    return all_recs
