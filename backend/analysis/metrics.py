"""
metrics.py — Operator-grade metrics engine for Google Shopping search terms.

This module enriches parsed search-term rows with profitability, significance,
brand/non-brand, intent, tiering, and wasted-spend metrics. The logic is
configured through DEFAULT_THRESHOLDS so kill / scale decisions are not
hardcoded into the codebase.
"""

from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

from .config import DEFAULT_THRESHOLDS, INTENT_PATTERNS


TIER_COLORS: dict[str, str] = {
    "Star": "#22c55e",
    "Solid": "#3b82f6",
    "Weak": "#f97316",
    "Drain": "#ef4444",
    "Untested": "#f59e0b",
}


def get_thresholds(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return thresholds with derived break-even ROAS.

    break_even_roas = 1 / gross_margin. With 40% gross margin, break-even
    ROAS is 2.5x. This is the base profitability floor for tiering and waste.
    """
    cfg = DEFAULT_THRESHOLDS.copy()
    if overrides:
        cfg.update({k: v for k, v in overrides.items() if v is not None})

    gross_margin = float(cfg.get("gross_margin", 0.40) or 0.40)
    cfg["break_even_roas"] = 1.0 / gross_margin if gross_margin > 0 else 2.5
    return cfg


def _safe_div(numerator: pd.Series, denominator: pd.Series, fill: float = 0.0) -> pd.Series:
    """Vectorized safe division that returns a Series and avoids inf/NaN."""
    numerator = pd.to_numeric(numerator, errors="coerce").fillna(0.0)
    denominator = pd.to_numeric(denominator, errors="coerce").fillna(0.0)
    out = np.where(denominator > 0, numerator / denominator, fill)
    return pd.Series(out, index=numerator.index).replace([np.inf, -np.inf], fill).fillna(fill)


def _regex_from_terms(terms: list[str]) -> str:
    escaped = [re.escape(str(t).strip().lower()) for t in terms if str(t).strip()]
    if not escaped:
        return r"$a"
    return r"\b(" + "|".join(escaped) + r")\b"


def classify_intent_series(series: pd.Series, thresholds: dict[str, Any] | None = None) -> pd.Series:
    """Classify search terms into Transactional / Commercial / Informational / Navigational.

    Pattern order matters. Brand/navigational checks run first, then
    transactional/commercial/informational. The dict is editable in config.py.
    """
    cfg = get_thresholds(thresholds)
    text = series.astype(str).str.lower().fillna("")

    result = pd.Series("Informational", index=series.index)

    brand_regex = _regex_from_terms(cfg.get("brand_terms", []))
    nav_regex = _regex_from_terms(INTENT_PATTERNS.get("Navigational", []))
    trans_regex = _regex_from_terms(INTENT_PATTERNS.get("Transactional", []))
    comm_regex = _regex_from_terms(INTENT_PATTERNS.get("Commercial", []))
    info_regex = _regex_from_terms(INTENT_PATTERNS.get("Informational", []))

    result[text.str.contains(info_regex, regex=True, na=False)] = "Informational"
    result[text.str.contains(comm_regex, regex=True, na=False)] = "Commercial"
    result[text.str.contains(trans_regex, regex=True, na=False)] = "Transactional"
    result[text.str.contains(nav_regex, regex=True, na=False)] = "Navigational"
    result[text.str.contains(brand_regex, regex=True, na=False)] = "Navigational"

    return result


def compute_derived_metrics(
    df: pd.DataFrame,
    thresholds: dict[str, Any] | None = None,
) -> pd.DataFrame:
    """Add core derived metrics, significance gates, intent, brand flags, and waste.

    Significance gate:
    A term can receive a kill/scale tier only when clicks >= clicks_threshold
    OR cost >= 3x target CPA. CTR-only judgments use impressions >= 1000.
    Below that floor, the tier becomes Untested and recommendations should not
    ask for a kill/scale decision.
    """
    cfg = get_thresholds(thresholds)
    out = df.copy()

    for col in ["impressions", "clicks", "cost", "conversions", "conv_value"]:
        if col not in out.columns:
            out[col] = 0.0
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0)

    out["ctr"] = _safe_div(out["clicks"], out["impressions"]) * 100
    out["cpc"] = _safe_div(out["cost"], out["clicks"])
    out["cvr"] = _safe_div(out["conversions"], out["clicks"]) * 100
    out["roas"] = _safe_div(out["conv_value"], out["cost"])
    out["cpa"] = _safe_div(out["cost"], out["conversions"])
    out["aov"] = _safe_div(out["conv_value"], out["conversions"])
    out["revenue"] = out["conv_value"]

    total_revenue = float(out["conv_value"].sum())
    total_cost = float(out["cost"].sum())
    out["revenue_share"] = _safe_div(out["conv_value"], pd.Series(total_revenue, index=out.index)) * 100
    out["cost_share"] = _safe_div(out["cost"], pd.Series(total_cost, index=out.index)) * 100

    target_cpa = float(cfg["target_cpa"])
    break_even_roas = float(cfg["break_even_roas"])

    out["break_even_roas"] = break_even_roas
    out["is_significant"] = (
        (out["clicks"] >= int(cfg["clicks_threshold"]))
        | (out["cost"] >= 3 * target_cpa)
    )
    out["is_ctr_significant"] = out["impressions"] >= int(cfg["ctr_impressions_threshold"])

    brand_regex = _regex_from_terms(cfg.get("brand_terms", []))
    out["is_brand"] = out["search_term"].astype(str).str.lower().str.contains(brand_regex, regex=True, na=False)
    out["segment"] = np.where(out["is_brand"], "Brand", "Non-brand")

    if "intent" not in out.columns:
        out["intent"] = classify_intent_series(out["search_term"], cfg)

    out["is_zero_converter"] = (out["conversions"] == 0) & (out["cost"] >= 3 * target_cpa)
    out["zero_conversion_severity"] = np.select(
        [
            (out["conversions"] == 0) & (out["cost"] >= 5 * target_cpa),
            (out["conversions"] == 0) & (out["cost"] >= 3 * target_cpa),
        ],
        ["kill", "investigate"],
        default="none",
    )

    out["wasted_spend"] = np.where(
        out["is_significant"] & (out["roas"] < break_even_roas),
        (break_even_roas - out["roas"]).clip(lower=0) * out["cost"],
        0.0,
    )

    out["is_pdp_problem"] = (
        (out["ctr"] >= float(out["ctr"].mean() or 0))
        & (out["clicks"] >= int(cfg["pdp_clicks_threshold"]))
        & (out["cvr"] <= float(cfg["zero_cvr_threshold"]))
    )

    return out


def _normalise_col(series: pd.Series) -> pd.Series:
    """Min-max normalise a series to [0, 1] for the visual quality score."""
    series = pd.to_numeric(series, errors="coerce").fillna(0.0)
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series([0.5] * len(series), index=series.index)
    return (series - mn) / (mx - mn)


def compute_quality_score(df: pd.DataFrame) -> pd.Series:
    """Compute a 0-100 visual quality score from ROAS, CVR, CTR, and volume."""
    weights = {"roas": 0.35, "cvr": 0.25, "ctr": 0.20, "clicks": 0.20}
    score = pd.Series(np.zeros(len(df)), index=df.index)

    for col, weight in weights.items():
        if col in df.columns:
            score += _normalise_col(df[col]) * weight

    return (score * 100).round(1)


def compute_tiers(
    df: pd.DataFrame,
    thresholds: dict[str, Any] | None = None,
) -> pd.Series:
    """Assign Star / Solid / Weak / Drain / Untested using break-even ROAS.

    Untested always wins when the term is below the significance floor.
    Star means at least 1.5x break-even ROAS.
    Solid means profitable above break-even.
    Weak means near break-even but under the profit floor.
    Drain means significant and materially below break-even.
    """
    cfg = get_thresholds(thresholds)
    be = float(cfg["break_even_roas"])

    tier = pd.Series("Untested", index=df.index)

    significant = df["is_significant"].fillna(False)
    roas = pd.to_numeric(df["roas"], errors="coerce").fillna(0.0)

    tier[significant & (roas >= 1.5 * be)] = "Star"
    tier[significant & (roas >= be) & (roas < 1.5 * be)] = "Solid"
    tier[significant & (roas >= 0.7 * be) & (roas < be)] = "Weak"
    tier[significant & (roas < 0.7 * be)] = "Drain"

    return tier


def aggregate_summary(
    df: pd.DataFrame,
    thresholds: dict[str, Any] | None = None,
) -> dict:
    """Return top-level dashboard summary while preserving existing response keys."""
    cfg = get_thresholds(thresholds)

    total_cost = float(df["cost"].sum())
    total_revenue = float(df["conv_value"].sum())
    total_clicks = int(df["clicks"].sum())
    total_impressions = int(df["impressions"].sum())
    total_conversions = float(df["conversions"].sum())
    unique_terms = int(len(df))

    blended_roas = total_revenue / total_cost if total_cost > 0 else 0.0
    blended_ctr = total_clicks / total_impressions * 100 if total_impressions > 0 else 0.0
    blended_cvr = total_conversions / total_clicks * 100 if total_clicks > 0 else 0.0
    blended_cpa = total_cost / total_conversions if total_conversions > 0 else 0.0

    brand = df[df.get("is_brand", False) == True] if "is_brand" in df.columns else df.iloc[0:0]
    non_brand = df[df.get("is_brand", False) == False] if "is_brand" in df.columns else df

    brand_spend = float(brand["cost"].sum()) if not brand.empty else 0.0
    brand_revenue = float(brand["conv_value"].sum()) if not brand.empty else 0.0
    non_brand_spend = float(non_brand["cost"].sum()) if not non_brand.empty else 0.0
    non_brand_revenue = float(non_brand["conv_value"].sum()) if not non_brand.empty else 0.0

    significant = df["is_significant"].fillna(False) if "is_significant" in df.columns else pd.Series(False, index=df.index)
    zero_converter = df["is_zero_converter"].fillna(False) if "is_zero_converter" in df.columns else pd.Series(False, index=df.index)
    drain = df["tier"].eq("Drain") if "tier" in df.columns else pd.Series(False, index=df.index)

    wasted_mask = significant & (drain | zero_converter)
    wasted_spend = float(df.loc[wasted_mask, "cost"].sum()) if len(df) else 0.0
    wasted_spend_pct = wasted_spend / total_cost if total_cost > 0 else 0.0

    tier_counts = df["tier"].value_counts().to_dict() if "tier" in df.columns else {}

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

        # Extended summary
        "gross_margin": round(float(cfg["gross_margin"]), 2),
        "target_cpa": round(float(cfg["target_cpa"]), 2),
        "break_even_roas": round(float(cfg["break_even_roas"]), 2),
        "brand_spend": round(brand_spend, 2),
        "brand_revenue": round(brand_revenue, 2),
        "brand_roas": round(brand_revenue / brand_spend, 2) if brand_spend > 0 else 0.0,
        "non_brand_spend": round(non_brand_spend, 2),
        "non_brand_revenue": round(non_brand_revenue, 2),
        "non_brand_roas": round(non_brand_revenue / non_brand_spend, 2) if non_brand_spend > 0 else 0.0,
        "true_acquisition_roas": round(non_brand_revenue / non_brand_spend, 2) if non_brand_spend > 0 else 0.0,
        "wasted_spend": round(wasted_spend, 2),
        "wasted_spend_pct": round(wasted_spend_pct, 4),
        "wasted_spend_pct_display": round(wasted_spend_pct * 100, 2),
        "significant_terms": int(significant.sum()),
        "untested_terms": int((df["tier"] == "Untested").sum()) if "tier" in df.columns else 0,
        "zero_converter_terms": int(zero_converter.sum()),
    }


def enrich_dataframe(
    df: pd.DataFrame,
    thresholds: dict[str, Any] | None = None,
) -> pd.DataFrame:
    """Run the full metrics enrichment pipeline."""
    out = compute_derived_metrics(df, thresholds)
    out["quality_score"] = compute_quality_score(out)
    out["tier"] = compute_tiers(out, thresholds)
    return out
