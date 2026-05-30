"""
Central threshold config for Search Term OS.

All kill / scale / diagnostic rules should use this config instead of hardcoded
values. break_even_roas is derived as 1 / gross_margin.
"""

DEFAULT_THRESHOLDS = {
    # Profitability
    "gross_margin": 0.40,                 # 40% gross margin => 2.5x break-even ROAS
    "target_cpa": 1800.0,                 # INR target CPA
    "clicks_threshold": 100,              # significance floor for kill/scale decisions
    "ctr_impressions_threshold": 1000,    # CTR judgment floor
    "min_spend_for_negative": 100.0,

    # Waste rules
    "zero_conv_investigate_cpa_multiple": 3.0,
    "zero_conv_kill_cpa_multiple": 5.0,
    "informational_spend_pct_threshold": 0.15,
    "ngram_threshold": 3000.0,
    "long_tail_term_cost_threshold": 500.0,
    "long_tail_aggregate_cpa_multiple": 3.0,

    # Win rules
    "star_roas_multiple": 1.5,
    "hidden_winner_min_conversions": 1.0,
    "hidden_winner_max_conversions": 2.0,
    "hidden_winner_max_cpa_multiple": 1.5,

    # PDP diagnostic
    "pdp_click_threshold": 50,
    "near_zero_cvr": 0.005,
}

INTENT_PATTERNS = {
    "marketplace": [
        "amazon", "flipkart", "nykaa", "myntra", "meesho", "snapdeal",
        "ajio", "blinkit", "zepto", "bigbasket", "firstcry", "jiomart"
    ],
    "competitor": [
        "traya", "olaplex", "anomaly", "ybera", "loreal", "l'oreal",
        "mamaearth", "minimalist", "wishcare", "bare anatomy", "plum",
        "biotique", "wow", "mcaffeine", "ordinary", "derma co",
        "the derma co", "foxtale", "aqualogica", "dot and key", "pilgrim",
        "himalaya", "sebamed", "cetaphil", "cerave", "bioderma",
        "neutrogena", "nivea", "ponds", "garnier"
    ],
    "informational": [
        "how to", "home remedy", "remedy", "naturally", "at home", "why",
        "what causes", "benefits", "side effects", "meaning", "tips",
        "routine", "before and after", "diy"
    ],
    "purchase": [
        "buy", "price", "online", "near me", "best", "top", "review",
        "reviews", "combo", "kit", "pack", "offer", "discount", "where to buy"
    ],
    "treatment": [
        "treatment", "solution", "control", "repair", "therapy", "reduce",
        "remove", "prevention", "prevent", "fix", "anti", "problem",
        "concern", "care"
    ],
}
