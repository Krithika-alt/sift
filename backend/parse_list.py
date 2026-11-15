"""Turn a spoken or typed grocery list into separate items.

    "I need two gallons of milk, a dozen eggs and some greek yogurt"
      -> milk (x2), eggs, greek yogurt

The browser's speech recognition produces the text; this module only splits and cleans it,
then runs each item through the same fuzzy matcher the ranking uses. Rule-based on purpose:
it is instant, works offline, and cannot make up items.
"""
from __future__ import annotations

import re

from matching import _norm, match_items

NUMBER_WORDS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "couple": 2, "pair": 2,
    "dozen": 1, "half": 1,
}
UNIT_WORDS = (
    "gallons?", "gals?", "pounds?", "lbs?", "ounces?", "oz", "dozens?", "loaf", "loaves", "bags?",
    "boxes", "box", "cartons?", "jars?", "bottles?", "cans?", "packs?", "packages?", "containers?",
    "bunch", "bunches", "heads?", "sticks?", "rolls?", "tubs?", "pints?", "quarts?", "liters?",
)
FILLER_PREFIXES = (
    r"(?:(?:hey|ok|okay|um|uh|so|well|alright)[,.]? +)*",
    r"(?:(?:can|could|would) you )?(?:please )?",
    r"(?:i (?:need|want|would like|'d like|d like|have to get|gotta get|am getting|am buying)|"
    r"i'?m (?:getting|buying)|let'?s get|we need|get me|get|grab|buy|pick up|add|put|my list is|"
    r"my grocery list is|shopping list|grocery list|list)\b[:,]? ?",
)
FILLER_SUFFIX = re.compile(r"\b(?:to|on|in|into) (?:my |the |our )?(?:list|bag|cart|basket)\b.*$")
SPLIT = re.compile(r"\s*(?:,|;|\.|\band then\b|\bthen\b|\balso\b|\bplus\b|\bas well as\b|\band\b|\bwith\b)\s*")
FILLER_WORDS = re.compile(r"\b(?:some|any|the|of|please|my|more|extra|fresh)\b")
_QTY = re.compile(
    rf"^(?:(?P<num>\d+(?:\.\d+)?)|(?P<word>{'|'.join(NUMBER_WORDS)}))\s*(?:x\s*)?"
    rf"(?:(?:{'|'.join(UNIT_WORDS)})\b\s*)?(?:of\s+)?(?=\S)"
)


def _protect_and(text: str, products: list) -> tuple[str, dict]:
    """Keep product names that contain ' and ' (mac and cheese) from being split."""
    protected = {}
    for p in products or []:
        terms = (p.get("search_terms") or "").split(",") + [p.get("name") or ""]
        for t in terms:
            t = _norm(t)
            if " and " in f" {t} " and t and t in _norm(text):
                key = f"zzprot{len(protected)}zz"
                protected[key] = t
                text = re.sub(re.escape(t), key, _norm_keep(text), flags=re.I)
    return text, protected


def _norm_keep(text: str) -> str:
    return text.lower()


def _strip_quantity(piece: str) -> tuple[str, int]:
    m = _QTY.match(piece)
    if not m:
        return piece, 1
    qty = float(m.group("num")) if m.group("num") else NUMBER_WORDS[m.group("word")]
    rest = piece[m.end():].strip()
    if not rest:  # "a" or "two" alone is not an item
        return piece, 1
    return rest, max(int(qty), 1)


def split_list(text: str, products: list | None = None) -> list[dict]:
    """[{"text": "milk", "quantity": 2, "raw": "two gallons of milk"}] in the order spoken."""
    t = (text or "").strip().lower().replace("’", "'")
    if not t:
        return []
    for pat in FILLER_PREFIXES:
        t = re.sub(r"^" + pat, "", t).strip()
    t = re.sub(r"\b(?:a )?(?:couple|pair)(?: of)? ", "2 ", t)
    t = re.sub(r"\ba few(?: of)? ", "3 ", t)
    t = FILLER_SUFFIX.sub("", t).strip()
    t, protected = _protect_and(t, products or [])
    out, seen = [], set()
    for raw in SPLIT.split(t):
        raw = raw.strip(" .!?")
        for key, original in protected.items():
            raw = raw.replace(key, original)
        if not raw:
            continue
        piece, qty = _strip_quantity(raw)
        piece = re.sub(r"\s+", " ", FILLER_WORDS.sub(" ", piece)).strip(" .!?")
        if not piece or piece in ("a", "an", "and", "um", "uh", "hmm", "yeah"):
            continue
        key = _norm(piece)
        if key in seen:
            continue
        seen.add(key)
        out.append({"text": piece, "quantity": qty, "raw": raw})
    return out


def parse_list(text: str, products: list) -> dict:
    """Split the transcript and match each item. Items we cannot match are flagged, never dropped."""
    pieces = split_list(text, products)
    by_pid = {p["product_id"]: p for p in products}
    items, unmatched = [], []
    for piece in pieces:
        match = match_items([piece["text"]], products)
        pid = match[0][1] if match else None
        item = {**piece, "matched": pid is not None, "product_id": pid,
                "name": by_pid[pid]["name"] if pid else None}
        items.append(item)
        if pid is None:
            unmatched.append(piece["text"])
    return {"items": items, "unmatched": unmatched,
            "rank_items": [i["text"] for i in items]}
