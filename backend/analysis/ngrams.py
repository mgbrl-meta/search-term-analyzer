"""
ngrams.py — N-gram analysis engine.

For each search term, extracts 1-grams, 2-grams, and 3-grams,
then aggregates spend/click/purchase metrics across all search terms
that contain each n-gram.
"""

import re
import pandas as pd
import numpy as np
from itertools import islice
from typing import List, Tuple

# Stopwords to remove before generating n-grams.
# These are common words that add no analytical value on their own.
# Keep commercially meaningful words like "buy", "cheap", "near".
STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "in", "on", "at",
    "to", "for", "with", "by", "from", "is", "are", "was",
    "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "shall", "can", "not", "no",
    "i", "me", "my", "we", "our", "you", "your", "it", "its",
    "that", "this", "these", "those", "which", "who", "what",
    "if", "so", "as", "but", "yet",
}

_PUNCT_RE = re.compile(r"[^\w\s]")


def _tokenize(text: str, remove_stopwords: bool = True) -> List[str]:
    """
    Tokenize a search term into lowercase words, removing punctuation.
    Optionally removes stopwords.
    """
    text = _PUNCT_RE.sub(" ", text.lower()).strip()
    tokens = [t for t in text.split() if t]
    if remove_stopwords:
        tokens = [t for t in tokens if t not in STOPWORDS]
    return tokens


def _ngrams_from_tokens(tokens: List[str], n: int) -> List[str]:
    """Generate n-grams as space-joined strings from a token list."""
    if len(tokens) < n:
        return []
    return [" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)]


def extract_ngrams(df: pd.DataFrame, n_values: Tuple[int, ...] = (1, 2, 3)) -> pd.DataFrame:
    """
    Explode the DataFrame so each row represents one (n-gram, original search term) pair.

    Returns a DataFrame with columns:
    - ngram
    - gram_type  (e.g. "1-gram")
    - plus all original metric columns (cost, clicks, etc.) carried forward
    """
    records = []

    for _, row in df.iterrows():
        tokens = _tokenize(str(row["search_term"]))
        for n in n_values:
            for gram in _ngrams_from_tokens(tokens, n):
                records.append({
                    "ngram":            gram,
                    "gram_type":        f"{n}-gram",
                    "source_term":      row["search_term"],
                    "campaign":         row.get("campaign", "Unknown"),
                    "clicks":           row.get("clicks", 0),
                    "impressions":      row.get("impressions", 0),
                    "cost":             row.get("cost", 0),
                    "purchases":        row.get("purchases", 0),
                    "conversions":      row.get("conversions", 0),
                    "conversion_value": row.get("conversion_value", 0),
                    "wasted_spend":     row.get("wasted_spend", 0),
                })

    if not records:
        return pd.DataFrame()

    return pd.DataFrame(records)


def aggregate_ngrams(
    ngram_df: pd.DataFrame,
    campaign_filter: str = "All",
) -> pd.DataFrame:
    """
    Aggregate metrics per (ngram, gram_type).

    Optionally filter to a specific campaign before aggregation.
    """
    if ngram_df.empty:
        return pd.DataFrame()

    df = ngram_df.copy()
    if campaign_filter and campaign_filter != "All":
        df = df[df["campaign"] == campaign_filter]

    agg = df.groupby(["ngram", "gram_type"], as_index=False).agg(
        term_count       =("source_term",     "nunique"),
        campaign_count   =("campaign",        "nunique"),
        impressions      =("impressions",     "sum"),
        clicks           =("clicks",          "sum"),
        cost             =("cost",            "sum"),
        purchases        =("purchases",       "sum"),
        conversions      =("conversions",     "sum"),
        conversion_value =("conversion_value","sum"),
        wasted_spend     =("wasted_spend",    "sum"),
    )

    # Derived metrics
    def sdiv(a, b):
        return np.where(b == 0, 0.0, a / b)

    agg["avg_cpc"]         = sdiv(agg["cost"],             agg["clicks"])
    agg["cpa"]             = sdiv(agg["cost"],             agg["purchases"])
    agg["roas"]            = sdiv(agg["conversion_value"], agg["cost"])
    agg["conversion_rate"] = sdiv(agg["conversions"],      agg["clicks"])

    # Round floats
    float_cols = agg.select_dtypes(include="float").columns
    agg[float_cols] = agg[float_cols].round(4)

    return agg.sort_values("cost", ascending=False).reset_index(drop=True)


def flag_poor_ngrams(
    agg: pd.DataFrame,
    spend_threshold: float = 1000.0,
    clicks_threshold: int   = 20,
    target_roas: float      = 2.0,
) -> pd.DataFrame:
    """
    Add a 'flag' and 'flag_reason' column to the aggregated n-gram DataFrame.

    Flag criteria:
    - cost >= spend_threshold and purchases == 0  → "High spend, no purchase"
    - clicks >= clicks_threshold and purchases == 0 → "High clicks, no purchase"
    - roas > 0 and roas < target_roas and cost >= spend_threshold → "Low ROAS"
    """
    agg = agg.copy()
    agg["flag"]        = False
    agg["flag_reason"] = ""

    high_spend = (agg["cost"] >= spend_threshold) & (agg["purchases"] == 0)
    high_clicks = (agg["clicks"] >= clicks_threshold) & (agg["purchases"] == 0)
    low_roas = (agg["roas"] > 0) & (agg["roas"] < target_roas) & (agg["cost"] >= spend_threshold)

    reasons = []
    for idx in agg.index:
        r = []
        if high_spend.loc[idx]:
            r.append(f"Spend ≥ {spend_threshold} with no purchase")
        if high_clicks.loc[idx]:
            r.append(f"Clicks ≥ {clicks_threshold} with no purchase")
        if low_roas.loc[idx]:
            r.append(f"ROAS below target ({target_roas})")
        reasons.append("; ".join(r))

    agg["flag"]        = agg.index.map(lambda i: bool(reasons[i]))
    agg["flag_reason"] = reasons

    return agg


def run_ngram_analysis(
    df: pd.DataFrame,
    campaign_filter: str  = "All",
    spend_threshold: float = 1000.0,
    clicks_threshold: int  = 20,
    target_roas: float     = 2.0,
) -> pd.DataFrame:
    """
    Full n-gram pipeline: extract → aggregate → flag.

    Parameters
    ----------
    df               : cleaned DataFrame with row metrics applied
    campaign_filter  : "All" or a specific campaign name
    spend_threshold  : flag n-gram if cost >= this and purchases == 0
    clicks_threshold : flag n-gram if clicks >= this and purchases == 0
    target_roas      : flag n-gram if roas < this and cost >= spend_threshold

    Returns
    -------
    Aggregated, flagged n-gram DataFrame sorted by cost desc.
    """
    ngram_df = extract_ngrams(df)
    if ngram_df.empty:
        return pd.DataFrame()

    agg = aggregate_ngrams(ngram_df, campaign_filter=campaign_filter)
    agg = flag_poor_ngrams(agg, spend_threshold, clicks_threshold, target_roas)

    return agg
