"""The assistant's brain: Genie answers, the tables check them.

For price, stock and "which is cheaper" questions we compute the answer straight from the
tables as well (assistant.py). If Genie's answer does not contain the key facts from the tables
(the cheapest store and its price, both prices, the stores without stock), we return the table
answer instead and say so. Swap and protein questions are answered from the tables (instant) unless GENIE_OPEN_ENDED=1.
If Genie is off or fails, the table answer is returned. Every response says where it came from:

    source   "genie"      Genie's answer (verified True when the tables agreed)
             "grounded"   straight from the tables (Genie off, failed, or disagreed: see `note`)
"""
from __future__ import annotations

import copy
import hashlib
import os
import time

from assistant import _intent, answer_question

# Genie takes 10-25 s. Repeated questions (same question, same prices, same basket) are served
# from this cache; any new price report changes the key, so answers never go stale.
_CACHE: dict = {}
CACHE_SECONDS = 600


def _cache_key(question: str, ranking: dict | None, data: dict) -> str:
    stores = (ranking or {}).get("ranked_stores") or []
    basket = [(l.get("name"), l.get("quantity")) for l in (stores[0].get("items_breakdown") or [])] if stores else []
    prices = sorted((r["store_id"], r["product_id"], round(r["price"], 2), bool(r.get("in_stock")),
                     str(r.get("observed_at"))) for r in data.get("prices", []))
    raw = repr((question.strip().lower(), stores[0]["store_id"] if stores else None, basket, prices))
    return hashlib.sha1(raw.encode()).hexdigest()


def _norm(text: str) -> str:
    return text.lower().replace("’", "'").replace("$", "")


def agrees(verify: list, genie: dict) -> bool:
    """True when every key fact from the tables appears in Genie's answer or rows."""
    text = _norm(genie.get("answer", "") + " " + " ".join(genie.get("facts_used", [])))
    return all(_norm(v) in text for v in verify)


def respond(question: str, ranking: dict | None, data: dict, genie_fn=None) -> dict:
    grounded = answer_question(question, ranking, data)
    verify = grounded.pop("verify", None)
    grounded["source"] = "grounded"
    grounded["headline"] = grounded["answer"].split(". ")[0].rstrip(".") + "."
    intent = _intent(question)
    if genie_fn is None or intent == "why":
        return grounded
    # Swap and protein chips are answered from the tables by default: instant, and the evaluation
    # shows they are exact. Set GENIE_OPEN_ENDED=1 to send them to Genie too.
    if intent in ("swap", "protein") and os.getenv("GENIE_OPEN_ENDED") != "1":
        return grounded
    key = _cache_key(question, ranking, data)
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return copy.deepcopy(hit[1])
    try:
        genie = genie_fn(question)
    except Exception:  # noqa: BLE001  Genie down, slow or empty: the table answer still works
        return grounded
    if verify:
        if agrees(verify, genie):
            genie["verified"] = True
        else:
            grounded["note"] = "Genie's answer did not match our price tables, so this answer comes straight from the tables."
            grounded["genie_answer"] = genie.get("answer", "")
            _CACHE[key] = (time.time(), copy.deepcopy(grounded))
            return grounded
    _CACHE[key] = (time.time(), copy.deepcopy(genie))
    return genie
