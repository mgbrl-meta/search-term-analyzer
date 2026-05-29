"""
categories.py — Rule-based keyword categorization engine.

Categories are defined as lists of trigger words/phrases.
A search term is matched against each category in priority order.
The first matching category wins.

To customize:
  - Edit the CATEGORY_RULES dict below.
  - Add brand terms to CATEGORY_RULES["brand"].
  - Add product-specific terms to CATEGORY_RULES["product_specific"].
  - Adjust CATEGORY_PRIORITY to change matching order.
"""

import re
import pandas as pd
from typing import Dict, List, Optional

# ─── Category definitions ────────────────────────────────────────────────────
# Each key = internal category name
# Each value = list of trigger words/phrases (all lowercase)
# A search term matches if ANY of the phrases is found as a word/substring.

CATEGORY_RULES: Dict[str, List[str]] = {
    "irrelevant": [
        "job", "jobs", "salary", "salaries", "career", "careers",
        "vacancy", "vacancies", "hire", "hiring", "recruit",
        "course", "courses", "training", "certification", "learn",
        "pdf", "manual", "brochure", "catalogue", "catalog",
        "used", "second hand", "secondhand", "pre-owned", "refurbished",
        "free download", "download", "torrent",
        "meaning", "definition", "synonym", "translate",
        "wiki", "wikipedia",
    ],
    "competitor": [
        "amazon", "flipkart", "myntra", "meesho", "nykaa",
        "ajio", "snapdeal", "paytm mall",
        "ikea", "walmart", "target", "wayfair", "overstock",
        "ebay", "etsy", "aliexpress", "alibaba", "temu",
        "zara", "h&m", "uniqlo", "forever 21",
        "home depot", "lowes", "costco",
    ],
    "brand": [
        # Add your own brand terms here
        # e.g. "yourbrand", "your brand name"
    ],
    "diy": [
        "diy", "do it yourself", "homemade", "home made",
        "make at home", "how to make", "how to build",
        "how to create", "tutorial", "step by step",
        "craft", "crafts", "handmade", "handcraft",
        "repair", "fix", "restore", "upcycle",
        "instructions", "guide to making",
    ],
    "informational": [
        "how", "what is", "what are", "why", "when",
        "guide", "guides", "tips", "ideas", "inspiration",
        "examples", "examples of", "review", "reviews",
        "comparison", "versus", "vs", "difference between",
        "pros and cons", "benefits of", "history of",
        "types of", "list of",
    ],
    "price_sensitive": [
        "cheap", "cheapest", "budget", "affordable",
        "low price", "low cost", "discount", "discounts",
        "coupon", "coupons", "promo", "promo code",
        "offer", "offers", "deal", "deals", "sale",
        "wholesale", "bulk", "clearance",
        "under 500", "under 1000", "under $", "free",
    ],
    "high_intent": [
        "buy", "purchase", "order", "shop", "shopping",
        "price", "prices", "cost of", "how much",
        "near me", "store", "stores", "supplier", "suppliers",
        "online", "delivery", "ship", "shipping",
        "available", "in stock", "get",
    ],
    "problem_solution": [
        "best for", "good for", "solution", "solve",
        "problem", "issue", "fix", "alternative",
        "instead of", "replacement for", "substitute",
        "help with", "works for", "suitable for",
        "for small", "for large", "for kids", "for men", "for women",
        "for home", "for office", "for outdoor", "for indoor",
    ],
    "lifestyle": [
        "aesthetic", "aesthetics", "luxury", "premium",
        "modern", "minimalist", "minimal", "trendy", "trend",
        "stylish", "elegant", "classic", "vintage",
        "boho", "bohemian", "rustic", "industrial",
        "decor", "decoration", "outfit", "style",
        "cozy", "cosy",
    ],
    "product_specific": [
        # These will be matched after lifestyle but before generic.
        # Add specific product model names, SKUs, or attributes here.
        # e.g. "model x", "pro version", "size xl"
    ],
    "low_intent": [
        "image", "images", "photo", "photos", "picture", "pictures",
        "template", "templates", "mockup", "mockups",
        "wallpaper", "screensaver",
        "meaning of", "define",
        "coloring", "colouring",
    ],
    "generic": [
        # Catch-all broad category words — edit to match your product vertical
    ],
}

# Priority order: first match wins
CATEGORY_PRIORITY: List[str] = [
    "irrelevant",
    "competitor",
    "brand",
    "diy",
    "informational",
    "price_sensitive",
    "high_intent",
    "problem_solution",
    "lifestyle",
    "product_specific",
    "low_intent",
    "generic",
]

# Human-readable display labels
CATEGORY_LABELS: Dict[str, str] = {
    "irrelevant":       "Irrelevant",
    "competitor":       "Competitor",
    "brand":            "Brand",
    "diy":              "DIY",
    "informational":    "Informational",
    "price_sensitive":  "Price-Sensitive",
    "high_intent":      "High-Intent",
    "problem_solution": "Problem/Solution",
    "lifestyle":        "Lifestyle",
    "product_specific": "Product-Specific",
    "low_intent":       "Low-Intent",
    "generic":          "Generic",
    "other":            "Other",
}


def _build_category_patterns(rules: Dict[str, List[str]]) -> Dict[str, re.Pattern]:
    """Pre-compile regex patterns for each category."""
    patterns = {}
    for cat, keywords in rules.items():
        if not keywords:
            continue
        # Match whole-word or phrase within the search term
        escaped = [re.escape(kw) for kw in keywords]
        pattern = r"(?<![a-z])(" + "|".join(escaped) + r")(?![a-z])"
        patterns[cat] = re.compile(pattern, re.IGNORECASE)
    return patterns


_PATTERNS = _build_category_patterns(CATEGORY_RULES)


def categorize_term(search_term: str) -> str:
    """
    Return the primary category for a single search term string.
    Checks categories in CATEGORY_PRIORITY order; returns 'other' if no match.
    """
    term = search_term.lower().strip()
    for cat in CATEGORY_PRIORITY:
        if cat in _PATTERNS and _PATTERNS[cat].search(term):
            return cat
    return "other"


def categorize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add a 'category' column to the DataFrame by classifying each search term.
    """
    df = df.copy()
    df["category"] = df["search_term"].apply(categorize_term)
    return df


def compute_category_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate metrics grouped by category.
    Returns a DataFrame with one row per category.
    """
    from analysis.metrics import aggregate_by, safe_divide

    agg = aggregate_by(df, ["category"])

    # Count unique search terms per category
    term_counts = (
        df.groupby("category")["search_term"]
        .nunique()
        .reset_index(name="term_count")
    )
    agg = agg.merge(term_counts, on="category", how="left")

    # Add human-readable label
    agg["category_label"] = agg["category"].map(
        lambda c: CATEGORY_LABELS.get(c, c.title())
    )

    # Spend percentage (filled after we have total)
    total_spend = agg["cost"].sum()
    agg["spend_pct"] = (agg["cost"] / total_spend * 100).round(2) if total_spend else 0.0

    # Round floats
    float_cols = agg.select_dtypes(include="float").columns
    agg[float_cols] = agg[float_cols].round(4)

    return agg.sort_values("cost", ascending=False).reset_index(drop=True)


def update_brand_terms(brand_terms: List[str]) -> None:
    """
    Dynamically update brand category terms and rebuild patterns.
    Call this if the operator provides their own brand keywords.
    """
    global _PATTERNS
    CATEGORY_RULES["brand"] = [t.lower() for t in brand_terms]
    _PATTERNS = _build_category_patterns(CATEGORY_RULES)
