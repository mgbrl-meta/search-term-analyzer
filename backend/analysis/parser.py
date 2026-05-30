"""
parser.py — Handles ingestion of Google Shopping Search Term reports.
Supports CSV and XLSX uploads, normalises column names, and returns
a clean DataFrame ready for downstream analysis.
"""

import csv
import io
import re
from typing import Any

import numpy as np
import pandas as pd


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
    "all conv": "conversions",

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

    # Added / excluded status
    "added/excluded": "added_excluded",
    "added excluded": "added_excluded",
    "added or excluded": "added_excluded",
}


REQUIRED_COLUMNS = {"search_term", "impressions", "clicks", "cost"}
NUMERIC_COLUMNS = ["impressions", "clicks", "cost", "conversions", "conv_value", "avg_cpc"]


def _header_key(raw_col: object) -> str:
    """Normalize Google Ads headers for reliable alias matching."""
    key = str(raw_col).strip().lower()
    key = key.replace("\ufeff", "")
    key = key.replace("\n", " ")
    key = " ".join(key.split())
    return key


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename raw column headers to canonical names."""
    rename_map: dict[Any, str] = {}

    for raw_col in df.columns:
        key = _header_key(raw_col)
        if key in COLUMN_ALIASES:
            rename_map[raw_col] = COLUMN_ALIASES[key]

    df = df.rename(columns=rename_map)

    # If duplicate canonical columns appear, keep the first non-empty value.
    if df.columns.duplicated().any():
        df = df.T.groupby(level=0).first().T

    return df


def _decode_csv_bytes(file_bytes: bytes) -> str:
    """Decode uploaded CSV bytes safely."""
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("latin-1", errors="replace")


def _find_google_ads_header_line(text: str) -> int:
    """
    Google Ads sometimes exports CSV files with report metadata before the real table.
    Find the row containing the actual header, usually starting with Search term.
    """
    lines = text.splitlines()

    for idx, line in enumerate(lines):
        if not line.strip():
            continue

        try:
            cells = next(csv.reader([line]))
        except Exception:
            continue

        normalised_cells = {_header_key(cell) for cell in cells}

        has_search_term = "search term" in normalised_cells or "search terms" in normalised_cells
        has_required_metrics = (
            ("clicks" in normalised_cells or "click" in normalised_cells)
            and ("cost" in normalised_cells or "spend" in normalised_cells)
            and ("impr." in normalised_cells or "impr" in normalised_cells or "impressions" in normalised_cells)
        )

        if has_search_term and has_required_metrics:
            return idx

    return 0


def _read_csv(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Read Google Ads CSV robustly, including files with pre-header report metadata."""
    text = _decode_csv_bytes(file_bytes)
    header_line = _find_google_ads_header_line(text)

    try:
        return pd.read_csv(
            io.StringIO(text),
            skiprows=header_line,
            engine="python",
            sep=",",
            quotechar='"',
            escapechar="\\",
            on_bad_lines="skip",
        )
    except Exception as first_exc:
        # Fallback for unusual Google exports / locale variants.
        try:
            return pd.read_csv(
                io.StringIO(text),
                skiprows=header_line,
                engine="python",
                sep=None,
                quotechar='"',
                on_bad_lines="skip",
            )
        except Exception as second_exc:
            raise ValueError(
                f"Could not read file '{filename}'. First error: {first_exc}. Second error: {second_exc}"
            ) from second_exc


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
            f"Found columns: {', '.join(map(str, df.columns.tolist()))}"
        )


def _drop_google_ads_summary_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Remove footer/summary rows from Google Ads exports."""
    if "search_term" not in df.columns:
        return df

    search = df["search_term"].astype(str).str.strip().str.lower()

    bad_patterns = (
        search.eq("")
        | search.eq("nan")
        | search.str.startswith("total")
        | search.str.startswith("rows")
        | search.str.startswith("report")
        | search.str.contains("search terms report", na=False)
    )

    return df[~bad_patterns].copy()


def parse_upload(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """
    Parse an uploaded Google Ads Search Term report.

    Parameters
    ----------
    file_bytes : bytes
        Raw file content.
    filename : str
        Original filename.

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
            df = _read_csv(file_bytes, filename)
        else:
            raise ValueError(f"Unsupported file type: '{ext}'. Please upload CSV or XLSX.")
    except Exception as exc:
        if isinstance(exc, ValueError):
            raise
        raise ValueError(f"Could not read file '{filename}': {exc}") from exc

    df = df.dropna(how="all").reset_index(drop=True)
    df = df.dropna(axis=1, how="all")
    df.columns = [str(c).strip() for c in df.columns]

    df = _normalise_columns(df)
    df = _drop_google_ads_summary_rows(df)

    _validate(df)

    df = _coerce_numerics(df)
    df = _add_missing_columns(df)

    df["search_term"] = df["search_term"].astype(str).str.strip().str.lower()
    df = df[df["search_term"] != ""].reset_index(drop=True)

    return df
