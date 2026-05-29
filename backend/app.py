"""
app.py — Flask backend for the Google Shopping Search Term Analyzer.

Endpoints
---------
POST /api/analyze          Upload a CSV/XLSX and run the full analysis pipeline.
GET  /api/export/csv       Download the last analysis as CSV.
GET  /api/export/xlsx      Download the last analysis as multi-sheet XLSX.
GET  /api/health           Health check.

Architecture note
-----------------
Analysis state is stored in a simple in-memory session dict keyed by a
session_id returned to the client on first upload.  For production use,
replace with Redis or a proper session store.
"""

from __future__ import annotations

import io
import json
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
from analysis.exports import export_csv, export_xlsx

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# In-memory session store: { session_id: { "df": pd.DataFrame, "summary": dict, ... } }
_SESSIONS: dict[str, dict[str, Any]] = {}

# ---------------------------------------------------------------------------
# JSON serialisation helper
# ---------------------------------------------------------------------------

class _SafeEncoder(json.JSONEncoder):
    """Handle numpy types, NaN, Inf that the default encoder rejects."""

    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            f = float(obj)
            if math.isnan(f) or math.isinf(f):
                return None
            return f
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.bool_,)):
            return int(obj)  # use int, not bool, for JSON safety
        if isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        return super().default(obj)


def _safe_jsonify(data: Any) -> Response:
    """Serialise data using _SafeEncoder and return a Flask Response."""
    resp_str = json.dumps(data, cls=_SafeEncoder)
    return app.response_class(
        response=resp_str,
        status=200,
        mimetype="application/json",
    )


def _df_to_records(df: pd.DataFrame, limit: int = 5000) -> list[dict]:
    """Convert a DataFrame to JSON-safe records, capping at `limit` rows."""
    subset = df.head(limit)
    records = []
    for row in subset.to_dict(orient="records"):
        clean_row: dict[str, Any] = {}
        for k, v in row.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean_row[k] = None
            elif isinstance(v, (np.integer,)):
                clean_row[k] = int(v)
            elif isinstance(v, (np.floating,)):
                clean_row[k] = None if math.isnan(float(v)) else float(v)
            elif isinstance(v, (np.bool_,)):
                clean_row[k] = int(v)
            else:
                clean_row[k] = v
        records.append(clean_row)
    return records


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


@app.post("/api/analyze")
def analyze():
    """
    Accept a file upload and optional brand_keywords query param.

    Form data
    ---------
    file : the CSV or XLSX report
    brand_keywords : comma-separated brand terms (optional)
    session_id : existing session to overwrite (optional)
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Send a 'file' field in the form data."}), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Empty filename."}), 400

    file_bytes = uploaded.read()
    filename = uploaded.filename

    brand_keywords_raw: str = request.form.get("brand_keywords", "")
    brand_tokens: set[str] = {
        t.strip().lower()
        for t in brand_keywords_raw.split(",")
        if t.strip()
    }

    # Parse ---------------------------------------------------------------
    try:
        df = parse_upload(file_bytes, filename)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422

    # Enrich ---------------------------------------------------------------
    try:
        df = enrich_dataframe(df)
        df = classify_dataframe(df, brand_tokens=brand_tokens or None)
    except Exception as exc:
        return jsonify({"error": f"Enrichment failed: {exc}"}), 500

    # Aggregates -----------------------------------------------------------
    summary = aggregate_summary(df)
    cat_summary = category_summary(df)
    int_summary = intent_summary(df)
    ngrams_data = all_ngrams(df, top_k=100)
    recs = generate_recommendations(df)

    # Session store --------------------------------------------------------
    session_id: str = request.form.get("session_id") or uuid.uuid4().hex
    _SESSIONS[session_id] = {
        "df": df,
        "summary": summary,
        "recommendations": recs,
        "ngrams": ngrams_data,
        "filename": filename,
        "analyzed_at": datetime.utcnow().isoformat(),
    }

    # Paginated table rows -------------------------------------------------
    page = int(request.form.get("page", 1))
    per_page = int(request.form.get("per_page", 500))
    total_rows = len(df)
    start = (page - 1) * per_page
    page_df = df.iloc[start: start + per_page]
    records = _df_to_records(page_df)

    response_payload = {
        "session_id": session_id,
        "summary": summary,
        "category_summary": cat_summary,
        "intent_summary": int_summary,
        "ngrams": ngrams_data,
        "recommendations": recs,
        "terms": records,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total_rows,
            "pages": math.ceil(total_rows / per_page),
        },
        "analyzed_at": _SESSIONS[session_id]["analyzed_at"],
    }

    return _safe_jsonify(response_payload)


@app.get("/api/terms")
def get_terms():
    """Paginated access to term-level rows for an existing session."""
    session_id = request.args.get("session_id")
    if not session_id or session_id not in _SESSIONS:
        return jsonify({"error": "Invalid or missing session_id."}), 404

    session = _SESSIONS[session_id]
    df: pd.DataFrame = session["df"]

    # Filtering
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

    # Sorting
    sort_col = request.args.get("sort", "impressions")
    sort_asc = request.args.get("order", "desc").lower() == "asc"
    if sort_col in filtered.columns:
        filtered = filtered.sort_values(sort_col, ascending=sort_asc)

    # Pagination
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


@app.get("/api/export/csv")
def export_csv_endpoint():
    session_id = request.args.get("session_id")
    if not session_id or session_id not in _SESSIONS:
        return jsonify({"error": "Invalid session_id."}), 404

    session = _SESSIONS[session_id]
    csv_bytes = export_csv(session["df"])
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


@app.get("/api/ngrams")
def get_ngrams():
    """Return n-gram data for an existing session."""
    session_id = request.args.get("session_id")
    if not session_id or session_id not in _SESSIONS:
        return jsonify({"error": "Invalid session_id."}), 404

    n = request.args.get("n", "2")
    session = _SESSIONS[session_id]
    ngrams = session["ngrams"].get(str(n), [])

    return _safe_jsonify({"ngrams": ngrams, "n": int(n)})


@app.get("/api/recommendations")
def get_recommendations():
    session_id = request.args.get("session_id")
    if not session_id or session_id not in _SESSIONS:
        return jsonify({"error": "Invalid session_id."}), 404

    session = _SESSIONS[session_id]
    return _safe_jsonify({"recommendations": session["recommendations"]})


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found."}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed."}), 405


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error.", "detail": str(e)}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5000)
