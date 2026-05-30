"""
app.py — Flask backend for the Google Shopping Search Term Analyzer.
"""

from __future__ import annotations

import io
import math
import uuid
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS

from analysis.parser import parse_upload
from analysis.cleaner import clean_term
from analysis.metrics import enrich_dataframe, aggregate_summary
from analysis.categories import classify_dataframe, category_summary, intent_summary
from analysis.ngrams import all_ngrams
from analysis.recommendations import generate_recommendations
from analysis.reporting import generate_elite_report
from analysis.exports import export_csv, export_xlsx

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

_SESSIONS: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# JSON sanitisation — recursively coerce ANY value to a JSON-safe native type
# ---------------------------------------------------------------------------

def sanitize(obj: Any) -> Any:
    """Recursively convert numpy / pandas / NaN values to JSON-safe natives."""
    # numpy scalars
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        f = float(obj)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(obj, np.ndarray):
        return [sanitize(v) for v in obj.tolist()]
    # native float NaN/Inf
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    # python bool is fine (must check before int since bool is subclass of int)
    if isinstance(obj, bool):
        return obj
    # pandas timestamps
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    if obj is pd.NaT:
        return None
    # containers
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [sanitize(v) for v in obj]
    # pandas NA
    try:
        if obj is pd.NA or (np.isscalar(obj) and pd.isna(obj)):
            return None
    except (TypeError, ValueError):
        pass
    return obj


def _safe_jsonify(data: Any) -> Response:
    return jsonify(sanitize(data))


def _df_to_records(df: pd.DataFrame, limit: int = 5000) -> list[dict]:
    subset = df.head(limit)
    return [sanitize(row) for row in subset.to_dict(orient="records")]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


@app.post("/api/analyze")
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Send a 'file' field in the form data."}), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Empty filename."}), 400

    file_bytes = uploaded.read()
    filename = uploaded.filename

    brand_keywords_raw: str = request.form.get("brand_keywords", "")
    brand_tokens: set[str] = {
        t.strip().lower() for t in brand_keywords_raw.split(",") if t.strip()
    }

    # Parse
    try:
        df = parse_upload(file_bytes, filename)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422
    except Exception as exc:
        return jsonify({"error": f"parse_upload failed: {exc}"}), 500

    # Enrich
    try:
        df = enrich_dataframe(df)
        df = classify_dataframe(df, brand_tokens=brand_tokens or None)
    except Exception as exc:
        return jsonify({"error": f"Enrichment failed: {exc}"}), 500

    # Aggregates — each wrapped so the failing step is named
    try:
        summary = aggregate_summary(df)
    except Exception as exc:
        return jsonify({"error": f"aggregate_summary failed: {exc}"}), 500
    try:
        cat_summary = category_summary(df)
        int_summary = intent_summary(df)
    except Exception as exc:
        return jsonify({"error": f"category/intent summary failed: {exc}"}), 500
    try:
        ngrams_data = all_ngrams(df, top_k=100)
    except Exception as exc:
        return jsonify({"error": f"all_ngrams failed: {exc}"}), 500
    try:
        recs = generate_recommendations(df)
    except Exception as exc:
        return jsonify({"error": f"generate_recommendations failed: {exc}"}), 500

    try:
        elite_report = generate_elite_report(df, ngrams_data, recs)
    except Exception as exc:
        elite_report = {
            "error": f"generate_elite_report failed: {exc}",
            "exec_summary": [],
            "checklist": [],
            "markdown": "",
            "negative_keyword_sheet": [],
            "waste_map": {"items": []},
            "wins_scale": {"items": []},
            "campaign_summary": [],
            "campaigns": [],
            "unavailable_analyses": [],
            "summary_extensions": {},
        }

    # Session store
    session_id: str = request.form.get("session_id") or uuid.uuid4().hex
    _SESSIONS[session_id] = {
        "df": df,
        "summary": summary,
        "recommendations": recs,
        "elite_report": elite_report,
        "ngrams": ngrams_data,
        "filename": filename,
        "analyzed_at": datetime.utcnow().isoformat(),
    }

    # Paginated rows
    page = int(request.form.get("page", 1))
    per_page = int(request.form.get("per_page", 500))
    total_rows = len(df)
    start = (page - 1) * per_page
    page_df = df.iloc[start: start + per_page]
    records = _df_to_records(page_df)

    if isinstance(elite_report, dict) and isinstance(elite_report.get("summary_extensions"), dict):
        summary = {**summary, **elite_report.get("summary_extensions", {})}

    response_payload = {
        "session_id": session_id,
        "summary": summary,
        "category_summary": cat_summary,
        "intent_summary": int_summary,
        "ngrams": ngrams_data,
        "recommendations": recs,
        "action_report": {
            "exec_summary": elite_report.get("exec_summary", []) if isinstance(elite_report, dict) else [],
            "checklist": elite_report.get("checklist", []) if isinstance(elite_report, dict) else [],
            "markdown": elite_report.get("markdown", "") if isinstance(elite_report, dict) else "",
        },
        "negative_keyword_sheet": elite_report.get("negative_keyword_sheet", []) if isinstance(elite_report, dict) else [],
        "waste_map": elite_report.get("waste_map", {"items": []}) if isinstance(elite_report, dict) else {"items": []},
        "wins_scale": elite_report.get("wins_scale", {"items": []}) if isinstance(elite_report, dict) else {"items": []},
        "campaign_summary": elite_report.get("campaign_summary", []) if isinstance(elite_report, dict) else [],
        "campaigns": elite_report.get("campaigns", []) if isinstance(elite_report, dict) else [],
        "unavailable_analyses": elite_report.get("unavailable_analyses", []) if isinstance(elite_report, dict) else [],
        "terms": records,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total_rows,
            "pages": math.ceil(total_rows / per_page) if total_rows else 1,
        },
        "analyzed_at": _SESSIONS[session_id]["analyzed_at"],
    }

    try:
        return _safe_jsonify(response_payload)
    except Exception as exc:
        return jsonify({"error": f"Analysis failed: {exc}"}), 500


@app.get("/api/terms")
def get_terms():
    session_id = request.args.get("session_id")
    if not session_id or session_id not in _SESSIONS:
        return jsonify({"error": "Invalid or missing session_id."}), 404

    df: pd.DataFrame = _SESSIONS[session_id]["df"]

    tier_filter = request.args.get("tier")
    intent_filter = request.args.get("intent")
    category_filter = request.args.get("category")
    search_q = request.args.get("q", "").strip().lower()

    filtered = df.copy()
    if tier_filter:
        filtered = filtered[filtered["tier"] == tier_filter]
    if intent_filter:
        filtered = filtered[filtered["intent"] == intent_filter]
    if category_filter:
        filtered = filtered[filtered["category"] == category_filter]
    if search_q:
        filtered = filtered[filtered["search_term"].str.contains(search_q, na=False)]

    sort_col = request.args.get("sort", "impressions")
    sort_asc = request.args.get("order", "desc").lower() == "asc"
    if sort_col in filtered.columns:
        filtered = filtered.sort_values(sort_col, ascending=sort_asc)

    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 200))
    total = len(filtered)
    start = (page - 1) * per_page
    page_df = filtered.iloc[start: start + per_page]

    return _safe_jsonify({
        "terms": _df_to_records(page_df),
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": math.ceil(total / per_page) if total else 1,
        },
    })


@app.get("/api/ngrams")
def get_ngrams():
    session_id = request.args.get("session_id")
    if not session_id or session_id not in _SESSIONS:
        return jsonify({"error": "Invalid session_id."}), 404

    n = request.args.get("n", "2")
    ngrams = _SESSIONS[session_id]["ngrams"].get(str(n), [])
    return _safe_jsonify({"ngrams": ngrams, "n": int(n)})


@app.get("/api/recommendations")
def get_recommendations():
    session_id = request.args.get("session_id")
    if not session_id or session_id not in _SESSIONS:
        return jsonify({"error": "Invalid session_id."}), 404

    return _safe_jsonify({"recommendations": _SESSIONS[session_id]["recommendations"]})


@app.get("/api/export/csv")
def export_csv_endpoint():
    session_id = request.args.get("session_id")
    if not session_id or session_id not in _SESSIONS:
        return jsonify({"error": "Invalid session_id."}), 404

    csv_bytes = export_csv(_SESSIONS[session_id]["df"])
    filename = f"search_term_analysis_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return send_file(
        io.BytesIO(csv_bytes),
        mimetype="text/csv",
        as_attachment=True,
        download_name=filename,
    )


@app.get("/api/export/xlsx")
def export_xlsx_endpoint():
    session_id = request.args.get("session_id")
    if not session_id or session_id not in _SESSIONS:
        return jsonify({"error": "Invalid session_id."}), 404

    session = _SESSIONS[session_id]
    xlsx_bytes = export_xlsx(
        df=session["df"],
        summary=session["summary"],
        recommendations=session["recommendations"],
        ngrams_data=session["ngrams"],
    )
    filename = f"search_term_analysis_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return send_file(
        io.BytesIO(xlsx_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found."}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed."}), 405


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error.", "detail": str(e)}), 500


import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)