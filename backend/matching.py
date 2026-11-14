"""Turn messy user text ("eggz", "greek yoghurt") into product_ids.

Exact match on the products' search_terms first, then fuzzy match with
rapidfuzz. No model training. Anything that doesn't match comes back with
product_id = None so the API can list it in `missing_items`.
"""
from __future__ import annotations

import re

from rapidfuzz import fuzz, process

FUZZY_CUTOFF = 80


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.lower())).strip()


def build_term_index(products: list[dict]) -> dict[str, str]:
    """term -> product_id, from search_terms plus the product name."""
    index: dict[str, str] = {}
    for p in products:
        terms = [t for t in (p.get("search_terms") or "").split(",")]
        terms.append(p["name"])
        for t in terms:
            t = _norm(t)
            if t and t not in index:
                index[t] = p["product_id"]
    return index


def match_items(user_items: list[str], products: list[dict], cutoff: int = FUZZY_CUTOFF):
    """Return [(user_text, product_id or None)], de-duplicated by product."""
    index = build_term_index(products)
    terms = list(index)
    result: list[tuple[str, str | None]] = []
    seen: set[str] = set()
    for raw in user_items:
        text = _norm(raw)
        if not text:
            continue
        pid = index.get(text)
        if pid is None:
            hit = process.extractOne(text, terms, scorer=fuzz.WRatio, score_cutoff=cutoff)
            pid = index[hit[0]] if hit else None
        if pid is not None:
            if pid in seen:
                continue
            seen.add(pid)
        result.append((raw.strip(), pid))
    return result
