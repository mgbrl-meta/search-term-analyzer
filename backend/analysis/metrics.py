"""
metrics.py — Computes per-row and aggregate performance metrics for
Google Shopping search term data.

Derived metrics:
  - CTR       = clicks / impressions
  - CPC       = cost / clicks
  - CVR       = conversions / clicks
  - ROAS      = conv_value / cost
  - CPA       = cost / conversions
  - AOV       = conv_value / conversions
  - Revenue contribution % (row / total)
  - Quality score  (composite 0-100)
  - Performance tier  (Star | Solid | Weak | Drain | Untested)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Safe division helper
# ---------------------------------------------------------------------------

def _safe_div(numerator: pd.Series, denominator: pd.Series, fill: float = 0.0) -> pd.Series:
    return np.where(denominator > 0, numerator / denominator, fill)


# ---------------------------------------------------------------------------
# Derived metric computation
# ---------------------------------------------------------------------------

def compute_derived_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived metric columns to the DataFrame in-place (returns df)."""
    df = df.copy()

    df["ctr"] = _safe_div(df["clicks"], df["impressions"]) * 100          # %
    df["cpc"] = _safe_div(df["cost"], df["clicks"])
    df["cvr"] = _safe_div(df["conversions"], df["clicks"]) * 100          # %
    df["roas"] = _safe_div(df["conv_value"], df["cost"])
    df["cpa"] = _safe_div(df["cost"], df["conversions"])
    df["aov"] = _safe_div(df["conv_value"], df["conversions"])

    total_revenue = df["conv_value"].sum()
    total_cost = df["cost"].sum()
    df["revenue_share"] = _safe_div(df["conv_value"], pd.Series([total_revenue] * len(df))) * 100
    df["cost_share"] = _safe_div(df["cost"], pd.Series([total_cost] * len(df))) * 100

    return df


# ---------------------------------------------------------------------------
# Quality score (0-100)
# ---------------------------------------------------------------------------

def _normalise_col(series: pd.Series) -> pd.Series:
    """Min-max normalise a series to [0, 1]."""
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series([0.5] * len(series), index=series.index)
    return (series - mn) / (mx - mn)


def compute_quality_score(df: pd.DataFrame) -> pd.Series:
    """
    Composite quality score using weighted sub-scores.

    Weights
    -------
    ROAS         0.35
    CVR          0.25
    CTR          0.20
    Volume (clicks) 0.20
    """
    weights = {"roas": 0.35, "cvr": 0.25, "ctr": 0.20, "clicks": 0.20}

    score = pd.Series(np.zeros(len(df)), index=df.index)
    for col, w in weights.items():
        if col in df.columns:
            score += _normalise_col(df[col].fillna(0.0)) * w

    return (score * 100).round(1)


# ---------------------------------------------------------------------------
# Performance tier
# ---------------------------------------------------------------------------

_TIER_DEFS = [
    # (label, colour, condition_fn)
    ("Star",     "#22c55e", lambda r: r["roas"] >= 4.0 and r["conversions"] >= 1),
    ("Solid",    "#3b82f6", lambda r: r["roas"] >= 2.0 and r["conversions"] >= 1),
    ("Untested", "#f59e0b", lambda r: r["clicks"] < 10),
    ("Weak",     "#f97316", lambda r: r["roas"] > 0 and r["roas"] < 2.0),
    ("Drain",    "#ef4444", lambda r: r["cost"] > 0 and r["conversions"] == 0),
]


def assign_tier(row: pd.Series) -> str:
    for label, _, condition in _TIER_DEFS:
        try:
            if condition(row):
                return label
        except Exception:
            pass
    return "Untested"


TIER_COLORS: dict[str, str] = {label: color for label, color, _ in _TIER_DEFS}


def compute_tiers(df: pd.DataFrame) -> pd.Series:
    return df.apply(assign_tier, axis=1)


# ---------------------------------------------------------------------------
# Summary / aggregate stats
# ---------------------------------------------------------------------------

def aggregate_summary(df: pd.DataFrame) -> dict:
    """Return a top-level summary dict suitable for the dashboard header."""
    total_cost = float(df["cost"].sum())
    total_revenue = float(df["conv_value"].sum())
    total_clicks = int(df["clicks"].sum())
    total_impressions = int(df["impressions"].sum())
    total_conversions = float(df["conversions"].sum())
    unique_terms = int(len(df))

    blended_roas = total_revenue / total_cost if total_cost > 0 else 0.0
    blended_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
    blended_cvr = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0.0
    blended_cpa = (total_cost / total_conversions) if total_conversions > 0 else 0.0

    tier_counts = (
        df["tier"].value_counts().to_dict() if "tier" in df.columns else {}
    )

    return {
        "unique_terms": unique_terms,
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "total_cost": round(total_cost, 2),
        "total_conversions": round(total_conversions, 2),
        "total_revenue": round(total_revenue, 2),
        "blended_roas": round(blended_roas, 2),
        "blended_ctr": round(blended_ctr, 2),
        "blended_cvr": round(blended_cvr, 2),
        "blended_cpa": round(blended_cpa, 2),
        "tier_counts": tier_counts,
    }


# ---------------------------------------------------------------------------
# Full pipeline entry point
# ---------------------------------------------------------------------------

def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Run the full metrics enrichment pipeline."""
    df = compute_derived_metrics(df)
    df["quality_score"] = compute_quality_score(df)
    df["tier"] = compute_tiers(df)
    return df
