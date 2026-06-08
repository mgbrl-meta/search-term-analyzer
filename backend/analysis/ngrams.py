"""
ngrams.py — N-gram waste analysis for Google Shopping search terms.

The table aggregates cost, conversions, and conversion value for 1/2/3-grams.
Waste is ranked by aggregate_wasted_spend × term_count because repeated bad
phrases are usually the highest-leverage negative-keyword cuts.
"""

from __future__ import annotations

from itertools import islice
from typing import Any, Iterator

import pandas as pd

from .cleaner import clean_term, get_all_tokens, get_meaningful_tokens
from .config import DEFAULT_THRESHOLDS


_METRIC_COLS = ["impressions", "clicks", "cost", "conversions", "conv_value"]


def _get_thresholds(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = DEFAULT_THRESHOLDS.copy()
    if overrides:
        cfg.update({k: v for k, v in overrides.items() if v is not None})
    gross_margin = float(cfg.get("gross_margin", 0.40) or 0.40)
    cfg["break_even_roas"] = 1.0 / gross_margin if gross_margin > 0 else 2.5
    return cfg


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
    """Return all unique n-grams of length n from a single search term."""
    tokens = get_meaningful_tokens(term) if remove_stopwords else get_all_tokens(term)
    if len(tokens) < n:
        return []
    return list(dict.fromkeys(_ngrams(tokens, n)))


def build_ngram_table(
    df: pd.DataFrame,
    n: int,
    remove_stopwords: bool = True,
    min_occurrences: int = 2,
    top_k: int = 200,
    thresholds: dict[str, Any] | None = None,
) -> list[dict]:
    """Build an n-gram performance table with break-even waste fields.

    Each n-gram receives the full metrics of every source term where it appears.
    This intentionally measures how much total spend is touched by a phrase,
    which is more useful for negative-keyword decisions than fractional credit.
    """
    cfg = _get_thresholds(thresholds)
    break_even_roas = float(cfg["break_even_roas"])
    ngram_threshold = float(cfg.get("ngram_threshold", 3000.0))

    records: list[dict] = []
    for _, row in df.iterrows():
        term = str(row.get("search_term", ""))
        grams = extract_ngrams(clean_term(term), n, remove_stopwords=remove_stopwords)
        if not grams:
            continue

        metrics = {col: float(row.get(col, 0.0) or 0.0) for col in _METRIC_COLS}
        for gram in grams:
            records.append({
                "ngram": gram,
                "source_term": term,
                **metrics,
            })

    if not records:
        return []

    detail = pd.DataFrame(records)

    agg = (
        detail.groupby("ngram")
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

    agg = agg[agg["term_count"] >= min_occurrences].copy()
    if agg.empty:
        return []

    agg["ctr"] = (agg["clicks"] / agg["impressions"].replace(0, float("nan")) * 100).fillna(0.0)
    agg["cvr"] = (agg["conversions"] / agg["clicks"].replace(0, float("nan")) * 100).fillna(0.0)
    agg["roas"] = (agg["revenue"] / agg["cost"].replace(0, float("nan"))).fillna(0.0)
    agg["cpa"] = (agg["cost"] / agg["conversions"].replace(0, float("nan"))).fillna(0.0)

    agg["break_even_roas"] = break_even_roas
    agg["aggregate_wasted_spend"] = ((break_even_roas - agg["roas"]).clip(lower=0) * agg["cost"]).fillna(0.0)
    agg["waste_score"] = agg["aggregate_wasted_spend"] * agg["term_count"]
    agg["is_waste"] = ((agg["cost"] >= ngram_threshold) & (agg["roas"] < break_even_roas)).astype(int)

    agg["flag"] = agg["is_waste"]
    agg["flag_reason"] = agg.apply(
        lambda r: (
            f"Spent ₹{r['cost']:,.0f} across {int(r['term_count'])} terms at "
            f"{r['roas']:.2f}x ROAS below {break_even_roas:.2f}x break-even"
            if int(r["is_waste"]) == 1 else ""
        ),
        axis=1,
    )

    # Preserve old-ish flags for frontend compatibility.
    agg["is_high_roas"] = (agg["roas"] >= 1.5 * break_even_roas).astype(int)
    agg["is_low_roas"] = ((agg["cost"] >= ngram_threshold) & (agg["roas"] < break_even_roas)).astype(int)
    agg["is_high_ctr"] = (agg["ctr"] >= agg["ctr"].quantile(0.75)).astype(int)
    agg["is_low_ctr"] = ((agg["impressions"] >= agg["impressions"].quantile(0.50)) & (agg["ctr"] <= agg["ctr"].quantile(0.25))).astype(int)

    agg = agg.sort_values(["is_waste", "waste_score", "cost"], ascending=[False, False, False]).head(top_k)

    for col in ["impressions", "clicks", "cost", "conversions", "revenue", "ctr", "cvr", "roas", "cpa", "aggregate_wasted_spend", "waste_score"]:
        agg[col] = agg[col].round(2)

    agg["n"] = n
    return agg.to_dict(orient="records")


def unigrams(df: pd.DataFrame, **kwargs) -> list[dict]:
    return build_ngram_table(df, n=1, **kwargs)


def bigrams(df: pd.DataFrame, **kwargs) -> list[dict]:
    return build_ngram_table(df, n=2, **kwargs)


def trigrams(df: pd.DataFrame, **kwargs) -> list[dict]:
    return build_ngram_table(df, n=3, **kwargs)


def all_ngrams(
    df: pd.DataFrame,
    top_k: int = 100,
    thresholds: dict[str, Any] | None = None,
) -> dict[str, list[dict]]:
    """Return keys '1', '2', '3' containing waste-ranked n-gram tables."""
    return {
        "1": unigrams(df, top_k=top_k, thresholds=thresholds),
        "2": bigrams(df, top_k=top_k, thresholds=thresholds),
        "3": trigrams(df, top_k=top_k, thresholds=thresholds),
    }
