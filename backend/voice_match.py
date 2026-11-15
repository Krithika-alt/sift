"""Match one spoken grocery item to a product, and say how sure we are.

Speech-to-text mishears grocery words ("bred", "ramon", "yogert"). Matching goes through five
steps, most trusted first, and every result carries a confidence and the way it matched:

  exact      the words are one of the product's search terms          100
  alias      a known mishearing or nickname ("tee pee", "yoghurt")     95
  fuzzy      close spelling (rapidfuzz); refused when two products tie  80-99
  phonetic   sounds alike ("bred" ~ "bread", "ramon" ~ "ramen")        75
  suggested  nothing good enough: top guesses offered, NOT auto-picked

Wrong silent matches are worse than "didn't catch that", so weak matches are left to the
user to confirm. Rule-based on purpose: instant, offline, cannot invent products.
"""
from __future__ import annotations

import re

from rapidfuzz import fuzz, process

from matching import _norm, build_term_index

FUZZY_CUTOFF = 80       # same cutoff the ranking uses
TIE_MARGIN = 3          # two different products this close (and under 90) = ambiguous
SUGGEST_CUTOFF = 55
CONFIRM_BELOW = 90      # matched but under this confidence -> the app should ask the user

# Mishearings and nicknames -> a phrase that is one of the products' search terms.
ALIASES = {
    "bred": "bread", "brad": "bread", "loaf of bread": "bread", "sliced bread": "bread",
    "sandwich loaf": "sandwich bread",
    "rise": "rice", "ryce": "rice", "brown rice": "rice", "white rise": "white rice",
    "pasto": "pasta", "past a": "pasta", "spaghetti noodles": "spaghetti", "macaroni": "pasta",
    "ramon": "ramen", "raman": "ramen", "romaine": "ramen", "roman noodles": "ramen",
    "ramen noodles": "ramen", "ramon noodles": "ramen", "raman noodles": "ramen", "romaine noodles": "ramen", "ramen noodle": "ramen", "top ramen": "ramen", "cup noodles": "ramen",
    "t p": "toilet paper", "tee pee": "toilet paper", "toilet tissue": "toilet paper",
    "bathroom tissue": "toilet paper", "loo roll": "toilet paper", "toilet roll": "toilet paper",
    "toilet papers": "toilet paper",
    "yogert": "yogurt", "yogourt": "yogurt", "yoghurt": "yogurt", "yogurts": "yogurt",
    "greek yoghurt": "greek yogurt", "greek yogert": "greek yogurt", "greek yogourt": "greek yogurt",
    "peanut but her": "peanut butter", "penut butter": "peanut butter", "peanutbutter": "peanut butter",
    "pb": "peanut butter", "peanut butters": "peanut butter",
    "oat meal": "oatmeal", "oat": "oats", "rolled oat": "rolled oats",
    "melk": "milk", "milks": "milk", "gallon of milk": "milk", "whole mill": "whole milk",
    "egg": "eggs", "eggses": "eggs", "dozen of eggs": "eggs",
    "banana": "bananas", "bananer": "bananas", "bannanas": "bananas",
    "chicken brest": "chicken breast", "chicken breasts": "chicken breast", "chicken best": "chicken breast",
}

_SPECIAL = [("ph", "f"), ("ck", "k"), ("kn", "n"), ("wr", "r"), ("qu", "kw"), ("x", "ks"),
            ("z", "s"), ("y", "i")]


def sound(word: str) -> str:
    """Rough consonant skeleton so words that sound alike get the same key.
    bread/bred -> brd, ramen/ramon/romaine -> rmn, yogurt/yogert -> iqrt."""
    w = re.sub(r"[^a-z]", "", word.lower())
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        w = w[:-1]
    for a, b in _SPECIAL:
        w = w.replace(a, b)
    w = re.sub(r"c(?=[eiy])", "s", w).replace("c", "k")
    if not w:
        return ""
    head, tail = w[0], w[1:]
    tail = re.sub(r"[aeiouhw]", "", tail)
    key = head + tail
    return re.sub(r"(.)\1+", r"\1", key)


def _phrase_key(text: str) -> str:
    return " ".join(k for k in (sound(w) for w in _norm(text).split()) if k)


class VoiceMatcher:
    """Build once per request; match many items."""

    def __init__(self, products: list[dict]):
        self.products = products
        self.by_pid = {p["product_id"]: p for p in products}
        self.index = build_term_index(products)          # term -> product_id
        self.terms = list(self.index)
        self.sounds: dict[str, set[str]] = {}
        for t, pid in self.index.items():
            k = _phrase_key(t)
            if len(k.replace(" ", "")) >= 3:
                self.sounds.setdefault(k, set()).add(pid)

    def _clean(self, text: str) -> str:
        t = _norm(text.replace("’", "'"))
        t = re.sub(r"\b(\w+) s\b", r"\1", t)    # "banana's" -> "banana"
        return t

    def _result(self, pid, conf, kind, suggestions=None):
        p = self.by_pid.get(pid) if pid else None
        return {"matched": pid is not None, "product_id": pid, "name": p["name"] if p else None,
                "confidence": conf, "match_type": kind,
                "needs_confirm": pid is not None and conf < CONFIRM_BELOW,
                "suggestions": suggestions or []}

    def _scored(self, text: str, limit: int = 8) -> list[tuple[str, float]]:
        """Best score per product, highest first."""
        best: dict[str, float] = {}
        for term, score, _ in process.extract(text, self.terms, scorer=fuzz.WRatio, limit=limit):
            pid = self.index[term]
            best[pid] = max(best.get(pid, 0), score)
        return sorted(best.items(), key=lambda kv: -kv[1])

    def _suggest(self, scored) -> list[dict]:
        return [{"product_id": pid, "name": self.by_pid[pid]["name"], "score": int(s)}
                for pid, s in scored if s >= SUGGEST_CUTOFF][:3]

    def match(self, raw: str) -> dict:
        text = self._clean(raw)
        if not text:
            return self._result(None, 0, "none")
        if text in self.index:
            return self._result(self.index[text], 100, "exact")
        alias = ALIASES.get(text)
        if alias and _norm(alias) in self.index:
            return self._result(self.index[_norm(alias)], 95, "alias")

        scored = self._scored(text)
        if scored and scored[0][1] >= FUZZY_CUTOFF:
            top_pid, top = scored[0]
            if len(scored) > 1 and top < 90 and top - scored[1][1] < TIE_MARGIN:
                return self._result(None, int(top), "ambiguous", self._suggest(scored))
            return self._result(top_pid, int(top), "fuzzy")

        pids = self.sounds.get(_phrase_key(text))
        if pids and len(pids) == 1 and len(_phrase_key(text).replace(" ", "")) >= 3:
            return self._result(next(iter(pids)), 75, "phonetic")

        return self._result(None, int(scored[0][1]) if scored else 0, "suggested", self._suggest(scored))
