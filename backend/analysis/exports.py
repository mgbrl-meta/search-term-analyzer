"""
exports.py — Export utilities for the Search Term Analyzer.

Supports:
  - CSV export  (full table, utf-8 with BOM for Excel compatibility)
  - XLSX export (multi-sheet: Summary | Full Data | Recommendations | N-grams)
"""

from __future__ import annotations

import io
from typing import Any

import pandas as pd

# ---------------------------------------------------------------------------
# Column display config for the main data sheet
# ---------------------------------------------------------------------------

DISPLAY_COLUMNS: list[tuple[str, str]] = [
    # (internal_name, display_header)
    ("search_term",    "Search Term"),
    ("campaign",       "Campaign"),
    ("ad_group",       "Ad Group"),
    ("match_type",     "Match Type"),
    ("impressions",    "Impressions"),
    ("clicks",         "Clicks"),
    ("ctr",            "CTR (%)"),
    ("cost",           "Cost (₹)"),
    ("avg_cpc",        "Avg CPC (₹)"),
    ("cpc",            "Calc CPC (₹)"),
    ("conversions",    "Conversions"),
    ("cvr",            "CVR (%)"),
    ("conv_value",     "Revenue (₹)"),
    ("roas",           "ROAS"),
    ("cpa",            "CPA (₹)"),
    ("aov",            "AOV (₹)"),
    ("revenue_share",  "Revenue Share (%)"),
    ("cost_share",     "Cost Share (%)"),
    ("quality_score",  "Quality Score"),
    ("tier",           "Tier"),
    ("intent",         "Intent"),
    ("category",       "Category"),
]


def _filter_columns(df: pd.DataFrame, col_map: list[tuple[str, str]]) -> pd.DataFrame:
    """Return a DataFrame with only the columns present in col_map, renamed."""
    existing = [(c, h) for c, h in col_map if c in df.columns]
    renamed = df[[c for c, _ in existing]].copy()
    renamed.columns = [h for _, h in existing]
    return renamed


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------

def export_csv(df: pd.DataFrame) -> bytes:
    """Return UTF-8 BOM CSV bytes for the full data table."""
    out = _filter_columns(df, DISPLAY_COLUMNS)
    buffer = io.StringIO()
    out.to_csv(buffer, index=False, encoding="utf-8-sig")
    return buffer.getvalue().encode("utf-8-sig")


# ---------------------------------------------------------------------------
# XLSX export
# ---------------------------------------------------------------------------

_TIER_BG_COLOURS: dict[str, str] = {
    "Star":     "C6EFCE",   # green
    "Solid":    "BDD7EE",   # blue
    "Weak":     "FFEB9C",   # yellow
    "Drain":    "FFC7CE",   # red
    "Untested": "F2F2F2",   # grey
}

_PRIORITY_BG_COLOURS: dict[str, str] = {
    "Critical": "FFC7CE",
    "High":     "FFEB9C",
    "Medium":   "BDD7EE",
    "Low":      "F2F2F2",
}


def _write_summary_sheet(ws, summary: dict[str, Any], workbook) -> None:
    header_fmt = workbook.add_format({
        "bold": True, "bg_color": "#1a1a2e", "font_color": "#ffffff",
        "border": 1, "font_size": 12,
    })
    value_fmt = workbook.add_format({"border": 1, "num_format": "#,##0.00"})
    label_fmt = workbook.add_format({"bold": True, "border": 1})

    ws.set_column("A:A", 30)
    ws.set_column("B:B", 20)

    ws.write("A1", "Metric", header_fmt)
    ws.write("B1", "Value", header_fmt)

    metrics = [
        ("Unique Search Terms",   summary.get("unique_terms", 0)),
        ("Total Impressions",     summary.get("total_impressions", 0)),
        ("Total Clicks",          summary.get("total_clicks", 0)),
        ("Total Cost (₹)",        summary.get("total_cost", 0.0)),
        ("Total Conversions",     summary.get("total_conversions", 0.0)),
        ("Total Revenue (₹)",     summary.get("total_revenue", 0.0)),
        ("Blended ROAS",          summary.get("blended_roas", 0.0)),
        ("Blended CTR (%)",       summary.get("blended_ctr", 0.0)),
        ("Blended CVR (%)",       summary.get("blended_cvr", 0.0)),
        ("Blended CPA (₹)",       summary.get("blended_cpa", 0.0)),
    ]

    for row_idx, (label, val) in enumerate(metrics, start=1):
        ws.write(row_idx, 0, label, label_fmt)
        ws.write(row_idx, 1, val, value_fmt)

    # Tier breakdown
    tier_row = len(metrics) + 2
    ws.write(tier_row, 0, "Tier Breakdown", header_fmt)
    ws.write(tier_row, 1, "Count", header_fmt)
    for i, (tier, count) in enumerate(summary.get("tier_counts", {}).items(), start=1):
        bg = _TIER_BG_COLOURS.get(tier, "FFFFFF")
        tier_fmt = workbook.add_format({"bg_color": bg, "border": 1, "bold": True})
        ws.write(tier_row + i, 0, tier, tier_fmt)
        ws.write(tier_row + i, 1, count, workbook.add_format({"bg_color": bg, "border": 1}))


def _write_data_sheet(ws, df: pd.DataFrame, workbook) -> None:
    display_df = _filter_columns(df, DISPLAY_COLUMNS)

    header_fmt = workbook.add_format({
        "bold": True, "bg_color": "#16213e", "font_color": "#ffffff",
        "border": 1, "text_wrap": True,
    })
    base_fmt = workbook.add_format({"border": 1})
    num_fmt = workbook.add_format({"border": 1, "num_format": "#,##0.00"})

    tier_fmts: dict[str, Any] = {
        tier: workbook.add_format({"bg_color": bg, "border": 1})
        for tier, bg in _TIER_BG_COLOURS.items()
    }

    # Headers
    ws.set_row(0, 28)
    for col_idx, col_name in enumerate(display_df.columns):
        ws.write(0, col_idx, col_name, header_fmt)
        ws.set_column(col_idx, col_idx, max(12, len(col_name) + 2))

    # Wider search term column
    ws.set_column(0, 0, 45)

    tier_col_idx = next(
        (i for i, h in enumerate(display_df.columns) if h == "Tier"), None
    )

    for row_idx, row in enumerate(display_df.itertuples(index=False), start=1):
        tier_val = str(row[tier_col_idx]) if tier_col_idx is not None else ""
        row_bg_fmt = tier_fmts.get(tier_val, base_fmt)

        for col_idx, val in enumerate(row):
            if isinstance(val, (int, float)):
                fmt = workbook.add_format({
                    "border": 1,
                    "num_format": "#,##0.00",
                    "bg_color": row_bg_fmt.bg_color if hasattr(row_bg_fmt, "bg_color") else "FFFFFF",
                })
                ws.write(row_idx, col_idx, val, fmt)
            else:
                ws.write(row_idx, col_idx, val, row_bg_fmt)


def _write_recommendations_sheet(ws, recs: list[dict], workbook) -> None:
    headers = ["Priority", "Type", "Title", "Description", "Affected Terms", "Est. Impact (₹)"]
    header_fmt = workbook.add_format({
        "bold": True, "bg_color": "#0f3460", "font_color": "#ffffff", "border": 1,
    })
    wrap_fmt = workbook.add_format({"border": 1, "text_wrap": True, "valign": "top"})

    col_widths = [12, 18, 40, 60, 50, 18]
    for i, (h, w) in enumerate(zip(headers, col_widths)):
        ws.write(0, i, h, header_fmt)
        ws.set_column(i, i, w)

    for row_idx, rec in enumerate(recs, start=1):
        priority = rec.get("priority", "Low")
        bg = _PRIORITY_BG_COLOURS.get(priority, "FFFFFF")
        row_fmt = workbook.add_format({"bg_color": bg, "border": 1, "text_wrap": True, "valign": "top"})

        terms_str = ", ".join(rec.get("terms", [])[:10])
        if len(rec.get("terms", [])) > 10:
            terms_str += f" (+{len(rec['terms']) - 10} more)"

        ws.write(row_idx, 0, priority, row_fmt)
        ws.write(row_idx, 1, rec.get("type", ""), row_fmt)
        ws.write(row_idx, 2, rec.get("title", ""), row_fmt)
        ws.write(row_idx, 3, rec.get("description", ""), row_fmt)
        ws.write(row_idx, 4, terms_str, row_fmt)
        ws.write(row_idx, 5, rec.get("impact", 0.0), row_fmt)
        ws.set_row(row_idx, 50)


def _write_ngrams_sheet(ws, ngrams: list[dict], workbook, title: str = "N-grams") -> None:
    if not ngrams:
        ws.write(0, 0, "No n-gram data available.")
        return

    headers = [
        "N-gram", "N", "Term Count", "Impressions", "Clicks", "CTR (%)",
        "Cost (₹)", "CPC (₹)", "Conversions", "CVR (%)", "Revenue (₹)", "ROAS",
        "High ROAS", "Zero Conv.", "High Spend No Conv.", "Opportunity",
    ]
    header_fmt = workbook.add_format({
        "bold": True, "bg_color": "#533483", "font_color": "#ffffff", "border": 1,
    })
    num_fmt = workbook.add_format({"border": 1, "num_format": "#,##0.00"})
    base_fmt = workbook.add_format({"border": 1})

    for i, h in enumerate(headers):
        ws.write(0, i, h, header_fmt)

    ws.set_column(0, 0, 30)

    field_map = [
        "ngram", "n", "term_count", "impressions", "clicks", "ctr",
        "cost", "cpc", "conversions", "cvr", "revenue", "roas",
        "high_roas_flag", "zero_conversion_flag", "high_spend_no_conv_flag", "opportunity_flag",
    ]

    for row_idx, row in enumerate(ngrams, start=1):
        for col_idx, field in enumerate(field_map):
            val = row.get(field, "")
            fmt = num_fmt if isinstance(val, (int, float)) else base_fmt
            ws.write(row_idx, col_idx, val, fmt)


def export_xlsx(
    df: pd.DataFrame,
    summary: dict[str, Any],
    recommendations: list[dict],
    ngrams_data: dict[str, list[dict]],
) -> bytes:
    """
    Build a multi-sheet XLSX workbook and return it as bytes.

    Sheets
    ------
    1. Summary         — headline metrics + tier breakdown
    2. Full Data       — all search terms with all metrics
    3. Recommendations — prioritised action list
    4. Unigrams        — 1-gram frequency table
    5. Bigrams         — 2-gram frequency table
    6. Trigrams        — 3-gram frequency table
    """
    buffer = io.BytesIO()

    with pd.ExcelWriter(buffer, engine="xlsxwriter") as writer:
        workbook = writer.book

        # Sheet 1: Summary
        ws_summary = workbook.add_worksheet("Summary")
        writer.sheets["Summary"] = ws_summary
        _write_summary_sheet(ws_summary, summary, workbook)

        # Sheet 2: Full Data
        ws_data = workbook.add_worksheet("Full Data")
        writer.sheets["Full Data"] = ws_data
        _write_data_sheet(ws_data, df, workbook)

        # Sheet 3: Recommendations
        ws_recs = workbook.add_worksheet("Recommendations")
        writer.sheets["Recommendations"] = ws_recs
        _write_recommendations_sheet(ws_recs, recommendations, workbook)

        # Sheets 4-6: N-grams
        for n_label, sheet_name in [("1", "Unigrams"), ("2", "Bigrams"), ("3", "Trigrams")]:
            ws_ng = workbook.add_worksheet(sheet_name)
            writer.sheets[sheet_name] = ws_ng
            _write_ngrams_sheet(ws_ng, ngrams_data.get(n_label, []), workbook, title=sheet_name)

    buffer.seek(0)
    return buffer.read()
