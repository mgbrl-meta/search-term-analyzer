"""
parser.py — File parsing and column normalization.

Accepts a CSV or Excel file uploaded by the user, reads it into a DataFrame,
and normalizes column names to internal standard names.
"""

import io
import pandas as pd
from typing import Tuple, List, Dict

# ─── Column name mapping ────────────────────────────────────────────────────
# Maps every Google Ads export variant we know about → internal standard name.
# Add more variants here if you encounter different exports.

COLUMN_MAP: Dict[str, str] = {
    # Search term
    "search term": "search_term",
    "search terms": "search_term",
    "search_term": "search_term",
    "search keyword": "search_term",
    "keyword": "search_term",
    "query": "search_term",

    # Campaign
    "campaign": "campaign",
    "campaign name": "campaign",
    "campaign_name": "campaign",

    # Ad group
    "ad group": "ad_group",
    "ad group name": "ad_group",
    "ad_group": "ad_group",
    "adgroup": "ad_group",

    # Match type
    "match type": "match_type",
    "match_type": "match_type",

    # Impressions
    "impressions": "impressions",
    "impr.": "impressions",
    "impr": "impressions",

    # Clicks
    "clicks": "clicks",
    "click": "clicks",

    # Cost
    "cost": "cost",
    "spend": "cost",
    "total cost": "cost",
    "cost (inr)": "cost",
    "cost (usd)": "cost",
    "cost (gbp)": "cost",
    "cost (eur)": "cost",
    "cost (aud)": "cost",

    # Conversions
    "conversions": "conversions",
    "conv.": "conversions",
    "conversion": "conversions",
    "all conv.": "conversions",
    "all conversions": "conversions",

    # Purchases
    "purchases": "purchases",
    "purchase": "purchases",
    "transactions": "purchases",

    # Conversion value
    "conversion value": "conversion_value",
    "conv. value": "conversion_value",
    "all conv. value": "conversion_value",
    "all conversion value": "conversion_value",
    "conv. value (inr)": "conversion_value",
    "revenue": "conversion_value",
    "value": "conversion_value",
    "value / cost": "roas",

    # Date
    "day": "date",
    "date": "date",
    "week": "date",
    "month": "date",

    # Derived metrics (may exist in export)
    "ctr": "ctr",
    "click through rate": "ctr",
    "avg. cpc": "avg_cpc",
    "average cpc": "avg_cpc",
    "avg cpc": "avg_cpc",
    "roas": "roas",
    "cost / conv.": "cost_per_conv",
    "cost/conv.": "cost_per_conv",
}

REQUIRED_COLUMNS = ["search_term", "clicks", "cost"]
PREFERRED_COLUMNS = [
    "campaign", "ad_group", "impressions",
    "conversions", "purchases", "conversion_value", "date",
]


def parse_file(file_bytes: bytes, filename: str) -> Tuple[pd.DataFrame, List[str]]:
    """
    Read a CSV or Excel file and return a raw DataFrame plus any warnings.

    Parameters
    ----------
    file_bytes : raw bytes of the uploaded file
    filename   : original filename (used to detect extension)

    Returns
    -------
    df       : raw DataFrame (not yet cleaned)
    warnings : list of warning strings for the caller
    """
    warnings: List[str] = []
    fname = filename.lower()

    try:
        if fname.endswith(".csv"):
            # Try common encodings
            for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
                try:
                    df = pd.read_csv(
                        io.BytesIO(file_bytes),
                        encoding=enc,
                        thousands=",",
                        low_memory=False,
                        skip_blank_lines=True,
                    )
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise ValueError("Could not decode CSV — try saving as UTF-8.")

        elif fname.endswith((".xlsx", ".xls")):
            df = pd.read_excel(
                io.BytesIO(file_bytes),
                engine="openpyxl" if fname.endswith(".xlsx") else "xlrd",
            )
        else:
            raise ValueError(
                f"Unsupported file type '{filename}'. Please upload a CSV or Excel (.xlsx) file."
            )
    except Exception as e:
        raise ValueError(f"Could not read file: {e}")

    if df.empty:
        raise ValueError("The uploaded file is empty.")

    return df, warnings


def normalize_columns(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """
    Normalize column names using COLUMN_MAP.

    - Strips whitespace, lowercases all headers.
    - Maps known variants to standard internal names.
    - Drops duplicate columns that map to the same internal name (keeps first).
    - Returns the normalized DataFrame and a list of warnings.
    """
    warnings: List[str] = []

    # Lowercase + strip all column names
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Rename using the map
    rename = {}
    for col in df.columns:
        if col in COLUMN_MAP:
            rename[col] = COLUMN_MAP[col]
    df = df.rename(columns=rename)

    # If multiple source columns mapped to the same target, keep first and drop rest
    seen: set = set()
    cols_to_keep = []
    for col in df.columns:
        if col not in seen:
            cols_to_keep.append(col)
            seen.add(col)
        else:
            warnings.append(f"Duplicate column '{col}' dropped (keeping first occurrence).")
    df = df[cols_to_keep]

    # Check required columns
    missing_required = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_required:
        raise ValueError(
            f"Missing required columns: {missing_required}. "
            f"Please make sure your export includes: {REQUIRED_COLUMNS}."
        )

    # Warn about missing preferred columns
    missing_preferred = [c for c in PREFERRED_COLUMNS if c not in df.columns]
    if missing_preferred:
        warnings.append(
            f"Some preferred columns not found and will be set to defaults: {missing_preferred}"
        )

    return df, warnings


def validate_and_parse(file_bytes: bytes, filename: str) -> Tuple[pd.DataFrame, List[str]]:
    """
    Full entry point: parse file → normalize columns.
    Returns normalized DataFrame and aggregated warnings.
    """
    df, w1 = parse_file(file_bytes, filename)
    df, w2 = normalize_columns(df)
    return df, w1 + w2
