"""
recommendations.py — Rule-based action recommendations engine for
Google Shopping search term analysis.

Each recommendation has:
  - id          : stable unique string
  - priority    : Critical | High | Medium | Low
  - type        : Add Negative | Scale | Pause | Restructure | Investigate | Listing Fix
  - title       : short human-readable headline
  - description : actionable detail
  - terms       : list of affected search term strings
  - impact      : estimated wasted spend or revenue opportunity (float)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from typing import Callable

import pandas as pd

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Recommendation:
    id: str
    priority: str          # Critical | High | Medium | Low
    type: str              # Add Negative | Scale | Pause | Restructure | Investigate | Listing Fix
    title: str
    description: str
    terms: list[str]
    impact: float = 0.0    # ₹ wasted or ₹ opportunity

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# Rule definitions
# ---------------------------------------------------------------------------
# Each rule is a callable that receives the enriched DataFrame and returns
# a list of Recommendation objects (empty if the condition is not met).

RuleFunc = Callable[[pd.DataFrame], list[Recommendation]]
_RULES: list[RuleFunc] = []


def _rule(fn: RuleFunc) -> RuleFunc:
    _RULES.append(fn)
    return fn


# ---------------------------------------------------------------------------
# Individual rules
# ---------------------------------------------------------------------------

@_rule
def rule_high_spend_no_conversion(df: pd.DataFrame) -> list[Recommendation]:
    """Terms with significant spend and zero conversions → candidate negatives."""
    threshold = max(df["cost"].mean() * 1.5, 100.0)
    mask = (df["cost"] >= threshold) & (df["conversions"] == 0)
    subset = df[mask].sort_values("cost", ascending=False).head(20)
    if subset.empty:
        return []

    terms = subset["search_term"].tolist()
    wasted = float(subset["cost"].sum())

    return [Recommendation(
        id=f"rule_hsnc_{uuid.uuid4().hex[:8]}",
        priority="Critical",
        type="Add Negative",
        title=f"{len(terms)} high-spend, zero-conversion terms found",
        description=(
            f"These {len(terms)} search terms have collectively spent "
            f"₹{wasted:,.0f} with no conversions. "
            "Add them as exact-match negatives to stop budget drain immediately."
        ),
        terms=terms,
        impact=wasted,
    )]


@_rule
def rule_star_terms_scale(df: pd.DataFrame) -> list[Recommendation]:
    """Star-tier terms under budget (low impression share proxy) → scale."""
    if "tier" not in df.columns:
        return []
    subset = df[df["tier"] == "Star"].sort_values("revenue", ascending=False).head(10)
    if subset.empty:
        return []

    terms = subset["search_term"].tolist()
    revenue = float(subset["revenue"].sum())

    return [Recommendation(
        id=f"rule_star_{uuid.uuid4().hex[:8]}",
        priority="High",
        type="Scale",
        title=f"{len(terms)} Star-tier terms ready to scale",
        description=(
            f"These terms are generating ₹{revenue:,.0f} revenue at "
            f"ROAS ≥ 4x. Increase bids or budgets to capture more volume."
        ),
        terms=terms,
        impact=revenue,
    )]


@_rule
def rule_low_ctr_high_impressions(df: pd.DataFrame) -> list[Recommendation]:
    """High impressions but low CTR → listing / title optimisation opportunity."""
    imp_threshold = df["impressions"].quantile(0.70)
    ctr_threshold = df["ctr"].quantile(0.25)

    mask = (df["impressions"] >= imp_threshold) & (df["ctr"] <= ctr_threshold)
    subset = df[mask].sort_values("impressions", ascending=False).head(15)
    if subset.empty:
        return []

    terms = subset["search_term"].tolist()

    return [Recommendation(
        id=f"rule_lctr_{uuid.uuid4().hex[:8]}",
        priority="High",
        type="Listing Fix",
        title=f"{len(terms)} high-impression, low-CTR terms",
        description=(
            "These terms are getting significant impressions but poor click-through rates. "
            "Review product titles, images, and prices for these queries — "
            "your listing may not match searcher intent."
        ),
        terms=terms,
        impact=0.0,
    )]


@_rule
def rule_drain_tier_pause(df: pd.DataFrame) -> list[Recommendation]:
    """Drain-tier terms (spend > 0, zero conversions) → pause or negative."""
    if "tier" not in df.columns:
        return []
    subset = df[df["tier"] == "Drain"].sort_values("cost", ascending=False).head(20)
    if subset.empty:
        return []

    terms = subset["search_term"].tolist()
    wasted = float(subset["cost"].sum())

    return [Recommendation(
        id=f"rule_drain_{uuid.uuid4().hex[:8]}",
        priority="High",
        type="Pause",
        title=f"{len(terms)} drain-tier terms consuming budget",
        description=(
            f"₹{wasted:,.0f} spent across {len(terms)} terms with zero return. "
            "Pause these search terms or add them as campaign-level negatives."
        ),
        terms=terms,
        impact=wasted,
    )]


@_rule
def rule_informational_intent_spend(df: pd.DataFrame) -> list[Recommendation]:
    """Informational-intent terms with significant spend → likely off-target."""
    if "intent" not in df.columns:
        return []
    threshold = max(df["cost"].mean(), 50.0)
    mask = (df["intent"] == "Informational") & (df["cost"] >= threshold) & (df["conversions"] == 0)
    subset = df[mask].sort_values("cost", ascending=False).head(15)
    if subset.empty:
        return []

    terms = subset["search_term"].tolist()
    wasted = float(subset["cost"].sum())

    return [Recommendation(
        id=f"rule_info_{uuid.uuid4().hex[:8]}",
        priority="Medium",
        type="Add Negative",
        title=f"{len(terms)} informational queries eating budget",
        description=(
            f"Terms like '{terms[0]}' look informational rather than purchase-intent. "
            f"They've spent ₹{wasted:,.0f} with no conversions. "
            "Consider excluding these with broad negatives."
        ),
        terms=terms,
        impact=wasted,
    )]


@_rule
def rule_high_cpa_low_roas(df: pd.DataFrame) -> list[Recommendation]:
    """Terms with conversions but CPA or ROAS below account average."""
    has_conv = df[df["conversions"] > 0]
    if has_conv.empty:
        return []

    avg_roas = has_conv["roas"].median()
    avg_cpa = has_conv["cpa"].median()

    mask = (
        (has_conv["conversions"] >= 2)
        & (has_conv["roas"] < avg_roas * 0.5)
        & (has_conv["cpa"] > avg_cpa * 1.5)
    )
    subset = has_conv[mask].sort_values("cost", ascending=False).head(10)
    if subset.empty:
        return []

    terms = subset["search_term"].tolist()

    return [Recommendation(
        id=f"rule_hcpa_{uuid.uuid4().hex[:8]}",
        priority="Medium",
        type="Investigate",
        title=f"{len(terms)} terms converting below account efficiency",
        description=(
            f"These terms have ROAS < {avg_roas * 0.5:.1f}x (account median: {avg_roas:.1f}x). "
            "Review bid strategy, landing page relevance, or product pricing."
        ),
        terms=terms,
        impact=0.0,
    )]


@_rule
def rule_single_click_no_conversion(df: pd.DataFrame) -> list[Recommendation]:
    """Terms with exactly 1-2 clicks and no conversions — statistically untested."""
    mask = (df["clicks"].between(1, 2)) & (df["conversions"] == 0) & (df["cost"] > 0)
    subset = df[mask]
    if len(subset) < 5:
        return []

    terms = subset["search_term"].tolist()

    return [Recommendation(
        id=f"rule_untested_{uuid.uuid4().hex[:8]}",
        priority="Low",
        type="Investigate",
        title=f"{len(terms)} under-tested terms (1-2 clicks)",
        description=(
            "These terms haven't received enough traffic for a statistically valid judgement. "
            "Monitor them for another 2-4 weeks before making negative decisions."
        ),
        terms=terms,
        impact=0.0,
    )]


@_rule
def rule_broad_match_review(df: pd.DataFrame) -> list[Recommendation]:
    """If broad-match terms are generating waste, flag for match-type restructure."""
    if "match_type" not in df.columns:
        return []

    broad = df[df["match_type"].str.lower().str.contains("broad", na=False)]
    waste = broad[(broad["cost"] > 0) & (broad["conversions"] == 0)]
    if waste.empty:
        return []

    wasted = float(waste["cost"].sum())
    terms = waste.sort_values("cost", ascending=False).head(15)["search_term"].tolist()

    return [Recommendation(
        id=f"rule_broad_{uuid.uuid4().hex[:8]}",
        priority="Medium",
        type="Restructure",
        title="Broad-match terms producing zero-conversion traffic",
        description=(
            f"₹{wasted:,.0f} spent on broad-match terms with no conversions. "
            "Consider switching to phrase or exact match for high-spend terms, "
            "or adding the worst performers as campaign-level negatives."
        ),
        terms=terms,
        impact=wasted,
    )]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def generate_recommendations(df: pd.DataFrame) -> list[dict]:
    """
    Run all rules against the enriched DataFrame and return a list of
    recommendation dicts sorted by priority then impact.
    """
    priority_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}

    all_recs: list[Recommendation] = []
    for rule in _RULES:
        try:
            recs = rule(df)
            all_recs.extend(recs)
        except Exception:
            pass  # individual rule failures must not break the pipeline

    all_recs.sort(
        key=lambda r: (priority_order.get(r.priority, 99), -r.impact)
    )

    return [r.to_dict() for r in all_recs]
