"""
app.py — Flask API for the Google Shopping Search Term Analyzer.

Endpoints:
  POST /api/analyze          — upload file + thresholds → full analysis JSON
  POST /api/export/<type>    — re-run analysis, return specific CSV download
  GET  /api/health           — health check

Deploy on Railway / Render / any Python host.
"""

import os
import json
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

import pandas as pd

from analysis.parser          import validate_and_parse
from analysis.cleaner         import clean
from analysis.metrics         import (
    calculate_row_metrics, compute_summary,
    compute_campaign_metrics, compute_adgroup_metrics,
    compute_search_term_metrics,
)
from analysis.categories      import categorize_dataframe, compute_category_metrics
from analysis.ngrams          import run_ngram_analysis
from analysis.recommendations import generate_all_recommendations
from analysis.exports         import (
    export_search_term_report,
    export_negative_recommendations,
    export_broad_match_negatives,
    export_phrase_match_negatives,
    export_exact_match_negatives,
    export_ngram_report,
    export_daily_report,
)

app = Flask(__name__)

# Allow the Vercel frontend origin (set FRONTEND_URL env var in production)
frontend_url = os.environ.get("FRONTEND_URL", "*")
CORS(app, resources={r"/api/*": {"origins": frontend_url}})

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_thresholds(form) -> dict:
    """Extract threshold settings from form data, with safe defaults."""
    return {
        "spend_threshold":       float(form.get("spend_threshold",       1000)),
        "clicks_threshold":      int(  form.get("clicks_threshold",        20)),
        "target_roas":           float(form.get("target_roas",            2.0)),
        "ngram_spend_threshold": float(form.get("ngram_spend_threshold", 1000)),
        "ngram_clicks_threshold":int(  form.get("ngram_clicks_threshold",  20)),
        "campaign_filter":             form.get("campaign_filter",        "All"),
    }


def _run_full_analysis(file_bytes: bytes, filename: str, thresholds: dict) -> dict:
    """
    Core analysis pipeline.
    Returns a dict ready to be JSON-serialised.
    """
    warnings = []

    # 1. Parse & normalize
    df, w = validate_and_parse(file_bytes, filename)
    warnings.extend(w)

    # 2. Clean
    df, w = clean(df)
    warnings.extend(w)

    # 3. Categorize
    df = categorize_dataframe(df)

    # 4. Row-level metrics
    df = calculate_row_metrics(df)

    # 5. Apply campaign filter for analysis
    cf = thresholds.get("campaign_filter", "All")
    filtered = df if cf == "All" else df[df["campaign"] == cf].copy()
    if filtered.empty:
        filtered = df

    # 6. Aggregates
    summary       = compute_summary(filtered)
    campaigns_df  = compute_campaign_metrics(filtered)
    adgroups_df   = compute_adgroup_metrics(filtered)
    st_df         = compute_search_term_metrics(filtered)

    # 7. Category metrics
    category_df   = compute_category_metrics(filtered)

    # 8. N-gram analysis
    ngram_df = run_ngram_analysis(
        filtered,
        campaign_filter  = "All",   # Already filtered above
        spend_threshold  = thresholds["ngram_spend_threshold"],
        clicks_threshold = thresholds["ngram_clicks_threshold"],
        target_roas      = thresholds["target_roas"],
    )

    # 9. Recommendations
    recs = generate_all_recommendations(
        filtered,
        ngram_df if not ngram_df.empty else pd.DataFrame(),
        spend_threshold  = thresholds["spend_threshold"],
        clicks_threshold = thresholds["clicks_threshold"],
        target_roas      = thresholds["target_roas"],
    )

    # 10. Update summary with recommendation count
    summary["recommendation_count"] = len(recs)

    # 11. Available campaigns and date range for UI filters
    campaigns_list = sorted(df["campaign"].unique().tolist())
    has_dates      = "date" in df.columns and df["date"].notna().any()
    date_min = str(df["date"].min().date()) if has_dates else None
    date_max = str(df["date"].max().date()) if has_dates else None

    # 12. Serialise DataFrames (replace NaN with None for JSON)
    def df_to_records(frame: pd.DataFrame) -> list:
        if frame is None or frame.empty:
            return []
        return json.loads(frame.to_json(orient="records", date_format="iso"))

    return {
        "metadata": {
            "filename":       filename,
            "total_rows":     len(df),
            "filtered_rows":  len(filtered),
            "campaigns":      campaigns_list,
            "has_dates":      has_dates,
            "date_min":       date_min,
            "date_max":       date_max,
            "thresholds":     thresholds,
            "warnings":       warnings,
        },
        "summary":         summary,
        "campaigns":       df_to_records(campaigns_df),
        "ad_groups":       df_to_records(adgroups_df),
        "search_terms":    df_to_records(st_df),
        "categories":      df_to_records(category_df),
        "ngrams":          df_to_records(ngram_df) if not ngram_df.empty else [],
        "recommendations": recs,
    }


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Accept a multipart upload:
      - file      : the Google Ads export CSV/Excel
      - thresholds: form fields for spend_threshold, clicks_threshold, etc.

    Returns full analysis JSON.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Please include a file field."}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "Empty filename."}), 400

    file_bytes = f.read()
    filename   = f.filename
    thresholds = _parse_thresholds(request.form)

    try:
        result = _run_full_analysis(file_bytes, filename, thresholds)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        app.logger.exception("Unexpected error during analysis")
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


@app.route("/api/export/<export_type>", methods=["POST"])
def export_data(export_type: str):
    """
    Re-runs analysis and returns a specific export file.

    export_type options:
      - search_terms
      - negatives_full
      - negatives_broad
      - negatives_phrase
      - negatives_exact
      - ngrams
      - daily_report
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    f = request.files["file"]
    file_bytes = f.read()
    filename   = f.filename
    thresholds = _parse_thresholds(request.form)

    try:
        result = _run_full_analysis(file_bytes, filename, thresholds)
    except (ValueError, Exception) as e:
        return jsonify({"error": str(e)}), 422

    # Reconstruct DataFrames from result for export functions
    st_df     = pd.DataFrame(result["search_terms"])
    ngram_df  = pd.DataFrame(result["ngrams"])
    recs      = result["recommendations"]
    summary   = result["summary"]
    campaign_filter = thresholds.get("campaign_filter", "All")

    if export_type == "search_terms":
        csv_data  = export_search_term_report(st_df)
        fname     = "search_term_analysis.csv"

    elif export_type == "negatives_full":
        csv_data  = export_negative_recommendations(recs)
        fname     = "negative_keywords_full.csv"

    elif export_type == "negatives_broad":
        csv_data  = export_broad_match_negatives(recs)
        fname     = "negatives_broad.csv"

    elif export_type == "negatives_phrase":
        csv_data  = export_phrase_match_negatives(recs)
        fname     = "negatives_phrase.csv"

    elif export_type == "negatives_exact":
        csv_data  = export_exact_match_negatives(recs)
        fname     = "negatives_exact.csv"

    elif export_type == "ngrams":
        csv_data  = export_ngram_report(ngram_df)
        fname     = "ngram_analysis.csv"

    elif export_type == "daily_report":
        # Need original df for section generation — re-parse is simplest here
        df, _  = validate_and_parse(file_bytes, filename)
        df, _  = clean(df)
        df     = categorize_dataframe(df)
        df     = calculate_row_metrics(df)
        csv_data = export_daily_report(
            summary      = summary,
            search_term_df = df,
            ngram_df     = ngram_df,
            recommendations = recs,
            thresholds   = thresholds,
            campaign_filter = campaign_filter,
        )
        fname = "daily_operator_report.csv"

    else:
        return jsonify({"error": f"Unknown export type: {export_type}"}), 400

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
