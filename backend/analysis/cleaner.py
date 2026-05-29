"""
cleaner.py — Text cleaning and normalisation utilities for search terms.

Handles:
  - Unicode normalisation
  - Punctuation and noise removal
  - Stop-word filtering (with a Google Shopping-aware custom list)
  - Stemming / lemmatisation (optional, disabled by default for readability)
  - Token generation
"""

import re
import string
import unicodedata
from functools import lru_cache
from typing import Optional

import nltk

# ---------------------------------------------------------------------------
# NLTK resource bootstrap (downloaded once per environment)
# ---------------------------------------------------------------------------
_NLTK_RESOURCES = ["stopwords", "punkt", "wordnet"]

def _ensure_nltk_resources() -> None:
    for resource in _NLTK_RESOURCES:
        try:
            nltk.data.find(f"corpora/{resource}" if resource != "punkt" else f"tokenizers/{resource}")
        except LookupError:
            nltk.download(resource, quiet=True)


_ensure_nltk_resources()

from nltk.corpus import stopwords  # noqa: E402  (after download)

# ---------------------------------------------------------------------------
# Stop-word list
# ---------------------------------------------------------------------------
_BASE_STOPWORDS: set[str] = set(stopwords.words("english"))

# Shopping-specific terms that add no analytical value
_SHOPPING_NOISE: set[str] = {
    "buy", "shop", "purchase", "order", "get", "find", "best", "cheap",
    "cheapest", "affordable", "good", "great", "top", "new", "old", "used",
    "deal", "deals", "offer", "offers", "discount", "sale", "free",
    "shipping", "delivery", "online", "store", "brand", "product", "item",
    "india", "indian", "amazon", "flipkart", "myntra", "nykaa",
    "price", "prices", "cost", "rate", "rates", "review", "reviews",
    "rating", "ratings", "vs", "versus", "compare", "comparison",
    "near", "me", "nearby",
}

ALL_STOPWORDS: set[str] = _BASE_STOPWORDS | _SHOPPING_NOISE


# ---------------------------------------------------------------------------
# Core cleaning functions
# ---------------------------------------------------------------------------

def _unicode_normalise(text: str) -> str:
    """NFKD normalise and strip non-ASCII characters."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def _remove_punctuation(text: str) -> str:
    """Remove punctuation except hyphens between word characters."""
    # Keep intra-word hyphens (e.g. "anti-dandruff") but strip everything else
    text = re.sub(r"[^\w\s-]", " ", text)
    text = re.sub(r"(?<!\w)-|-(?!\w)", " ", text)  # strip isolated hyphens
    return text


def _collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def clean_term(term: str) -> str:
    """
    Full cleaning pipeline for a single search term string.
    Returns a normalised, lowercase, clean string.
    """
    if not isinstance(term, str):
        term = str(term)
    term = term.lower()
    term = _unicode_normalise(term)
    term = _remove_punctuation(term)
    term = _collapse_whitespace(term)
    return term


@lru_cache(maxsize=8192)
def tokenise(term: str, remove_stopwords: bool = False) -> tuple[str, ...]:
    """
    Tokenise a (already cleaned) search term into a tuple of tokens.
    Caching is safe because inputs are strings and booleans.
    """
    tokens = term.split()
    if remove_stopwords:
        tokens = [t for t in tokens if t not in ALL_STOPWORDS]
    return tuple(tokens)


def get_meaningful_tokens(term: str) -> list[str]:
    """Return tokens with stop-words removed."""
    cleaned = clean_term(term)
    return list(tokenise(cleaned, remove_stopwords=True))


def get_all_tokens(term: str) -> list[str]:
    """Return all tokens (stop-words retained)."""
    cleaned = clean_term(term)
    return list(tokenise(cleaned, remove_stopwords=False))


def token_count(term: str) -> int:
    """Number of tokens in a search term."""
    return len(get_all_tokens(term))


def is_branded(term: str, brand_keywords: Optional[set[str]] = None) -> bool:
    """
    Heuristic check: does this term contain a known brand keyword?
    brand_keywords should be lowercase strings.
    """
    if not brand_keywords:
        return False
    tokens = set(get_all_tokens(term))
    return bool(tokens & {b.lower() for b in brand_keywords})
