"""
ngrams.py — N-gram frequency analysis for Google Shopping search terms.

Generates unigram, bigram, and trigram frequency tables weighted by
performance metrics (impressions, clicks, cost, conversions, revenue).

IMPORTANT: All boolean-derived flag columns use int(bool(...)) instead of
bool() to guarantee JSON serialisation safety (True/False are not
JSON-native in all serialisation paths; 1/0 are always safe).
"""

from __future__ import annotations

from itertools import islice
from typing import Iterator

import pandas as pd

from .cleaner import clean_term, get_all_tokens, get_meaningful_tokens, ALL_STOPWORDS


# ---------------------------------------------------------------------------
# N-gram generation helpers
# ---------------------------------------------------------------------------

def _ngrams(tokens: list[str], n: int) -> Iterator[str]:
    """Yield space-joined n-grams from a token list."""
    it = iter(tokens)
    window = tuple(islice(it, n))
    if len(window) == n:
        yield " ".join(window)
    for token in it:
        window = window[1:] + (token,)
        yield " ".join(window)


def extract_ngrams(term: str, n: int, remove_stopwords: bool = False) -> list[str]:
    """Return all n-grams of length n from a single search term."""
    tokens = get_meaningful_tokens(term) if remove_stopwords else get_all_tokens(term)
    if len(tokens) < n:
        return []
    return list(_ngrams(tokens, n))


# ---------------------------------------------------------------------------
# Aggregate ngram table
# ---------------------------------------------------------------------------

_METRIC_COLS = ["impressions", "clicks", "cost", "conversions", "conv_value"]


def build_ngram_table(
    df: pd.DataFrame,
    n: int,
    remove_stopwords: bool = True,
    min_occurrences: int = 2,
    top_k: int = 200,
) -> list[dict]:
    """
    Build a frequency + performance table for n-grams across all search terms.

    Parameters
    ----------
    df : pd.DataFrame
        Enriched DataFrame with at least search_term + metric columns.
    n : int
        N-gram length (1, 2, or 3).
    remove_stopwords : bool
        Whether to strip stop-words before generating n-grams.
    min_occurrences : int
        Drop n-grams seen in fewer than this many search terms.
    top_k : int
        Maximum rows to return (sorted by impressions desc).

    Returns
    -------
    list[dict]
        Each dict is one n-gram row, JSON-serialisation safe.
    """
    # Explode each row into (ngram, metrics) pairs
    records: list[dict] = []
    for _, row in df.iterrows():
        term = str(row.get("search_term", ""))
        ngrams = extract_ngrams(clean_term(term), n, remove_stopwords=remove_stopwords)
        if not ngrams:
            continue

        metrics = {col: float(row.get(col, 0.0) or 0.0) for col in _METRIC_COLS}
        # Distribute metrics evenly across n-grams from the same term
        weight = 1.0 / len(ngrams)

        for gram in ngrams:
            records.append({
                "ngram": gram,
                **{col: metrics[col] * weight for col in _METRIC_COLS},
                "source_term": term,
            })

    if not records:
        return []

    detail_df = pd.DataFrame(records)

    # Aggregate by ngram
    agg = (
        detail_df.groupby("ngram")
        .agg(
            term_count=("source_term", "nunique"),
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
            cost=("cost", "sum"),
            conversions=("conversions", "sum"),
            revenue=("conv_value", "sum"),
        )
        .reset_index()
    )

    # Filter low-frequency n-grams
    agg = agg[agg["term_count"] >= min_occurrences].copy()

    if agg.empty:
        return []

    # Derived metrics
    agg["ctr"] = (
        (agg["clicks"] / agg["impressions"].replace(0, float("nan"))) * 100
    ).fillna(0.0).round(2)

    agg["cpc"] = (
        agg["cost"] / agg["clicks"].replace(0, float("nan"))
    ).fillna(0.0).round(2)

    agg["cvr"] = (
        (agg["conversions"] / agg["clicks"].replace(0, float("nan"))) * 100
    ).fillna(0.0).round(2)

    agg["roas"] = (
        agg["revenue"] / agg["cost"].replace(0, float("nan"))
    ).fillna(0.0).round(2)

    agg["cpa"] = (
        agg["cost"] / agg["conversions"].replace(0, float("nan"))
    ).fillna(0.0).round(2)

    # ---------------------------------------------------------------------------
    # Flag columns — use int(bool(...)) for JSON serialisation safety
    # bool() in pandas/numpy can produce numpy.bool_ which some JSON serialisers
    # reject; int(bool(...)) always produces a plain Python int (0 or 1).
    # ---------------------------------------------------------------------------
    agg["high_impression_flag"] = agg["impressions"].apply(
        lambda x: int(bool(x >= agg["impressions"].quantile(0.75)))
    )
    agg["high_roas_flag"] = agg["roas"].apply(
        lambda x: int(bool(x >= 4.0))
    )
    agg["zero_conversion_flag"] = agg["conversions"].apply(
        lambda x: int(bool(x == 0))
    )
    agg["high_spend_no_conv_flag"] = agg.apply(
        lambda r: int(bool(r["cost"] > 0 and r["conversions"] == 0 and r["clicks"] >= 5)),
        axis=1,
    )
    agg["strong_term_flag"] = agg.apply(
        lambda r: int(bool(r["roas"] >= 4.0 and r["conversions"] >= 1)),
        axis=1,
    )

    # Opportunity score: high impressions + low CTR → SEO/listing gap
    imp_p50 = agg["impressions"].quantile(0.50)
    ctr_p25 = agg["ctr"].quantile(0.25)
    agg["opportunity_flag"] = agg.apply(
        lambda r: int(bool(r["impressions"] >= imp_p50 and r["ctr"] <= ctr_p25)),
        axis=1,
    )

    # Sort and cap
    agg = agg.sort_values("impressions", ascending=False).head(top_k)

    # Round floats for cleaner output
    float_cols = ["impressions", "clicks", "cost", "conversions", "revenue"]
    for col in float_cols:
        agg[col] = agg[col].round(2)

    # Add n value
    agg["n"] = n

    return agg.to_dict(orient="records")


# ---------------------------------------------------------------------------
# Convenience wrappers
# ---------------------------------------------------------------------------

def unigrams(df: pd.DataFrame, **kwargs) -> list[dict]:
    return build_ngram_table(df, n=1, **kwargs)


def bigrams(df: pd.DataFrame, **kwargs) -> list[dict]:
    return build_ngram_table(df, n=2, **kwargs)


def trigrams(df: pd.DataFrame, **kwargs) -> list[dict]:
    return build_ngram_table(df, n=3, **kwargs)


def all_ngrams(df: pd.DataFrame, top_k: int = 100) -> dict[str, list[dict]]:
    """Return a dict with keys '1', '2', '3' containing ngram tables."""
    return {
        "1": unigrams(df, top_k=top_k),
        "2": bigrams(df, top_k=top_k),
        "3": trigrams(df, top_k=top_k),
    }
