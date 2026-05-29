"""
metrics.py — Metric calculation engine.

Computes CTR, CPC, CPA, ROAS, conversion rate, and wasted spend.
All divide-by-zero cases return 0 or None safely.
"""

import pandas as pd
import numpy as np


def safe_divide(numerator: pd.Series, denominator: pd.Series, default=0.0) -> pd.Series:
    """Divide two series, returning `default` wherever denominator is 0 or NaN."""
    result = np.where(
        (denominator == 0) | denominator.isna(),
        default,
        numerator / denominator,
    )
    return pd.Series(result, index=numerator.index)


def calculate_row_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add per-row derived metrics to the DataFrame.

    Columns added:
    - ctr_calc          : clicks / impressions
    - avg_cpc_calc      : cost / clicks
    - conversion_rate   : conversions / clicks
    - cost_per_conv     : cost / conversions
    - cost_per_purchase : cost / purchases
    - roas_calc         : conversion_value / cost
    - wasted_spend      : cost where purchases == 0, else 0
    """
    df = df.copy()

    df["ctr_calc"]          = safe_divide(df["clicks"],           df["impressions"])
    df["avg_cpc_calc"]      = safe_divide(df["cost"],             df["clicks"])
    df["conversion_rate"]   = safe_divide(df["conversions"],      df["clicks"])
    df["cost_per_conv"]     = safe_divide(df["cost"],             df["conversions"])
    df["cost_per_purchase"] = safe_divide(df["cost"],             df["purchases"])
    df["roas_calc"]         = safe_divide(df["conversion_value"], df["cost"])

    # Wasted spend = cost spent on terms that generated 0 purchases
    df["wasted_spend"] = df["cost"].where(df["purchases"] == 0, 0.0)

    return df


def aggregate_by(df: pd.DataFrame, group_cols: list) -> pd.DataFrame:
    """
    Aggregate numeric metrics by the given group columns.

    Returns a DataFrame with sum/calculated aggregates per group.
    """
    agg = df.groupby(group_cols, as_index=False, dropna=False).agg(
        impressions      =("impressions",      "sum"),
        clicks           =("clicks",           "sum"),
        cost             =("cost",             "sum"),
        conversions      =("conversions",      "sum"),
        purchases        =("purchases",        "sum"),
        conversion_value =("conversion_value", "sum"),
        wasted_spend     =("wasted_spend",     "sum"),
    )

    # Recalculate derived metrics on aggregated totals
    agg["ctr"]              = safe_divide(agg["clicks"],           agg["impressions"])
    agg["avg_cpc"]          = safe_divide(agg["cost"],             agg["clicks"])
    agg["conversion_rate"]  = safe_divide(agg["conversions"],      agg["clicks"])
    agg["cost_per_conv"]    = safe_divide(agg["cost"],             agg["conversions"])
    agg["cost_per_purchase"]= safe_divide(agg["cost"],             agg["purchases"])
    agg["roas"]             = safe_divide(agg["conversion_value"], agg["cost"])

    return agg


def compute_summary(df: pd.DataFrame) -> dict:
    """
    Return a dict of top-level KPI summary values.
    """
    total_spend          = float(df["cost"].sum())
    total_clicks         = int(df["clicks"].sum())
    total_impressions    = int(df["impressions"].sum())
    total_purchases      = float(df["purchases"].sum())
    total_conversions    = float(df["conversions"].sum())
    total_conv_value     = float(df["conversion_value"].sum())
    total_wasted         = float(df["wasted_spend"].sum())

    roas  = total_conv_value / total_spend if total_spend > 0 else 0.0
    cpa   = total_spend / total_purchases  if total_purchases > 0 else 0.0
    cpc   = total_spend / total_clicks     if total_clicks > 0 else 0.0
    wasted_pct = (total_wasted / total_spend * 100) if total_spend > 0 else 0.0

    return {
        "total_spend":        round(total_spend,       2),
        "total_clicks":       total_clicks,
        "total_impressions":  total_impressions,
        "total_purchases":    round(total_purchases,   2),
        "total_conversions":  round(total_conversions, 2),
        "total_conv_value":   round(total_conv_value,  2),
        "overall_roas":       round(roas,  4),
        "avg_cpc":            round(cpc,   4),
        "cpa":                round(cpa,   4),
        "wasted_spend":       round(total_wasted, 2),
        "wasted_spend_pct":   round(wasted_pct,   2),
    }


def compute_campaign_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Campaign-level aggregated metrics."""
    agg = aggregate_by(df, ["campaign"])

    # Count risky search terms per campaign
    risky = (
        df[df["wasted_spend"] > 0]
        .groupby("campaign")["search_term"]
        .nunique()
        .reset_index(name="risky_terms_count")
    )
    agg = agg.merge(risky, on="campaign", how="left")
    agg["risky_terms_count"] = agg["risky_terms_count"].fillna(0).astype(int)

    return _round_df(agg)


def compute_adgroup_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Ad-group-level aggregated metrics (within campaign)."""
    agg = aggregate_by(df, ["campaign", "ad_group"])
    return _round_df(agg)


def compute_search_term_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Search-term-level metrics. If data spans multiple dates,
    aggregate across dates per (campaign, ad_group, search_term).
    """
    group_cols = ["campaign", "ad_group", "search_term", "match_type"]
    # Add category if it exists (added in categorization step)
    if "category" in df.columns:
        group_cols.append("category")

    agg = aggregate_by(df, group_cols)
    return _round_df(agg)


def _round_df(df: pd.DataFrame, decimals: int = 4) -> pd.DataFrame:
    """Round all float columns for clean JSON output."""
    float_cols = df.select_dtypes(include=["float64", "float32"]).columns
    df[float_cols] = df[float_cols].round(decimals)
    return df
