"""
cleaner.py — Data cleaning and normalization.

Takes the column-normalized DataFrame from parser.py and produces a
clean, analysis-ready DataFrame with proper dtypes and no junk rows.
"""

import re
import pandas as pd
import numpy as np
from typing import List, Tuple

# Patterns in the search_term column that indicate Google Ads summary rows
SUMMARY_PATTERNS = [
    r"^total$",
    r"^account total",
    r"^campaign total",
    r"^ad group total",
    r"^all campaigns",
]
SUMMARY_RE = re.compile("|".join(SUMMARY_PATTERNS), re.IGNORECASE)


def _strip_currency_and_convert(series: pd.Series) -> pd.Series:
    """
    Convert a mixed-format money/number column to float.

    Handles:
    - Currency symbols: ₹ $ £ € ¥
    - Comma thousands separators: 1,234.56
    - Percentage sign (strips it, divides by 100 if column is CTR-like)
    - Text like '--', 'N/A', '' → NaN
    """
    s = series.astype(str).str.strip()
    # Remove currency symbols and spaces
    s = s.str.replace(r"[₹$£€¥,\s]", "", regex=True)
    # Remove trailing/leading quotes that sometimes appear
    s = s.str.replace(r'^"|"$', "", regex=True)
    # Replace dashes/blanks with NaN
    s = s.replace({"--": np.nan, "-": np.nan, "n/a": np.nan, "": np.nan})
    return pd.to_numeric(s, errors="coerce")


def _convert_percentage(series: pd.Series) -> pd.Series:
    """
    Convert a percentage column (e.g. '3.5%') to a decimal fraction (0.035).
    """
    s = series.astype(str).str.strip()
    has_pct = s.str.endswith("%")
    s = s.str.replace("%", "", regex=False)
    s = _strip_currency_and_convert(s)
    # Divide rows that had % sign by 100
    s = s.where(~has_pct, s / 100)
    return s


def remove_summary_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Remove Google Ads totals/summary rows."""
    if "search_term" in df.columns:
        mask = df["search_term"].astype(str).str.strip().str.match(SUMMARY_RE)
        df = df[~mask].copy()
    return df


def clean_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert all numeric columns to proper float/int types.
    Handles currency symbols, commas, and percentage values.
    """
    money_cols = ["cost", "conversion_value", "avg_cpc", "cost_per_conv"]
    count_cols = ["impressions", "clicks", "conversions", "purchases"]
    pct_cols   = ["ctr"]
    plain_num  = ["roas", "avg_cpc"]  # May arrive as plain numbers

    for col in money_cols:
        if col in df.columns:
            df[col] = _strip_currency_and_convert(df[col])

    for col in count_cols:
        if col in df.columns:
            df[col] = _strip_currency_and_convert(df[col])
            df[col] = df[col].fillna(0).round(0).astype(float)

    for col in pct_cols:
        if col in df.columns:
            df[col] = _convert_percentage(df[col])

    for col in plain_num:
        if col in df.columns:
            df[col] = _strip_currency_and_convert(df[col])

    return df


def fill_missing_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add any missing preferred columns with sensible defaults.
    """
    defaults = {
        "campaign":         "Unknown",
        "ad_group":         "Unknown",
        "match_type":       "Unknown",
        "impressions":      0.0,
        "conversions":      0.0,
        "purchases":        0.0,
        "conversion_value": 0.0,
        "date":             None,
    }
    for col, default in defaults.items():
        if col not in df.columns:
            df[col] = default

    # If purchases is all 0 but conversions exists, use conversions as fallback
    if (df["purchases"] == 0).all() and df["conversions"].sum() > 0:
        df["purchases"] = df["conversions"].copy()

    return df


def clean_text_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize text columns: strip whitespace, fill blanks.
    """
    text_cols = ["campaign", "ad_group", "search_term", "match_type"]
    for col in text_cols:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.strip()
                .replace({"nan": "Unknown", "": "Unknown", "None": "Unknown"})
            )
    return df


def parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Try to parse the date column. If it fails, keep as string.
    """
    if "date" in df.columns and df["date"].notna().any():
        try:
            df["date"] = pd.to_datetime(df["date"], infer_format=True, errors="coerce")
        except Exception:
            pass  # Keep as-is if parsing fails
    return df


def remove_blanks_and_dupes(df: pd.DataFrame) -> pd.DataFrame:
    """
    Remove blank rows and obvious duplicates.
    A 'blank' row is one where search_term is empty.
    """
    df = df[df["search_term"].notna()].copy()
    df = df[df["search_term"].str.strip() != ""].copy()
    df = df[df["search_term"] != "Unknown"].copy()

    # Drop exact duplicates (same search_term + campaign + ad_group + date)
    dedup_cols = ["search_term", "campaign", "ad_group"]
    if "date" in df.columns:
        dedup_cols.append("date")
    df = df.drop_duplicates(subset=dedup_cols, keep="first").copy()

    return df


def clean(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """
    Full cleaning pipeline. Returns (cleaned_df, warnings).
    """
    warnings: List[str] = []
    original_len = len(df)

    df = remove_summary_rows(df)
    removed = original_len - len(df)
    if removed:
        warnings.append(f"Removed {removed} summary/total rows.")

    df = clean_numeric_columns(df)
    df = fill_missing_columns(df)
    df = clean_text_columns(df)
    df = parse_dates(df)
    df = remove_blanks_and_dupes(df)

    # Final: ensure clicks and cost are >= 0
    df["clicks"] = df["clicks"].clip(lower=0)
    df["cost"]   = df["cost"].clip(lower=0)

    if df.empty:
        raise ValueError("After cleaning, no valid rows remain. Please check your export file.")

    warnings.append(f"Cleaned data: {len(df)} rows ready for analysis.")
    return df.reset_index(drop=True), warnings
