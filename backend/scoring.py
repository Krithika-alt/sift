"""Sift scoring model (section 3 of the team build plan).

This is a transparent scoring model with user-tunable weights. It is NOT a
trained/deep-learning model. The API field is called `ml_rank_score` only
because the shared contract names it that way.

    score = w_p * (cheapest_total / this_total)
          + w_d * (1 - d / d_max)
          + w_s * in_stock_share
          + w_m * preference_match

Weights are rescaled so they sum to 1.
  * price / distance / preference come from the sliders (defaults 0.6/0.3/0.1)
  * stock weight is 0 unless (a) the caller passes "stock" explicitly or
    (b) some basket item is reported out of stock somewhere, then it is 0.1.
  * d = haversine miles from the user, d_max = farthest store in the results
    (minimum 1 mile).
  * A missing / out-of-stock item is counted at the most expensive price seen
    for that item anywhere, and listed in the store's `missing_items`.
  * preference_match = share of basket items where this store has the lowest
    unit price (ties count). There is no brand/dietary input in the contract
    yet, so this is the "best unit price" signal.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

EARTH_RADIUS_MILES = 3958.8
DEFAULT_WEIGHTS = {"price": 0.6, "distance": 0.3, "preference": 0.1}
OUT_OF_STOCK_WEIGHT = 0.1
_MIN_TS = datetime.min.replace(tzinfo=timezone.utc)


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(a))


def normalize_weights(weights: dict | None, any_out_of_stock: bool = False) -> dict:
    """Return {"price","distance","preference","stock"} that sums to 1."""
    weights = weights or {}
    w = {k: max(float(weights.get(k, default)), 0.0) for k, default in DEFAULT_WEIGHTS.items()}
    if "stock" in weights and weights["stock"] is not None:
        w["stock"] = max(float(weights["stock"]), 0.0)
    else:
        w["stock"] = OUT_OF_STOCK_WEIGHT if any_out_of_stock else 0.0
    total = sum(w.values())
    if total <= 0:
        w = {**DEFAULT_WEIGHTS, "stock": 0.0}
        total = sum(w.values())
    return {k: v / total for k, v in w.items()}


def time_ago(ts: datetime | None, now: datetime) -> str | None:
    if ts is None:
        return None
    secs = max((now - ts).total_seconds(), 0)
    if secs < 60:
        return "just now"
    mins = int(secs // 60)
    if mins < 60:
        return f"{mins} min{'s' if mins != 1 else ''} ago"
    hrs = mins // 60
    if hrs < 24:
        return f"{hrs} hr{'s' if hrs != 1 else ''} ago"
    days = hrs // 24
    return f"{days} day{'s' if days != 1 else ''} ago"


def _fmt_unit_price(row: dict) -> str | None:
    up = row.get("unit_price")
    if up is None:
        return None
    return f"${up:.2f}/{row.get('unit') or 'unit'}"


STALE_AFTER_DAYS = 7


def _freshness(row: dict | None, now: datetime) -> dict:
    """Extra breakdown fields: how old the price is and whether it is stale.

    Simulated prices are never called stale (they are already labelled
    'simulated'). This does NOT change the score, it only makes age visible.
    """
    if row is None or row.get("observed_at") is None:
        return {"price_age": None, "stale": False}
    ts = row["observed_at"]
    old = (now - ts).total_seconds() > STALE_AFTER_DAYS * 86400
    return {"price_age": time_ago(ts, now), "stale": bool(old and row.get("source") != "simulated")}


def _ts(row: dict) -> datetime:
    return row.get("observed_at") or _MIN_TS


def rank_stores(
    user_location: dict,
    items: list[tuple[str, str | None]],
    weights: dict | None,
    budget: float | None,
    prices: list[dict],
    stores: list[dict],
    products: dict[str, dict] | None = None,
    now: datetime | None = None,
    quantities: dict | None = None,
) -> list[dict]:
    """Rank stores for a basket. Returns the contract's `ranked_stores` list.

    items:  [(user_text, product_id or None)]; None = no product match.
    prices: rows shaped like the `latest_prices` view.
    budget: accepted for contract compatibility; not part of the formula.
    quantities: optional {product_id: how many}; the basket total uses price x quantity
        (default 1 each). Each breakdown line has `quantity` and `line_total`.
    """
    now = now or datetime.now(timezone.utc)
    products = products or {}
    matched = [(q, pid) for q, pid in items if pid]
    unmatched = [q for q, pid in items if not pid]

    latest: dict[tuple[str, str], dict] = {}
    for r in prices:
        key = (r["store_id"], r["product_id"])
        if key not in latest or _ts(r) > _ts(latest[key]):
            latest[key] = r

    max_seen: dict[str, float] = {}
    for (_, pid), r in latest.items():
        max_seen[pid] = max(max_seen.get(pid, 0.0), r["price"])

    any_out = any(
        (sid, pid) in latest and not latest[(sid, pid)]["in_stock"]
        for pid in {p for _, p in matched}
        for sid in (s["store_id"] for s in stores)
    )
    w = normalize_weights(weights, any_out)

    # best (lowest) in-stock unit price per product, for the preference signal
    best_unit: dict[str, float] = {}
    for (sid, pid), r in latest.items():
        if r["in_stock"]:
            up = r.get("unit_price") if r.get("unit_price") is not None else r["price"]
            best_unit[pid] = min(best_unit.get(pid, float("inf")), up)

    rows = []
    for s in stores:
        sid = s["store_id"]
        d = haversine_miles(user_location["lat"], user_location["lon"], s["lat"], s["lon"])
        total = 0.0
        in_stock_n = 0
        pref_n = 0
        missing = list(unmatched)
        breakdown = []
        last_crowd: datetime | None = None
        for q, pid in matched:
            r = latest.get((sid, pid))
            name = products.get(pid, {}).get("name", pid)
            qty = max(int((quantities or {}).get(pid, 1)), 1)
            if r is not None and r["in_stock"]:
                total += r["price"] * qty
                in_stock_n += 1
                up = r.get("unit_price") if r.get("unit_price") is not None else r["price"]
                if up <= best_unit.get(pid, float("inf")) + 1e-9:
                    pref_n += 1
                breakdown.append({
                    "query": q, "name": name, "price": round(r["price"], 2),
                    "quantity": qty, "line_total": round(r["price"] * qty, 2),
                    "unit_price": _fmt_unit_price(r), "in_stock": True,
                    "source": r.get("source"), **_freshness(r, now),
                })
            else:
                total += max_seen.get(pid, 0.0) * qty
                missing.append(q)
                shelf = r["price"] if r else max_seen.get(pid, 0.0)
                breakdown.append({
                    "query": q, "name": name,
                    "price": round(shelf, 2),
                    "quantity": qty, "line_total": round(shelf * qty, 2),
                    "unit_price": _fmt_unit_price(r) if r else None,
                    "in_stock": False,
                    "source": r.get("source") if r else None, **_freshness(r, now),
                })
            if r is not None and r.get("source") == "crowd":
                if last_crowd is None or _ts(r) > last_crowd:
                    last_crowd = _ts(r)
        n = len(matched)
        rows.append({
            "store": s, "d": d, "total": total,
            "stock_share": in_stock_n / n if n else 1.0,
            "pref": pref_n / n if n else 0.0,
            "missing": missing, "breakdown": breakdown, "last_crowd": last_crowd,
        })

    totals = [r["total"] for r in rows if r["total"] > 0]
    cheapest = min(totals) if totals else 0.0
    mean_total = sum(r["total"] for r in rows) / len(rows) if rows else 0.0
    d_max = max([r["d"] for r in rows] + [1.0])

    out = []
    for r in rows:
        price_score = cheapest / r["total"] if r["total"] > 0 else 0.0
        dist_score = 1 - r["d"] / d_max
        score = (
            w["price"] * price_score
            + w["distance"] * dist_score
            + w["stock"] * r["stock_share"]
            + w["preference"] * r["pref"]
        )
        savings = (mean_total - r["total"]) / mean_total * 100 if mean_total else 0.0
        s = r["store"]
        out.append({
            "store_id": s["store_id"],
            "name": s["name"],
            "lat": s["lat"],
            "lon": s["lon"],
            "distance_miles": round(r["d"], 2),
            "total_basket_price": round(r["total"], 2),
            "unit_price_savings_pct": round(savings, 1),
            "ml_rank_score": round(score, 4),
            "last_crowd_ping": time_ago(r["last_crowd"], now),
            "missing_items": r["missing"],
            "items_breakdown": r["breakdown"],
        })
    out.sort(key=lambda x: (-x["ml_rank_score"], x["total_basket_price"], x["distance_miles"]))
    return out
