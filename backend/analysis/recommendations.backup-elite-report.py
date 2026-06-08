"""
recommendations.py — Recommendations engine for Google Shopping search terms.

Every recommendation includes:
type, priority, title, description, affected terms, and estimated impact.
Rules are significance-gated so the tool does not recommend killing/scaling
under-tested search terms.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

import pandas as pd

from .config import DEFAULT_THRESHOLDS
from .ngrams import all_ngrams


@dataclass
class Recommendation:
    id: str
    priority: str
    type: str
    title: str
    description: str
    terms: list[str]
    impact: float = 0.0

    # Extended fields; existing frontend can ignore these safely.
    affected_terms: list[str] = field(default_factory=list)
    reason: str = ""
    severity: str = ""
    recommended_action: str = ""
    match_type: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        data = asdict(self)
        if not data["affected_terms"]:
            data["affected_terms"] = data["terms"]
        data["impact"] = round(float(data.get("impact", 0.0) or 0.0), 2)
        return data


def _thresholds(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = DEFAULT_THRESHOLDS.copy()
    if overrides:
        cfg.update({k: v for k, v in overrides.items() if v is not None})
    gross_margin = float(cfg.get("gross_margin", 0.40) or 0.40)
    cfg["break_even_roas"] = 1.0 / gross_margin if gross_margin > 0 else 2.5
    return cfg


def _rec_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _top_terms(df: pd.DataFrame, n: int, sort_col: str = "cost") -> list[str]:
    if df.empty or "search_term" not in df.columns:
        return []
    return df.sort_values(sort_col, ascending=False).head(n)["search_term"].astype(str).tolist()


def _star_solid_terms(df: pd.DataFrame) -> list[str]:
    if "tier" not in df.columns:
        return []
    return df[df["tier"].isin(["Star", "Solid"])]["search_term"].astype(str).str.lower().tolist()


def _would_block_good_terms(phrase: str, good_terms: list[str]) -> bool:
    phrase = str(phrase).lower().strip()
    if not phrase:
        return False
    pattern = r"\b" + re.escape(phrase) + r"\b"
    return any(re.search(pattern, term) for term in good_terms)


def _priority_from_impact(impact: float, target_cpa: float) -> str:
    if impact >= 5 * target_cpa:
        return "Critical"
    if impact >= 3 * target_cpa:
        return "High"
    if impact >= target_cpa:
        return "Medium"
    return "Low"


def _negative_exact_recommendations(df: pd.DataFrame, cfg: dict[str, Any]) -> list[Recommendation]:
    """Flag zero-conversion spend terms using 3x/5x target CPA severity."""
    max_terms = int(cfg["max_terms_per_recommendation"])
    target_cpa = float(cfg["target_cpa"])

    if "is_zero_converter" not in df.columns:
        return []

    subset = df[df["is_zero_converter"]].copy()
    if subset.empty:
        return []

    subset["severity_rank"] = subset["zero_conversion_severity"].map({"kill": 0, "investigate": 1}).fillna(9)
    subset = subset.sort_values(["severity_rank", "cost"], ascending=[True, False]).head(max_terms)

    terms = subset["search_term"].astype(str).tolist()
    wasted = float(subset["cost"].sum())
    kill_count = int((subset["zero_conversion_severity"] == "kill").sum())

    priority = "Critical" if kill_count > 0 else "High"
    severity = "kill" if kill_count > 0 else "investigate"

    return [Recommendation(
        id=_rec_id("zero_conv"),
        priority=priority,
        type="negative_exact",
        title=f"{len(terms)} significant zero-conversion search terms",
        description=(
            f"These terms spent ₹{wasted:,.0f} with zero conversions. "
            f"Rule: cost ≥ 3× target CPA; ≥5× target CPA is kill severity. "
            "Add exact-match negatives for the bad terms first."
        ),
        terms=terms,
        affected_terms=terms,
        impact=wasted,
        reason="cost >= 3x target CPA and conversions == 0",
        severity=severity,
        recommended_action="Add negative exact for each listed search term",
        match_type="EXACT",
    )]


def _low_roas_recommendations(df: pd.DataFrame, cfg: dict[str, Any]) -> list[Recommendation]:
    """Flag significant terms below break-even ROAS ranked by absolute wasted spend."""
    max_terms = int(cfg["max_terms_per_recommendation"])
    be = float(cfg["break_even_roas"])
    target_cpa = float(cfg["target_cpa"])

    subset = df[
        (df["is_significant"])
        & (df["roas"] < be)
        & (~df.get("is_pdp_problem", False))
    ].copy()

    if subset.empty:
        return []

    subset["absolute_wasted_spend"] = ((be - subset["roas"]).clip(lower=0) * subset["cost"]).fillna(0.0)
    subset = subset.sort_values("absolute_wasted_spend", ascending=False).head(max_terms)

    terms = subset["search_term"].astype(str).tolist()
    impact = float(subset["absolute_wasted_spend"].sum())

    return [Recommendation(
        id=_rec_id("low_roas"),
        priority=_priority_from_impact(impact, target_cpa),
        type="high_spend_low_roas",
        title=f"{len(terms)} significant terms below break-even ROAS",
        description=(
            f"Break-even ROAS is {be:.2f}x. These significant terms are below that floor. "
            f"Estimated wasted spend exposure is ₹{impact:,.0f}, ranked by "
            "(break-even ROAS - actual ROAS) × cost."
        ),
        terms=terms,
        affected_terms=terms,
        impact=impact,
        reason="significant term with ROAS below break-even",
        severity="investigate",
        recommended_action="Lower bid, isolate, improve PDP, or add exact negative if relevance is poor",
        match_type="EXACT",
    )]


def _pdp_recommendations(df: pd.DataFrame, cfg: dict[str, Any]) -> list[Recommendation]:
    """Identify good-click / zero-CVR terms as landing page problems, not negatives."""
    max_terms = int(cfg["max_terms_per_recommendation"])
    if "is_pdp_problem" not in df.columns:
        return []

    subset = df[df["is_pdp_problem"]].sort_values("cost", ascending=False).head(max_terms)
    if subset.empty:
        return []

    terms = subset["search_term"].astype(str).tolist()
    spend = float(subset["cost"].sum())
    avg_ctr = float(df["ctr"].mean() or 0.0)

    return [Recommendation(
        id=_rec_id("pdp"),
        priority="High",
        type="investigate_pdp",
        title=f"{len(terms)} high-CTR terms failing after click",
        description=(
            f"These terms have CTR at or above account average ({avg_ctr:.2f}%) "
            "and enough clicks, but near-zero CVR. Do not negative them first. "
            "Investigate PDP relevance, price, offer, reviews, page speed, and variant availability."
        ),
        terms=terms,
        affected_terms=terms,
        impact=spend,
        reason="CTR >= account average, clicks >= threshold, CVR approximately zero",
        severity="investigate",
        recommended_action="Investigate PDP / offer / pricing instead of adding negatives",
        match_type="NONE",
    )]


def _informational_intent_recommendation(df: pd.DataFrame, cfg: dict[str, Any]) -> list[Recommendation]:
    """Flag informational intent when it consumes too much spend below break-even."""
    if "intent" not in df.columns:
        return []

    total_spend = float(df["cost"].sum())
    if total_spend <= 0:
        return []

    be = float(cfg["break_even_roas"])
    pct_threshold = float(cfg["informational_spend_pct_threshold"])
    max_terms = int(cfg["max_terms_per_recommendation"])

    info = df[df["intent"].eq("Informational")].copy()
    if info.empty:
        return []

    info_spend = float(info["cost"].sum())
    info_revenue = float(info["conv_value"].sum())
    info_roas = info_revenue / info_spend if info_spend > 0 else 0.0
    info_spend_pct = info_spend / total_spend

    if not (info_spend_pct > pct_threshold and info_roas < be):
        return []

    terms = _top_terms(info, max_terms, "cost")

    return [Recommendation(
        id=_rec_id("intent_info"),
        priority="High",
        type="intent_waste",
        title="Informational intent is consuming inefficient spend",
        description=(
            f"Informational queries consume {info_spend_pct * 100:.1f}% of spend "
            f"at {info_roas:.2f}x ROAS, below {be:.2f}x break-even. "
            "Review query themes and add exact/phrase negatives only where they do not block profitable terms."
        ),
        terms=terms,
        affected_terms=terms,
        impact=info_spend,
        reason="informational spend share above threshold and below break-even ROAS",
        severity="investigate",
        recommended_action="Review informational themes; add exact/phrase negatives where safe",
        match_type="EXACT/PHRASE",
        metadata={
            "informational_spend_pct": round(info_spend_pct, 4),
            "informational_roas": round(info_roas, 2),
        },
    )]


def _ngram_waste_recommendations(df: pd.DataFrame, cfg: dict[str, Any]) -> list[Recommendation]:
    """Find repeated wasteful 1/2/3-grams and recommend phrase/broad negatives with overlap guard."""
    ngrams = all_ngrams(df, top_k=100, thresholds=cfg)
    good_terms = _star_solid_terms(df)
    recs: list[Recommendation] = []

    for n_key in ["1", "2", "3"]:
        rows = [r for r in ngrams.get(n_key, []) if int(r.get("is_waste", 0)) == 1]
        rows = sorted(rows, key=lambda r: float(r.get("waste_score", 0.0)), reverse=True)[:10]
        if not rows:
            continue

        safe_rows = []
        suppressed = []
        for row in rows:
            gram = str(row.get("ngram", "")).strip().lower()
            if _would_block_good_terms(gram, good_terms):
                suppressed.append(gram)
                continue
            safe_rows.append(row)

        if not safe_rows:
            continue

        grams = [str(r["ngram"]) for r in safe_rows]
        impact = float(sum(float(r.get("aggregate_wasted_spend", 0.0) or 0.0) for r in safe_rows))
        match_type = "BROAD" if n_key == "1" else "PHRASE"

        recs.append(Recommendation(
            id=_rec_id(f"ngram_{n_key}"),
            priority=_priority_from_impact(impact, float(cfg["target_cpa"])),
            type="ngram_waste",
            title=f"{len(grams)} wasteful {n_key}-gram themes found",
            description=(
                f"These repeated phrases are below {cfg['break_even_roas']:.2f}x break-even "
                f"and represent about ₹{impact:,.0f} in wasted-spend exposure. "
                "Overlap guard suppressed any phrase that appears inside Star/Solid terms."
            ),
            terms=grams,
            affected_terms=grams,
            impact=impact,
            reason="n-gram cost above threshold and aggregate ROAS below break-even",
            severity="kill" if impact >= 5 * float(cfg["target_cpa"]) else "investigate",
            recommended_action=f"Add negative {match_type.lower()} only after reviewing affected search terms",
            match_type=match_type,
            metadata={
                "n": int(n_key),
                "suppressed_due_to_overlap": suppressed,
            },
        ))

    return recs


def _scale_recommendation(df: pd.DataFrame, cfg: dict[str, Any]) -> list[Recommendation]:
    """Surface significant Star terms for scaling, not just negatives."""
    max_terms = min(10, int(cfg["max_terms_per_recommendation"]))
    if "tier" not in df.columns:
        return []

    subset = df[df["tier"].eq("Star")].sort_values("conv_value", ascending=False).head(max_terms)
    if subset.empty:
        return []

    terms = subset["search_term"].astype(str).tolist()
    revenue = float(subset["conv_value"].sum())

    return [Recommendation(
        id=_rec_id("scale_star"),
        priority="High",
        type="scale",
        title=f"{len(terms)} significant Star terms ready to scale",
        description=(
            f"These significant terms are above 1.5× break-even ROAS and generated "
            f"₹{revenue:,.0f} revenue. Consider bid increases, campaign isolation, or feed/PDP expansion."
        ),
        terms=terms,
        affected_terms=terms,
        impact=revenue,
        reason="significant term with ROAS >= 1.5x break-even",
        severity="scale",
        recommended_action="Increase bids/budget carefully or isolate into a controlled scale structure",
        match_type="NONE",
    )]


def generate_recommendations(
    df: pd.DataFrame,
    thresholds: dict[str, Any] | None = None,
) -> list[dict]:
    """Generate prioritized recommendations while preserving frontend-safe keys."""
    cfg = _thresholds(thresholds)

    recs: list[Recommendation] = []
    for fn in [
        _negative_exact_recommendations,
        _ngram_waste_recommendations,
        _pdp_recommendations,
        _low_roas_recommendations,
        _informational_intent_recommendation,
        _scale_recommendation,
    ]:
        try:
            recs.extend(fn(df, cfg))
        except Exception:
            continue

    priority_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    recs.sort(key=lambda r: (priority_order.get(r.priority, 99), -float(r.impact or 0.0)))

    return [r.to_dict() for r in recs]
