"""
categories.py — Keyword-based intent and product category classification
for Google Shopping search terms.

Two classification axes:
  1. Intent     : Transactional | Informational | Navigational | Comparison | Branded
  2. Category   : product-domain bucket (e.g. Hair Care, Skin Care, …)

Both use a simple keyword-matching approach that is fast, transparent,
and easily extended by editing the INTENT_RULES / CATEGORY_RULES dicts.
"""

from __future__ import annotations

import re
from typing import Optional

import pandas as pd

from .cleaner import get_all_tokens, clean_term

# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------

# Order matters — first match wins
INTENT_RULES: list[tuple[str, list[str]]] = [
    ("Branded", [
        # Add your client brand terms here; populated dynamically via classify_dataframe()
    ]),
    ("Comparison", [
        "vs", "versus", "compare", "comparison", "difference", "better", "which",
        "alternative", "alternatives", "or",
    ]),
    ("Informational", [
        "what", "how", "why", "when", "where", "who", "does", "is", "are",
        "benefits", "benefit", "effect", "effects", "use", "uses", "guide",
        "tips", "tip", "tutorial", "meaning", "definition", "explain", "review",
        "reviews", "rating", "ratings",
    ]),
    ("Navigational", [
        "amazon", "flipkart", "myntra", "nykaa", "meesho", "jiomart",
        "official", "website", "site", "login", "app", "download",
    ]),
    ("Transactional", [
        "buy", "shop", "order", "purchase", "get", "price", "prices", "cost",
        "cheap", "cheapest", "affordable", "discount", "offer", "sale", "deal",
        "free", "shipping", "delivery", "combo", "pack", "set", "kit",
        "online", "near me", "nearby",
    ]),
]

_DEFAULT_INTENT = "Informational"


def classify_intent(term: str, brand_tokens: Optional[set[str]] = None) -> str:
    """Return the intent label for a single search term."""
    tokens = set(get_all_tokens(clean_term(term)))

    # Branded check first
    if brand_tokens and tokens & brand_tokens:
        return "Branded"

    for intent, keywords in INTENT_RULES[1:]:  # skip Branded — handled above
        if tokens & set(keywords):
            return intent

    return _DEFAULT_INTENT


# ---------------------------------------------------------------------------
# Product category classification
# ---------------------------------------------------------------------------

CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("Hair Care", [
        "hair", "shampoo", "conditioner", "serum", "oil", "scalp", "dandruff",
        "hairfall", "hair fall", "growth", "regrowth", "frizz", "curl", "curly",
        "smooth", "keratin", "rosemary", "argan", "coconut oil", "onion",
        "biotin", "caffeine", "minoxidil", "alopecia", "dry hair", "oily hair",
        "damaged hair", "hair mask", "hair cream", "hair spray", "leave-in",
        "hair color", "colour", "dye", "bleach", "toner", "highlights",
    ]),
    ("Skin Care", [
        "skin", "face", "moisturiser", "moisturizer", "sunscreen", "spf",
        "serum", "toner", "cleanser", "facewash", "face wash", "scrub",
        "exfoliate", "exfoliator", "retinol", "niacinamide", "vitamin c",
        "hyaluronic", "acne", "pimple", "dark spots", "pigmentation",
        "brightening", "whitening", "anti-aging", "anti ageing", "wrinkle",
        "eye cream", "lip balm", "lip care",
    ]),
    ("Body Care", [
        "body", "lotion", "body wash", "shower gel", "soap", "deodorant",
        "deo", "antiperspirant", "hand cream", "foot cream", "stretch marks",
        "cellulite", "body scrub", "bath",
    ]),
    ("Supplements & Nutrition", [
        "supplement", "vitamin", "mineral", "protein", "collagen", "omega",
        "probiotic", "prebiotic", "capsule", "tablet", "gummy", "powder",
        "nutraceutical", "biotin", "zinc", "iron", "calcium", "magnesium",
        "immunity", "gut health", "weight loss", "fat burner",
    ]),
    ("Makeup & Cosmetics", [
        "makeup", "lipstick", "foundation", "concealer", "blush", "contour",
        "highlighter", "eyeshadow", "mascara", "eyeliner", "kajal", "primer",
        "setting spray", "bronzer", "lip liner",
    ]),
    ("Fragrance & Perfume", [
        "perfume", "fragrance", "deodorant", "deo", "cologne", "body mist",
        "attar", "oud", "eau de", "edp", "edt",
    ]),
    ("Baby & Kids", [
        "baby", "infant", "toddler", "kids", "children", "child", "newborn",
        "diaper", "nappy", "baby oil", "baby shampoo", "baby lotion",
    ]),
    ("Men's Grooming", [
        "men", "man", "mens", "beard", "shave", "shaving", "aftershave",
        "razor", "trimmer", "grooming", "male",
    ]),
    ("Wellness & Ayurveda", [
        "ayurvedic", "ayurveda", "herbal", "natural", "organic", "homeopathic",
        "essential oil", "aromatherapy", "yoga", "meditation", "stress",
        "sleep", "immunity", "detox",
    ]),
]

_DEFAULT_CATEGORY = "General"


def classify_category(term: str) -> str:
    """Return the product category for a single search term."""
    cleaned = clean_term(term)

    # Scan the full original string for multi-word keywords first
    for category, keywords in CATEGORY_RULES:
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", cleaned):
                return category

    return _DEFAULT_CATEGORY


# ---------------------------------------------------------------------------
# DataFrame-level classification
# ---------------------------------------------------------------------------

def classify_dataframe(
    df: pd.DataFrame,
    brand_tokens: Optional[set[str]] = None,
) -> pd.DataFrame:
    """
    Add 'intent' and 'category' columns to the DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain a 'search_term' column.
    brand_tokens : set[str] | None
        Lowercase brand keyword tokens for branded-intent detection.
    """
    df = df.copy()
    df["intent"] = df["search_term"].apply(
        lambda t: classify_intent(t, brand_tokens=brand_tokens)
    )
    df["category"] = df["search_term"].apply(classify_category)
    return df


def category_summary(df: pd.DataFrame) -> list[dict]:
    """Aggregate metrics grouped by product category."""
    if "category" not in df.columns:
        return []

    grp = (
        df.groupby("category")
        .agg(
            terms=("search_term", "count"),
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
            cost=("cost", "sum"),
            conversions=("conversions", "sum"),
            revenue=("conv_value", "sum"),
        )
        .reset_index()
    )

    grp["roas"] = (grp["revenue"] / grp["cost"].replace(0, float("nan"))).fillna(0.0).round(2)
    grp["ctr"] = (grp["clicks"] / grp["impressions"].replace(0, float("nan")) * 100).fillna(0.0).round(2)

    return grp.sort_values("revenue", ascending=False).to_dict(orient="records")


def intent_summary(df: pd.DataFrame) -> list[dict]:
    """Aggregate metrics grouped by intent."""
    if "intent" not in df.columns:
        return []

    grp = (
        df.groupby("intent")
        .agg(
            terms=("search_term", "count"),
            impressions=("impressions", "sum"),
            clicks=("clicks", "sum"),
            cost=("cost", "sum"),
            conversions=("conversions", "sum"),
            revenue=("conv_value", "sum"),
        )
        .reset_index()
    )

    grp["roas"] = (grp["revenue"] / grp["cost"].replace(0, float("nan"))).fillna(0.0).round(2)

    return grp.sort_values("terms", ascending=False).to_dict(orient="records")
