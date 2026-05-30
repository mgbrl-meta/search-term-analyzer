"""
parser.py — Robust ingestion for Google Shopping Search Term reports.
Supports CSV, TSV, UTF-16 CSV, XLSX files, and Google Ads report metadata rows.
"""

import csv
import io
from typing import Any

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
    key = str(raw_col).strip().lower()
    key = key.replace("\ufeff", "")
    key = key.replace("\x00", "")
    key = key.replace("\n", " ")
    key = " ".join(key.split())
    return key


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename_map: dict[Any, str] = {}

    for raw_col in df.columns:
        key = _header_key(raw_col)
        if key in COLUMN_ALIASES:
            rename_map[raw_col] = COLUMN_ALIASES[key]

    df = df.rename(columns=rename_map)

    # If duplicate canonical columns appear, keep first non-empty value.
    if df.columns.duplicated().any():
        df = df.T.groupby(level=0).first().T

    return df


def _decode_text(file_bytes: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "utf-16", "utf-16-le", "utf-16-be", "latin-1"):
        try:
            text = file_bytes.decode(encoding)
            # Avoid accepting binary-looking garbage.
            if "Search term" in text or "search term" in text.lower() or "Clicks" in text or "clicks" in text.lower():
                return text
        except UnicodeDecodeError:
            continue

    return file_bytes.decode("latin-1", errors="replace")


def _sniff_delimiter(sample: str) -> str:
    candidates = [",", "\t", ";"]
    lines = [line for line in sample.splitlines()[:30] if line.strip()]

    best_delimiter = ","
    best_score = 0

    for delimiter in candidates:
        score = 0
        for line in lines:
            try:
                cells = next(csv.reader([line], delimiter=delimiter))
                if len(cells) > score:
                    score = len(cells)
            except Exception:
                continue

        if score > best_score:
            best_score = score
            best_delimiter = delimiter

    return best_delimiter


def _row_has_required_headers(cells: list[object]) -> bool:
    keys = {_header_key(cell) for cell in cells}

    has_search_term = "search term" in keys or "search terms" in keys
    has_clicks = "clicks" in keys or "click" in keys
    has_cost = "cost" in keys or "spend" in keys
    has_impressions = "impr." in keys or "impr" in keys or "impressions" in keys

    return has_search_term and has_clicks and has_cost and has_impressions


def _find_header_line(text: str, delimiter: str) -> int:
    lines = text.splitlines()

    for idx, line in enumerate(lines):
        if not line.strip():
            continue

        try:
            cells = next(csv.reader([line], delimiter=delimiter, quotechar='"'))
        except Exception:
            continue

        if _row_has_required_headers(cells):
            return idx

    return 0


def _read_csv_like(file_bytes: bytes, filename: str) -> pd.DataFrame:
    text = _decode_text(file_bytes)
    delimiter = _sniff_delimiter(text)
    header_line = _find_header_line(text, delimiter)

    try:
        df = pd.read_csv(
            io.StringIO(text),
            skiprows=header_line,
            engine="python",
            sep=delimiter,
            quotechar='"',
            on_bad_lines="skip",
        )
    except Exception as exc:
        raise ValueError(f"Could not read file '{filename}' as CSV/TSV: {exc}") from exc

    # If we still got one garbage column, fail with clear guidance.
    if len(df.columns) <= 1 and not any(_header_key(c) in COLUMN_ALIASES for c in df.columns):
        preview = str(df.columns[0])[:80] if len(df.columns) else "no columns"
        raise ValueError(
            f"Could not detect Google Ads table headers. Found first column: {preview!r}. "
            "Please export/download the report as CSV or XLSX directly from Google Ads, not an Excel temporary/system file."
        )

    return df


def _read_excel_any_header(file_bytes: bytes, filename: str) -> pd.DataFrame:
    try:
        raw = pd.read_excel(io.BytesIO(file_bytes), header=None, engine="openpyxl")
    except Exception as exc:
        raise ValueError(f"Could not read file '{filename}' as Excel: {exc}") from exc

    raw = raw.dropna(how="all").reset_index(drop=True)

    header_idx = None
    for idx in range(len(raw)):
        cells = raw.iloc[idx].tolist()
        if _row_has_required_headers(cells):
            header_idx = idx
            break

    if header_idx is None:
        preview = raw.head(5).to_string(index=False)
        raise ValueError(
            "Could not find Google Ads header row in Excel file. "
            f"Expected Search term, Clicks, Impr., and Cost. Preview:\n{preview}"
        )

    columns = raw.iloc[header_idx].tolist()
    df = raw.iloc[header_idx + 1 :].copy()
    df.columns = [str(c).strip() for c in columns]
    df = df.dropna(how="all").reset_index(drop=True)

    return df


def _looks_like_xlsx(file_bytes: bytes) -> bool:
    return file_bytes[:2] == b"PK"


def _looks_like_legacy_xls(file_bytes: bytes) -> bool:
    return file_bytes[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def _coerce_numerics(df: pd.DataFrame) -> pd.DataFrame:
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


def _filter_spend_rows(df: pd.DataFrame) -> pd.DataFrame:
    """
    Keep only search terms with actual spend.

    Google Ads exports can include impression-only rows with Cost = 0.
    For waste, ROAS, drain, n-gram, and prioritization analysis, these rows
    create noise because they are not consuming budget.
    """
    if "cost" not in df.columns:
        return df

    before_count = len(df)
    df = df[df["cost"] > 0].copy()
    df.attrs["zero_spend_rows_removed"] = before_count - len(df)

    return df

def _validate(df: pd.DataFrame) -> None:
    missing = REQUIRED_COLUMNS - set(df.columns)

    if missing:
        found = ", ".join(map(str, df.columns.tolist()[:30]))
        raise ValueError(
            f"Upload is missing required columns: {', '.join(sorted(missing))}. "
            f"Found columns: {found}"
        )


def _drop_google_ads_summary_rows(df: pd.DataFrame) -> pd.DataFrame:
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
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if filename.startswith("._"):
        raise ValueError(
            "You uploaded a macOS system/resource-fork file. "
            "Please upload the real Google Ads CSV/XLSX file, not the file starting with ._"
        )

    try:
        if ext in ("xlsx", "xls") or _looks_like_xlsx(file_bytes):
            df = _read_excel_any_header(file_bytes, filename)
        elif _looks_like_legacy_xls(file_bytes):
            raise ValueError(
                "Legacy .xls files are not supported. Please download/export the report as .xlsx or .csv."
            )
        elif ext in ("csv", "tsv", "txt") or ext == "":
            df = _read_csv_like(file_bytes, filename)
        else:
            raise ValueError(f"Unsupported file type: '{ext}'. Please upload CSV or XLSX.")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Could not read file '{filename}': {exc}") from exc

    df = df.dropna(how="all").reset_index(drop=True)
    df = df.dropna(axis=1, how="all")
    df.columns = [str(c).strip() for c in df.columns]

    df = _normalise_columns(df)
    df = _drop_google_ads_summary_rows(df)

    _validate(df)

    df = _coerce_numerics(df)
    df = _filter_spend_rows(df)
    df = _add_missing_columns(df)

    df["search_term"] = df["search_term"].astype(str).str.strip().str.lower()
    df = df[df["search_term"] != ""].reset_index(drop=True)

    return df
