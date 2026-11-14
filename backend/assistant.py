"""Explains a ranking using ONLY the numbers in the ranking JSON.

This is the grounded fallback (no LLM, no invented numbers). Later we can
swap in a Databricks Genie space or an LLM call behind the same function:
answer_question(question, ranking) -> {"answer": str, "facts_used": [str]}.
"""
from __future__ import annotations


def _find_named_store(question: str, stores: list[dict]) -> dict | None:
    q = question.lower()
    for s in stores:
        if s["name"].lower() in q or s["store_id"].replace("_", " ") in q:
            return s
    return None


def answer_question(question: str, ranking: dict | None) -> dict:
    stores = (ranking or {}).get("ranked_stores") or []
    if not stores:
        return {
            "answer": "Run a basket first, then ask me why a store ranked where it did.",
            "facts_used": [],
        }
    top = stores[0]
    named = _find_named_store(question, stores)
    other = named if named and named["store_id"] != top["store_id"] else (stores[1] if len(stores) > 1 else None)

    facts = [
        f"{top['name']}: basket ${top['total_basket_price']:.2f}, "
        f"{top['distance_miles']:.1f} mi, score {top['ml_rank_score']:.2f}"
    ]
    parts = [
        f"{top['name']} ranked #1 with a score of {top['ml_rank_score']:.2f}: "
        f"your basket is ${top['total_basket_price']:.2f} and it is {top['distance_miles']:.1f} miles away."
    ]
    if other:
        facts.append(
            f"{other['name']}: basket ${other['total_basket_price']:.2f}, "
            f"{other['distance_miles']:.1f} mi, score {other['ml_rank_score']:.2f}"
        )
        dp = other["total_basket_price"] - top["total_basket_price"]
        dd = other["distance_miles"] - top["distance_miles"]
        price_txt = (
            f"${abs(dp):.2f} cheaper" if dp > 0.005 else
            f"${abs(dp):.2f} more expensive" if dp < -0.005 else "the same price"
        )
        dist_txt = (
            f"{abs(dd):.1f} miles closer" if dd > 0.05 else
            f"{abs(dd):.1f} miles farther" if dd < -0.05 else "about the same distance"
        )
        parts.append(f"Compared with {other['name']}, it is {price_txt} and {dist_txt}.")
    if top.get("missing_items"):
        parts.append(f"Heads up: {', '.join(top['missing_items'])} unavailable there.")
        facts.append(f"missing at {top['name']}: {', '.join(top['missing_items'])}")
    if top.get("last_crowd_ping"):
        parts.append(f"A shopper reported a price here {top['last_crowd_ping']}.")
        facts.append(f"last crowd ping at {top['name']}: {top['last_crowd_ping']}")
    return {"answer": " ".join(parts), "facts_used": facts}
