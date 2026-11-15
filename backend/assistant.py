"""The Sift assistant: answers using ONLY numbers from the ranking JSON and our tables.

No LLM, no invented numbers. Three demo questions are handled:
  * "Why did <store> win?"             -> compares the stores using the ranking JSON
  * "Cheapest protein per dollar?"     -> cheapest unit price among protein items
  * "What can I swap to save money?"   -> cheaper same-kind products, and cheaper stores

answer_question(question, ranking, data=None) -> {"answer": str, "facts_used": [str]}
`data` is {"stores": [...], "products": [...], "prices": [...latest_prices rows...]};
without it only the "why" question can be answered. A Databricks Genie space or an
LLM can later be put behind this same function.

Honesty: every price quoted says whether it is real, crowd-reported or simulated,
and the protein answer says plainly that we have prices, not nutrition data.
"""
from __future__ import annotations

import re

SWAP_WORDS = ("swap", "save money", "saving", "substitut", "alternative", "instead", "replace")
STOCK_WORDS = ("in stock", "do not have", "don't have", "does not have", "doesn't have", "out of stock", "not carry")
PRICE_WORDS = ("cheapest", "cheaper", "lowest price", "best price", "how much", "price of", "cost")
PROTEIN_CATEGORIES = {"protein", "meat", "poultry", "seafood", "eggs", "meat & seafood",
                      "meat and seafood", "meat/seafood", "meat & poultry"}
PROTEIN_WORDS = ("chicken", "beef", "pork", "turkey", "egg", "tofu", "tuna", "salmon", "bean",
                 "lentil", "greek yogurt", "peanut butter", "sausage", "bacon", "shrimp")
GENERIC_WORDS = {"large", "small", "medium", "plain", "whole", "fresh", "organic", "boneless", "skinless",
                 "natural", "original", "classic", "brand", "store", "pack", "with", "and", "the", "for",
                 "nonfat", "lowfat", "reduced", "regular", "old", "fashioned"}
MIN_SWAP_SAVING = 0.25      # dollars; smaller differences are noise
MIN_STORE_SAVING = 0.50     # dollars, for "cheaper at another store"
SOURCE_LABEL = {"simulated": "simulated price", "website": "real price", "api": "real price",
                "crowd": "crowd-reported"}


def _label(source) -> str:
    return SOURCE_LABEL.get(source or "", "price source unknown")


def _find_named_store(question: str, stores: list) -> dict | None:
    q = question.lower()
    for s in stores:
        if s["name"].lower() in q or s["store_id"].replace("_", " ") in q:
            return s
    return None


def _intent(question: str) -> str:
    q = question.lower()
    if "protein" in q:
        return "protein"
    if any(w in q for w in SWAP_WORDS):
        return "swap"
    if any(w in q for w in STOCK_WORDS):
        return "stock"
    if any(w in q for w in PRICE_WORDS):
        return "price"
    return "why"


# ---------- why did a store win ----------
def explain_ranking(question: str, ranking: dict | None) -> dict:
    stores = (ranking or {}).get("ranked_stores") or []
    if not stores:
        return {"answer": "Run a basket first, then ask me why a store ranked where it did.",
                "facts_used": []}
    top = stores[0]
    named = _find_named_store(question, stores)
    other = named if named and named["store_id"] != top["store_id"] else (stores[1] if len(stores) > 1 else None)

    facts = [f"{top['name']}: basket ${top['total_basket_price']:.2f}, "
             f"{top['distance_miles']:.1f} mi, score {top['ml_rank_score']:.2f}"]
    parts = [f"{top['name']} ranked #1 with a score of {top['ml_rank_score']:.2f}: "
             f"your basket is ${top['total_basket_price']:.2f} and it is {top['distance_miles']:.1f} miles away."]
    if other:
        facts.append(f"{other['name']}: basket ${other['total_basket_price']:.2f}, "
                     f"{other['distance_miles']:.1f} mi, score {other['ml_rank_score']:.2f}")
        dp = other["total_basket_price"] - top["total_basket_price"]
        dd = other["distance_miles"] - top["distance_miles"]
        price_txt = (f"${abs(dp):.2f} cheaper" if dp > 0.005 else
                     f"${abs(dp):.2f} more expensive" if dp < -0.005 else "the same price")
        dist_txt = (f"{abs(dd):.1f} miles closer" if dd > 0.05 else
                    f"{abs(dd):.1f} miles farther" if dd < -0.05 else "about the same distance")
        parts.append(f"Compared with {other['name']}, it is {price_txt} and {dist_txt}.")
    if top.get("missing_items"):
        parts.append(f"Heads up: {', '.join(top['missing_items'])} unavailable there.")
        facts.append(f"missing at {top['name']}: {', '.join(top['missing_items'])}")
    stale = [b["name"] for b in top["items_breakdown"] if b.get("stale")]
    if stale:
        ages = ", ".join(f"{b['name']} ({b['price_age']})" for b in top["items_breakdown"] if b.get("stale"))
        parts.append(f"Note: some prices here are over a week old and may have changed: {ages}.")
        facts.append(f"stale prices at {top['name']}: {ages}")
    if top.get("last_crowd_ping"):
        parts.append(f"A shopper reported a price here {top['last_crowd_ping']}.")
        facts.append(f"last crowd ping at {top['name']}: {top['last_crowd_ping']}")
    return {"answer": " ".join(parts), "facts_used": facts}


# ---------- shared helpers for the data questions ----------
def _index(data: dict) -> tuple:
    stores = {s["store_id"]: s for s in data["stores"]}
    products = {p["product_id"]: p for p in data["products"]}
    latest = {}
    for r in data["prices"]:
        latest[(r["store_id"], r["product_id"])] = r
    return stores, products, latest


def _in_stock(row) -> bool:
    return bool(row) and row.get("in_stock") and row.get("unit_price") is not None


def _is_protein(p: dict) -> bool:
    if (p.get("category") or "").strip().lower() in PROTEIN_CATEGORIES:
        return True
    name = (p.get("name") or "").lower()
    return any(w in name for w in PROTEIN_WORDS)


def _tokens(p: dict) -> set:
    words = set()
    for t in (p.get("search_terms") or "").split(","):
        words.update(re.findall(r"[a-z]{4,}", t.lower()))
    words.update(re.findall(r"[a-z]{4,}", (p.get("name") or "").lower()))
    return {w.rstrip("s") for w in words} - GENERIC_WORDS


# ---------- cheapest protein ----------
def protein_answer(data: dict) -> dict:
    stores, products, latest = _index(data)
    deals = []
    for p in products.values():
        if not _is_protein(p):
            continue
        rows = [r for (sid, pid), r in latest.items() if pid == p["product_id"] and _in_stock(r)]
        if rows:
            best = min(rows, key=lambda r: r["unit_price"])
            deals.append((best.get("unit") or p.get("size_unit") or "unit", best["unit_price"], p, best))
    if not deals:
        return {"answer": "I can't find protein items with in-stock prices in our tables yet.", "facts_used": []}
    deals.sort(key=lambda d: (d[0], d[1]))
    lines, facts = [], []
    for unit, up, p, r in deals[:6]:
        store = stores.get(r["store_id"], {}).get("name", r["store_id"])
        line = f"{p['name']}: ${up:.2f}/{unit} at {store} ({_label(r.get('source'))})"
        lines.append(line)
        facts.append(line)
    answer = ("Cheapest protein items by unit price, best store for each: " + "; ".join(lines) + ". "
              "I only have prices, not nutrition data, so this compares cost per unit "
              "(per lb, per oz, per count), not grams of protein per dollar.")
    return {"answer": answer, "facts_used": facts}


# ---------- swaps ----------
def swap_answer(data: dict, ranking: dict | None) -> dict:
    ranked = (ranking or {}).get("ranked_stores") or []
    if not ranked:
        return {"answer": "Run a basket first, then ask what you can swap to save money.", "facts_used": []}
    stores, products, latest = _index(data)
    top = ranked[0]
    by_name = {(p.get("name") or "").lower(): p for p in products.values()}
    basket = [by_name[b["name"].lower()] for b in top["items_breakdown"] if b["name"].lower() in by_name]

    swaps = []   # (saving, text)
    for p in basket:
        row_p = latest.get((top["store_id"], p["product_id"]))
        if not _in_stock(row_p):
            continue
        unit = row_p.get("unit") or p.get("size_unit")
        best = None
        for q in products.values():
            if q["product_id"] == p["product_id"]:
                continue
            same_kind = (not p.get("category") or not q.get("category")
                         or p["category"].lower() == q["category"].lower())
            if not same_kind or not (_tokens(p) & _tokens(q)):
                continue
            row_q = latest.get((top["store_id"], q["product_id"]))
            if not _in_stock(row_q) or (row_q.get("unit") or q.get("size_unit")) != unit:
                continue
            gap = row_p["unit_price"] - row_q["unit_price"]
            saving = gap * (p.get("size_value") or 1)
            if saving >= MIN_SWAP_SAVING and (best is None or saving > best[0]):
                best = (saving, q, row_q)
        if best:
            saving, q, row_q = best
            swaps.append((saving, f"swap {p['name']} for {q['name']} at {top['name']}: about "
                                  f"${saving:.2f} cheaper for the same amount "
                                  f"(${row_q['unit_price']:.2f}/{unit} vs ${row_p['unit_price']:.2f}/{unit}, "
                                  f"{_label(row_q.get('source'))})"))
    swaps.sort(key=lambda s: -s[0])

    cheaper_elsewhere = []   # same item, cheaper at another store (distance shown)
    dist = {s["store_id"]: s["distance_miles"] for s in ranked}
    for p in basket:
        here = latest.get((top["store_id"], p["product_id"]))
        if not _in_stock(here):
            continue
        for sid in dist:
            row = latest.get((sid, p["product_id"]))
            if sid != top["store_id"] and _in_stock(row) and here["price"] - row["price"] >= MIN_STORE_SAVING:
                cheaper_elsewhere.append((here["price"] - row["price"],
                    f"{p['name']} is ${here['price'] - row['price']:.2f} cheaper at "
                    f"{stores.get(sid, {}).get('name', sid)} ({dist[sid]:.1f} mi away, {_label(row.get('source'))})"))
    cheaper_elsewhere.sort(key=lambda s: -s[0])

    parts, facts = [], []
    if swaps:
        parts.append("Product swaps: " + "; ".join(t for _, t in swaps[:3]) + ".")
        facts += [t for _, t in swaps[:3]]
    else:
        parts.append(f"I found no cheaper same-kind products at {top['name']} for your basket "
                     "(swaps need similar items in our catalog, like a store brand next to a name brand).")
    if cheaper_elsewhere:
        parts.append("Same item, different store: " + "; ".join(t for _, t in cheaper_elsewhere[:2]) + ". "
                     "Check the extra distance before switching.")
        facts += [t for _, t in cheaper_elsewhere[:2]]
    return {"answer": " ".join(parts), "facts_used": facts}


def _find_product(question: str, products: list) -> dict | None:
    """The product whose name (or search term) appears in the question; longest match wins."""
    q = question.lower()
    best, best_len = None, 0
    for p in products:
        names = [(p.get("name") or "").lower()]
        names.append(names[0].split(",")[0].strip())
        names += [t.strip().lower() for t in (p.get("search_terms") or "").split(",") if len(t.strip()) >= 4]
        for n in names:
            if n and n in q and len(n) > best_len:
                best, best_len = p, len(n)
    return best


def pair_answer(question: str, data: dict) -> dict | None:
    """'At <store>, is <product A> cheaper than <product B>?' -> both prices and the gap."""
    stores, products, latest = _index(data)
    q = question.lower()
    named = [p for p in products.values() if (p.get("name") or "").lower() in q]
    store = _find_named_store(question, list(stores.values()))
    if len(named) < 2 or not store:
        return None
    rows = []
    for p in named:
        r = latest.get((store["store_id"], p["product_id"]))
        if _in_stock(r):
            rows.append((r["price"], p, r))
    if len(rows) < 2:
        return None
    rows.sort(key=lambda x: x[0])
    parts = [f"{p['name']} ${price:.2f} [{_label(r.get('source'))}]" for price, p, r in rows]
    gap = rows[-1][0] - rows[0][0]
    answer = (f"At {store['name']}: {'; '.join(parts)}. "
              f"{rows[0][1]['name']} is cheaper by ${gap:.2f}.")
    return {"answer": answer, "facts_used": parts}


def price_answer(question: str, data: dict) -> dict:
    """Cheapest store (with every store's price and the gap) for the product named in the question."""
    stores, products, latest = _index(data)
    p = _find_product(question, list(products.values()))
    if not p:
        return {"answer": "I couldn't tell which product you mean. Try the full product name, for example "
                          "'Large eggs, 12 ct'.", "facts_used": []}
    rows = sorted(((r["price"], sid, r) for (sid, pid), r in latest.items()
                   if pid == p["product_id"] and _in_stock(r) and sid in stores), key=lambda x: x[0])
    if not rows:
        return {"answer": f"No store has an in-stock price for {p['name']} in our tables.", "facts_used": []}
    low = rows[0]
    parts = []
    for i, (price, sid, r) in enumerate(rows):
        gap = f" (+${price - low[0]:.2f})" if i else ""
        parts.append(f"{stores[sid]['name']} ${price:.2f}{gap} [{_label(r.get('source'))}]")
    answer = (f"The cheapest {p['name']} is ${low[0]:.2f} at {stores[low[1]]['name']}. "
              f"All stores: {'; '.join(parts)}.")
    return {"answer": answer, "facts_used": parts}


def stock_answer(question: str, data: dict) -> dict:
    stores, products, latest = _index(data)
    p = _find_product(question, list(products.values()))
    if not p:
        return {"answer": "I couldn't tell which product you mean.", "facts_used": []}
    lacking = [s["name"] for sid, s in stores.items() if not _in_stock(latest.get((sid, p["product_id"])))]
    if not lacking:
        return {"answer": f"Every store in our tables has {p['name']} in stock.", "facts_used": []}
    ans = f"{p['name']} is not in stock (or has no price) at: {', '.join(lacking)}."
    return {"answer": ans, "facts_used": [ans]}


def answer_question(question: str, ranking: dict | None, data: dict | None = None) -> dict:
    intent = _intent(question)
    if intent in ("protein", "swap", "stock", "price") and data is None:
        return {"answer": "I don't have access to the price tables right now, so I can only explain a ranking.",
                "facts_used": []}
    if intent == "protein":
        return protein_answer(data)
    if intent == "swap":
        return swap_answer(data, ranking)
    if intent == "stock":
        return stock_answer(question, data)
    if intent == "price":
        return pair_answer(question, data) or price_answer(question, data)
    return explain_ranking(question, ranking)
