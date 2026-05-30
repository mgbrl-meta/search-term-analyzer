from __future__ import annotations

import hashlib
import math
import re
from typing import Any

import numpy as np
import pandas as pd

from .config import DEFAULT_THRESHOLDS, INTENT_PATTERNS


def _cfg(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = DEFAULT_THRESHOLDS.copy()
    if overrides:
        cfg.update({k: v for k, v in overrides.items() if v is not None})
    margin = float(cfg.get("gross_margin", 0.40) or 0.40)
    cfg["break_even_roas"] = 1.0 / margin if margin > 0 else 2.5
    return cfg


def _num(value: Any, default: float = 0.0) -> float:
    try:
        n = float(value)
        if math.isnan(n) or math.isinf(n):
            return default
        return n
    except Exception:
        return default


def _money(v: Any) -> str:
    return f"₹{round(_num(v)):,.0f}"


def _safe_div(n: pd.Series, d: pd.Series) -> pd.Series:
    n = pd.to_numeric(n, errors="coerce").fillna(0.0)
    d = pd.to_numeric(d, errors="coerce").fillna(0.0)
    return pd.Series(np.where(d > 0, n / d, 0.0), index=n.index)


def _id(*parts: Any) -> str:
    raw = "|".join(str(p) for p in parts)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]


def _contains_any(term: str, words: list[str]) -> bool:
    t = str(term).lower()
    return any(w in t for w in words)


def _syntax(term: str, match_type: str) -> str:
    clean = str(term).strip()
    if match_type == "exact":
        return f"[{clean}]"
    if match_type == "phrase":
        return f'"{clean}"'
    return clean


def _prep_df(df: pd.DataFrame, thresholds: dict[str, Any]) -> pd.DataFrame:
    out = df.copy()

    for col in ["search_term", "campaign", "ad_group", "match_type", "intent", "category", "tier"]:
        if col not in out.columns:
            out[col] = ""

    if "campaign" in out.columns:
        out["campaign"] = out["campaign"].replace("", "Unknown campaign").fillna("Unknown campaign").astype(str)
    else:
        out["campaign"] = "Unknown campaign"

    if "ad_group" in out.columns:
        out["ad_group"] = out["ad_group"].replace("", "Unknown ad group").fillna("Unknown ad group").astype(str)
    else:
        out["ad_group"] = "Unknown ad group"

    for col in ["impressions", "clicks", "cost", "conversions", "conv_value", "revenue"]:
        if col not in out.columns:
            out[col] = 0.0
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0.0)

    out["revenue"] = out["conv_value"] if "conv_value" in out.columns else out["revenue"]
    out["conv_value"] = out["revenue"]

    out["search_term"] = out["search_term"].astype(str).str.strip().str.lower()
    out["ctr"] = _safe_div(out["clicks"], out["impressions"])
    out["cvr"] = _safe_div(out["conversions"], out["clicks"])
    out["roas"] = _safe_div(out["revenue"], out["cost"])
    out["cpa"] = _safe_div(out["cost"], out["conversions"])

    target_cpa = thresholds["target_cpa"]
    be = thresholds["break_even_roas"]

    out["is_significant"] = (
        (out["clicks"] >= thresholds["clicks_threshold"])
        | (out["cost"] >= 3.0 * target_cpa)
        | (out["impressions"] >= thresholds["ctr_impressions_threshold"])
    )

    out["estimated_wasted_spend"] = np.where(
        (out["is_significant"]) & (out["cost"] > 0) & (out["roas"] < be),
        (be - out["roas"]).clip(lower=0) * out["cost"],
        0.0,
    )

    out["is_zero_conv_waste"] = (
        (out["conversions"] <= 0)
        & (out["cost"] >= thresholds["zero_conv_investigate_cpa_multiple"] * target_cpa)
    )

    out["is_star"] = (out["is_significant"]) & (out["roas"] >= thresholds["star_roas_multiple"] * be)
    out["is_solid"] = (out["is_significant"]) & (out["roas"] >= be) & (out["roas"] < thresholds["star_roas_multiple"] * be)
    out["is_drain"] = (out["is_significant"]) & (out["roas"] < 0.7 * be)

    out["is_hidden_winner"] = (
        (~out["is_significant"])
        & (out["conversions"] >= thresholds["hidden_winner_min_conversions"])
        & (out["conversions"] <= thresholds["hidden_winner_max_conversions"])
        & (out["roas"] >= thresholds["star_roas_multiple"] * be)
        & (out["cost"] <= thresholds["hidden_winner_max_cpa_multiple"] * target_cpa)
    )

    if out["intent"].eq("").all():
        out["intent"] = np.select(
            [
                out["search_term"].apply(lambda s: _contains_any(s, INTENT_PATTERNS["marketplace"])),
                out["search_term"].apply(lambda s: _contains_any(s, INTENT_PATTERNS["competitor"])),
                out["search_term"].apply(lambda s: _contains_any(s, INTENT_PATTERNS["informational"])),
                out["search_term"].apply(lambda s: _contains_any(s, INTENT_PATTERNS["purchase"])),
                out["search_term"].apply(lambda s: _contains_any(s, INTENT_PATTERNS["treatment"])),
            ],
            ["Navigational", "Competitor", "Informational", "Transactional", "Problem/Treatment"],
            default="Commercial",
        )

    return out


def _overlap_guard(candidate: str, match_type: str, df: pd.DataFrame) -> tuple[bool, list[str]]:
    term = str(candidate).strip().lower()
    winners = df[(df["is_star"]) | (df["is_solid"])]["search_term"].astype(str).str.lower().tolist()

    if not term or not winners:
        return True, []

    if match_type == "exact":
        blocked = [w for w in winners if w == term]
    elif match_type == "phrase":
        blocked = [w for w in winners if term in w]
    else:
        tokens = [t for t in re.split(r"\s+", term) if len(t) >= 3]
        blocked = [w for w in winners if any(t in w for t in tokens)]

    return len(blocked) == 0, blocked[:10]


def _negative_row(term: str, match_type: str, reason: str, wasted: float, df: pd.DataFrame, source: str) -> dict[str, Any]:
    safe, blocked = _overlap_guard(term, match_type, df)
    final_match = match_type if safe else "exact"
    return {
        "term": term,
        "syntax": _syntax(term, final_match),
        "match_type": final_match,
        "reason": reason if safe else f"{reason}. Downgraded to exact due to winner overlap.",
        "wasted_spend": round(float(wasted), 2),
        "overlap_safe": "Y" if safe else "N",
        "blocked_winner_terms": blocked,
        "source": source,
        "confidence": "High" if safe and wasted > 0 else "Medium",
    }


def _build_waste(df: pd.DataFrame, thresholds: dict[str, Any], ngrams: dict[str, Any]) -> tuple[list[dict], list[dict]]:
    be = thresholds["break_even_roas"]
    target_cpa = thresholds["target_cpa"]
    actions: list[dict] = []
    negatives: list[dict] = []

    zero = df[df["is_zero_conv_waste"]].copy()
    if not zero.empty:
        zero["severity"] = np.where(zero["cost"] >= thresholds["zero_conv_kill_cpa_multiple"] * target_cpa, "kill", "investigate")
        for _, row in zero.sort_values("cost", ascending=False).head(100).iterrows():
            severity = str(row["severity"])
            priority = "Critical" if severity == "kill" else "High"
            reason = f"Zero purchases after {_money(row['cost'])} spend."
            actions.append({
                "id": _id("zero", row["search_term"]),
                "group": "Cut Now" if severity == "kill" else "Investigate",
                "type": "zero_conversion_spend",
                "priority": priority,
                "instruction": f"{'Cut' if severity == 'kill' else 'Investigate'} search term [{row['search_term']}]",
                "term": row["search_term"],
                "match_type": "exact",
                "reason": reason,
                "impact": round(float(row["cost"]), 2),
                "confidence": "High" if bool(row["is_significant"]) else "Low",
            })
            negatives.append(_negative_row(row["search_term"], "exact", reason, row["cost"], df, "zero_conversion_spend"))

    low = df[(df["is_significant"]) & (df["cost"] > 0) & (df["conversions"] > 0) & (df["roas"] < be)].copy()
    if not low.empty:
        for _, row in low.sort_values("estimated_wasted_spend", ascending=False).head(100).iterrows():
            reason = f"ROAS {row['roas']:.2f}x below break-even {be:.2f}x; estimated recoverable {_money(row['estimated_wasted_spend'])}."
            actions.append({
                "id": _id("low_roas", row["search_term"]),
                "group": "Investigate",
                "type": "below_break_even_spender",
                "priority": "High",
                "instruction": f"Review or isolate [{row['search_term']}] before cutting",
                "term": row["search_term"],
                "match_type": "exact",
                "reason": reason,
                "impact": round(float(row["estimated_wasted_spend"]), 2),
                "confidence": "Medium",
            })

    for label, patterns, match_type in [
        ("competitor_term_bleed", INTENT_PATTERNS["competitor"], "exact"),
        ("marketplace_leakage", INTENT_PATTERNS["marketplace"], "phrase"),
        ("diy_informational_leakage", INTENT_PATTERNS["informational"], "phrase"),
    ]:
        mask = df["search_term"].apply(lambda s: _contains_any(s, patterns))
        leak = df[mask & (df["conversions"] <= 0) & (df["cost"] >= thresholds["min_spend_for_negative"])]
        for _, row in leak.sort_values("cost", ascending=False).head(80).iterrows():
            reason = f"{label.replace('_', ' ')} with zero purchases and {_money(row['cost'])} spend."
            actions.append({
                "id": _id(label, row["search_term"]),
                "group": "Add Negatives",
                "type": label,
                "priority": "High" if row["cost"] >= target_cpa else "Medium",
                "instruction": f"Add negative {match_type} for {row['search_term']}",
                "term": row["search_term"],
                "match_type": match_type,
                "reason": reason,
                "impact": round(float(row["cost"]), 2),
                "confidence": "High" if bool(row["is_significant"]) else "Medium",
            })
            negatives.append(_negative_row(row["search_term"], match_type, reason, row["cost"], df, label))

    for n_key in ["1", "2", "3"]:
        rows = ngrams.get(n_key, []) if isinstance(ngrams, dict) else []
        for row in rows or []:
            cost = _num(row.get("cost", row.get("spend", 0)))
            conv = _num(row.get("conversions", 0))
            revenue = _num(row.get("revenue", row.get("conv_value", 0)))
            roas = _num(row.get("roas", revenue / cost if cost > 0 else 0))
            term_count = _num(row.get("term_count", 1), 1)
            ngram = str(row.get("ngram", "")).strip().lower()
            if not ngram or cost < thresholds["ngram_threshold"] or conv > 0 or roas >= be:
                continue
            wasted = max(0.0, (be - roas) * cost) * max(1.0, term_count)
            match_type = "broad" if n_key == "1" else "phrase"
            reason = f"{n_key}-gram pattern has {_money(cost)} spend, {conv:.0f} purchases, {roas:.2f}x ROAS."
            actions.append({
                "id": _id("ngram", n_key, ngram),
                "group": "Add Negatives",
                "type": "ngram_waste",
                "priority": "High",
                "instruction": f"Add negative {match_type} for pattern {ngram}",
                "term": ngram,
                "match_type": match_type,
                "reason": reason,
                "impact": round(float(wasted), 2),
                "confidence": "High",
            })
            negatives.append(_negative_row(ngram, match_type, reason, wasted, df, "ngram_waste"))

    long_tail = df[(df["cost"] > 0) & (df["cost"] < thresholds["long_tail_term_cost_threshold"]) & (df["conversions"] <= 0)]
    aggregate_floor = thresholds["long_tail_aggregate_cpa_multiple"] * target_cpa
    if not long_tail.empty:
        group_col = "category" if "category" in long_tail.columns else "intent"
        agg = long_tail.groupby(group_col).agg(
            spend=("cost", "sum"),
            clicks=("clicks", "sum"),
            terms=("search_term", "count"),
        ).reset_index().sort_values("spend", ascending=False)
        agg = agg[agg["spend"] >= aggregate_floor]
        for _, row in agg.iterrows():
            label = str(row[group_col])
            actions.append({
                "id": _id("long_tail", label),
                "group": "Cut Now",
                "type": "long_tail_micro_waste",
                "priority": "High",
                "instruction": f"Clean long-tail waste in {label}",
                "term": label,
                "match_type": "review",
                "reason": f"{int(row['terms'])} small zero-purchase terms aggregate to {_money(row['spend'])}.",
                "impact": round(float(row["spend"]), 2),
                "confidence": "Medium",
            })

    return actions, negatives


def _build_wins(df: pd.DataFrame, thresholds: dict[str, Any], ngrams: dict[str, Any]) -> list[dict]:
    be = thresholds["break_even_roas"]
    wins: list[dict] = []

    for _, row in df[df["is_star"]].sort_values("revenue", ascending=False).head(80).iterrows():
        wins.append({
            "id": _id("star", row["search_term"]),
            "group": "Scale",
            "type": "star_term",
            "priority": "High",
            "instruction": f"Scale or isolate winner [{row['search_term']}]",
            "term": row["search_term"],
            "reason": f"{row['roas']:.2f}x ROAS vs {be:.2f}x break-even with {_money(row['revenue'])} revenue.",
            "impact": round(float(row["revenue"]), 2),
            "confidence": "High",
        })

    for _, row in df[df["is_hidden_winner"]].sort_values("roas", ascending=False).head(60).iterrows():
        wins.append({
            "id": _id("hidden", row["search_term"]),
            "group": "Prove-Out",
            "type": "hidden_winner",
            "priority": "Medium",
            "instruction": f"Do not cut [{row['search_term']}]; give it proof budget",
            "term": row["search_term"],
            "reason": f"Early-positive signal: {row['conversions']:.0f} purchases at {row['roas']:.2f}x ROAS below significance floor.",
            "impact": round(float(row["revenue"]), 2),
            "confidence": "Medium",
        })

    account_ctr = _num(_safe_div(pd.Series([df["clicks"].sum()]), pd.Series([df["impressions"].sum()])).iloc[0])
    pdp = df[(df["ctr"] >= account_ctr) & (df["clicks"] >= thresholds["pdp_click_threshold"]) & (df["conversions"] <= 0)]
    for _, row in pdp.sort_values("clicks", ascending=False).head(80).iterrows():
        wins.append({
            "id": _id("pdp", row["search_term"]),
            "group": "Fix Don't Cut",
            "type": "pdp_landing_page_problem",
            "priority": "High",
            "instruction": f"Fix PDP/offer for [{row['search_term']}], do not negative yet",
            "term": row["search_term"],
            "reason": f"CTR {row['ctr']*100:.2f}% is at/above account CTR, but CVR is ~0 after {row['clicks']:.0f} clicks.",
            "impact": round(float(row["cost"]), 2),
            "confidence": "Medium",
        })

    return wins


def _cannibalization(df: pd.DataFrame) -> list[dict]:
    grouped = df.groupby("search_term").agg(
        campaigns=("campaign", pd.Series.nunique),
        ad_groups=("ad_group", pd.Series.nunique),
        spend=("cost", "sum"),
        revenue=("revenue", "sum"),
        clicks=("clicks", "sum"),
        conversions=("conversions", "sum"),
    ).reset_index()
    can = grouped[((grouped["campaigns"] > 1) | (grouped["ad_groups"] > 1)) & (grouped["spend"] > 0)]
    out = []
    for _, row in can.sort_values("spend", ascending=False).head(80).iterrows():
        out.append({
            "id": _id("cannibalization", row["search_term"]),
            "group": "Investigate",
            "type": "query_cannibalization",
            "priority": "Medium",
            "instruction": f"Consolidate or route query [{row['search_term']}]",
            "term": row["search_term"],
            "reason": f"Same query served by {int(row['campaigns'])} campaigns / {int(row['ad_groups'])} ad groups.",
            "impact": round(float(row["spend"]), 2),
            "confidence": "Medium",
        })
    return out


def _campaign_summary(df: pd.DataFrame) -> list[dict[str, Any]]:
    out = df.groupby("campaign", dropna=False).agg(
        spend=("cost", "sum"),
        revenue=("revenue", "sum"),
        clicks=("clicks", "sum"),
        impressions=("impressions", "sum"),
        conversions=("conversions", "sum"),
        terms=("search_term", "count"),
    ).reset_index()
    out["roas"] = np.where(out["spend"] > 0, out["revenue"] / out["spend"], 0.0)
    out["ctr"] = np.where(out["impressions"] > 0, out["clicks"] / out["impressions"], 0.0)
    return out.sort_values("spend", ascending=False).to_dict("records")


def _markdown(exec_lines: list[str], checklist: list[dict], negatives: list[dict]) -> str:
    lines = ["# Search Term OS — Executive Action Report", ""]
    lines += ["## 1. Executive summary"]
    for item in exec_lines[:8]:
        lines.append(f"- {item}")

    lines += ["", "## 2. Prioritized checklist"]
    for group in ["Cut Now", "Add Negatives", "Fix Don't Cut", "Scale", "Prove-Out", "Investigate"]:
        group_items = [x for x in checklist if x.get("group") == group]
        if not group_items:
            continue
        lines += ["", f"### {group}"]
        for item in group_items[:20]:
            lines.append(
                f"- {item.get('instruction')} — {item.get('reason')} "
                f"Impact/risk: {_money(item.get('impact', 0))}. Confidence: {item.get('confidence', 'Medium')}."
            )

    lines += ["", "## 3. Negative keyword sheet"]
    lines += ["| term/phrase | match type | reason | ₹ wasted | overlap-safe |", "|---|---:|---|---:|---:|"]
    for row in negatives[:80]:
        lines.append(
            f"| {row.get('syntax','')} | {row.get('match_type','')} | {row.get('reason','')} | "
            f"{_money(row.get('wasted_spend',0))} | {row.get('overlap_safe','')} |"
        )

    return "\n".join(lines)


def generate_elite_report(
    df: pd.DataFrame,
    ngrams: dict[str, Any] | None = None,
    existing_recommendations: list[dict] | None = None,
    thresholds: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cfg = _cfg(thresholds)
    ngrams = ngrams or {}
    work = _prep_df(df, cfg)

    waste_actions, negative_sheet = _build_waste(work, cfg, ngrams)
    win_actions = _build_wins(work, cfg, ngrams)
    cannibal = _cannibalization(work)

    checklist = sorted(waste_actions + win_actions + cannibal, key=lambda x: _num(x.get("impact")), reverse=True)

    seen = set()
    deduped_negatives = []
    for row in sorted(negative_sheet, key=lambda x: _num(x.get("wasted_spend")), reverse=True):
        key = row.get("syntax")
        if key in seen:
            continue
        seen.add(key)
        deduped_negatives.append(row)

    total_spend = float(work["cost"].sum())
    total_revenue = float(work["revenue"].sum())
    blended_roas = total_revenue / total_spend if total_spend > 0 else 0.0
    wasted_spend = float(work.loc[(work["is_drain"]) | (work["is_zero_conv_waste"]), "cost"].sum())
    wasted_pct = wasted_spend / total_spend if total_spend > 0 else 0.0

    biggest_leak = max(waste_actions, key=lambda x: _num(x.get("impact")), default=None)
    highest_action = max(checklist, key=lambda x: _num(x.get("impact")), default=None)

    exec_summary = [
        f"{_money(total_spend)} total spend analyzed at {blended_roas:.2f}x blended ROAS.",
        f"{_money(wasted_spend)} waste identified ({wasted_pct*100:.1f}% of spend).",
        f"Biggest single leak: {biggest_leak.get('term') if biggest_leak else 'none'} — {_money(biggest_leak.get('impact', 0) if biggest_leak else 0)}.",
        f"Highest-₹ action: {highest_action.get('instruction') if highest_action else 'none'} — {_money(highest_action.get('impact', 0) if highest_action else 0)}.",
        f"True non-brand ROAS unavailable without brand-keyword mapping; blended ROAS is {blended_roas:.2f}x.",
        f"{len(deduped_negatives)} overlap-checked negative keyword rows ready.",
        f"{len([x for x in win_actions if x.get('group') in ['Scale','Prove-Out']])} scale/prove-out opportunities protected.",
        f"Break-even ROAS used: {cfg['break_even_roas']:.2f}x from gross margin {cfg['gross_margin']*100:.0f}%.",
    ]

    cols = {c.lower() for c in work.columns}
    unavailable = []
    if not any(c in cols for c in ["date", "day", "segments.date"]):
        unavailable.append({"analysis": "rising_spend_no_conversion_velocity", "status": "unavailable", "needs": "date/day column"})
    if not any(c in cols for c in ["margin", "gross_margin", "sku_margin", "product_margin"]):
        unavailable.append({"analysis": "margin_adjusted_reality", "status": "unavailable", "needs": "SKU/product-level margin column"})
    if not any(c in cols for c in ["search_impression_share", "impression_share", "search_lost_is_rank", "search_lost_is_budget"]):
        unavailable.append({"analysis": "true_under_served_impression_share", "status": "unavailable", "needs": "impression share / lost IS columns"})
    if not any(c in cols for c in ["sku", "product_id", "item_id", "product_title", "feed_label"]):
        unavailable.append({"analysis": "catalog_distance_irrelevant_match", "status": "limited", "needs": "catalog/feed/product fields"})

    return {
        "thresholds": cfg,
        "exec_summary": exec_summary,
        "checklist": checklist[:250],
        "markdown": _markdown(exec_summary, checklist, deduped_negatives),
        "negative_keyword_sheet": deduped_negatives[:500],
        "waste_map": {
            "total_wasted_spend": round(wasted_spend, 2),
            "wasted_spend_pct": round(wasted_pct, 4),
            "items": [x for x in checklist if x.get("group") in ["Cut Now", "Add Negatives", "Investigate"]][:200],
        },
        "wins_scale": {
            "items": [x for x in checklist if x.get("group") in ["Scale", "Prove-Out", "Fix Don't Cut"]][:200],
        },
        "campaign_summary": _campaign_summary(work),
        "campaigns": sorted(work["campaign"].dropna().astype(str).unique().tolist()),
        "unavailable_analyses": unavailable,
        "summary_extensions": {
            "break_even_roas": round(cfg["break_even_roas"], 4),
            "wasted_spend": round(wasted_spend, 2),
            "wasted_spend_pct": round(wasted_pct, 4),
            "negative_rows": len(deduped_negatives),
            "action_rows": len(checklist),
        },
    }
