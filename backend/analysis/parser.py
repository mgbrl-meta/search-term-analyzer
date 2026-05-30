"""
parser.py — Handles ingestion of Google Shopping Search Term reports.
Supports CSV and XLSX uploads, normalises column names, and returns
a clean DataFrame ready for downstream analysis.
"""

import io
import pandas as pd
import numpy as np

# ---------------------------------------------------------------------------
# Expected column aliases (lower-stripped) → canonical names
# ---------------------------------------------------------------------------
COLUMN_ALIASES: dict[str, str] = {
    # Search term
    "search term": "search_term",
    "search terms": "search_term",
    "search_term": "search_term",
    "keyword": "search_term",
    "query": "search_term",
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
    "cost (usd)": "cost",
    "cost (inr)": "cost",
    "total cost": "cost",
    # Conversions
    "conversions": "conversions",
    "conv.": "conversions",
    "conv": "conversions",
    "all conv.": "conversions",
    # Conversion value / revenue
    "conv value": "conv_value",
    "conv. value": "conv_value",
    "conversion value": "conv_value",
    "conversions value": "conv_value",
    "all conv value": "conv_value",
    "all conv. value": "conv_value",
    "all conversion value": "conv_value",
    "all conversions value": "conv_value",
    "total conversion value": "conv_value",
    "total conv. value": "conv_value",
    "conv. value by conversion time": "conv_value",
    "conversion value by conversion time": "conv_value",
    "all conv. value by conversion time": "conv_value",
    "revenue": "conv_value",
    "total revenue": "conv_value",
    # CTR
    "ctr": "ctr",
    "click through rate": "ctr",
    # CPC
    "avg. cpc": "avg_cpc",
    "average cpc": "avg_cpc",
    "avg cpc": "avg_cpc",
    # Match type
    "match type": "match_type",
    "matchtype": "match_type",
    "match_type": "match_type",
    # Ad group
    "ad group": "ad_group",
    "ad_group": "ad_group",
    "adgroup": "ad_group",
    # Campaign
    "campaign": "campaign",
    # Added / excluded status (optional)
    "added/excluded": "added_excluded",
    "added excluded": "added_excluded",
}

REQUIRED_COLUMNS = {"search_term", "impressions", "clicks", "cost"}
NUMERIC_COLUMNS = ["impressions", "clicks", "cost", "conversions", "conv_value", "avg_cpc"]


def _header_key(raw_col: object) -> str:
    """Normalize Google Ads headers for more reliable alias matching."""
    key = str(raw_col).strip().lower()
    key = key.replace("\ufeff", "")
    key = key.replace("\n", " ")
    key = " ".join(key.split())
    return key


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename raw column headers to canonical names."""
    rename_map: dict[str, str] = {}
    for raw_col in df.columns:
        key = _header_key(raw_col)
        if key in COLUMN_ALIASES:
            rename_map[raw_col] = COLUMN_ALIASES[key]
    return df.rename(columns=rename_map)


def _coerce_numerics(df: pd.DataFrame) -> pd.DataFrame:
    """Strip currency/percentage symbols and coerce to float."""
    for col in NUMERIC_COLUMNS:
        if col not in df.columns:
            continue
        if df[col].dtype == object:
            df[col] = (
                df[col]
                .astype(str)
                .str.replace(r"[₹$£€,%]", "", regex=True)
                .str.replace(r"\bINR\b", "", regex=True, case=False)
                .str.replace(r"\bRs\.?\b", "", regex=True, case=False)
                .str.replace(",", "", regex=False)
                .str.replace("--", "0", regex=False)
                .str.replace("—", "0", regex=False)
                .str.replace("-", "0", regex=False)
                .str.strip()
            )
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    return df


def _add_missing_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Add optional columns with sensible defaults if not present."""
    defaults: dict[str, float | str] = {
        "conversions": 0.0,
        "avg_cpc": 0.0,
        "match_type": "Unknown",
        "ad_group": "Unknown",
        "campaign": "Unknown",
    }

    for col, default in defaults.items():
        if col not in df.columns:
            df[col] = default

    # Revenue/value is special. If missing, keep the app alive but mark it clearly.
    if "conv_value" not in df.columns:
        df["conv_value"] = 0.0
        df.attrs["missing_conv_value"] = True
    else:
        df.attrs["missing_conv_value"] = False

    return df


def _validate(df: pd.DataFrame) -> None:
    """Raise ValueError if required columns are missing."""
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            f"Upload is missing required columns: {', '.join(sorted(missing))}. "
            f"Found columns: {', '.join(df.columns.tolist())}"
        )


def parse_upload(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """
    Parse an uploaded Google Ads Search Term report.

    Parameters
    ----------
    file_bytes : bytes
        Raw file content.
    filename : str
        Original filename (used to detect format).

    Returns
    -------
    pd.DataFrame
        Normalised DataFrame with canonical column names.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    try:
        if ext in ("xls", "xlsx"):
            df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
        elif ext == "csv":
            # Try UTF-8 first, fall back to latin-1
            try:
                df = pd.read_csv(io.StringIO(file_bytes.decode("utf-8")))
            except UnicodeDecodeError:
                df = pd.read_csv(io.StringIO(file_bytes.decode("latin-1")))
        else:
            raise ValueError(f"Unsupported file type: '{ext}'. Please upload CSV or XLSX.")
    except Exception as exc:
        raise ValueError(f"Could not read file '{filename}': {exc}") from exc

    # Drop completely empty rows / columns that Google Ads sometimes adds
    df = df.dropna(how="all").reset_index(drop=True)
    df.columns = [str(c).strip() for c in df.columns]

    # Skip Google Ads header/footer summary rows (e.g. "Total: …")
    if "search_term" not in [c.lower() for c in df.columns]:
        df = _normalise_columns(df)
    else:
        df = _normalise_columns(df)

    # Drop rows where search_term is a Google summary row
    if "search_term" in df.columns:
        df = df[~df["search_term"].astype(str).str.lower().str.startswith("total")]

    _validate(df)
    df = _coerce_numerics(df)
    df = _add_missing_columns(df)

    # Ensure search_term is a clean string
    df["search_term"] = df["search_term"].astype(str).str.strip().str.lower()
    df = df[df["search_term"] != ""].reset_index(drop=True)

    return df
