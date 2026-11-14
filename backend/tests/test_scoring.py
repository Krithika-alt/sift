"""Scoring tests on a tiny fake price table (3 stores, 2 items)."""
from datetime import datetime, timezone

import pytest

from scoring import haversine_miles, normalize_weights, rank_stores, time_ago

NOW = datetime(2026, 11, 14, 22, 0, tzinfo=timezone.utc)
USER = {"lat": 43.0731, "lon": -89.4012}

# near = right at the user, mid = ~1 mi, far = ~2 mi
STORES = [
    {"store_id": "near", "name": "Near", "lat": 43.0731, "lon": -89.4012},
    {"store_id": "mid", "name": "Mid", "lat": 43.0731, "lon": -89.4012 + 0.0197},
    {"store_id": "far", "name": "Far", "lat": 43.0731, "lon": -89.4012 + 0.0395},
]
ITEMS = [("eggs", "eggs"), ("oats", "oats")]


def row(store, pid, price, in_stock=True, source="simulated", at=None):
    return {"store_id": store, "product_id": pid, "price": price,
            "unit_price": price / 10, "unit": "oz", "in_stock": in_stock,
            "source": source, "observed_at": at or NOW}


def prices(far_eggs=2.0):
    # far is cheapest, near is most expensive, mid in between
    return [
        row("near", "eggs", 4.0), row("near", "oats", 5.0),
        row("mid", "eggs", 3.0), row("mid", "oats", 4.0),
        row("far", "eggs", far_eggs), row("far", "oats", 3.0),
    ]


def run(weights, price_rows=None):
    return rank_stores(USER, ITEMS, weights, 20, price_rows or prices(), STORES, now=NOW)


def test_cheapest_wins_at_price_weight_one():
    ranked = run({"price": 1, "distance": 0, "preference": 0})
    assert ranked[0]["store_id"] == "far"
    assert ranked[0]["ml_rank_score"] == pytest.approx(1.0)


def test_closest_wins_at_distance_weight_one():
    ranked = run({"price": 0, "distance": 1, "preference": 0})
    assert ranked[0]["store_id"] == "near"


def test_ping_lowering_price_changes_winner():
    # at default weights "mid" is not the winner...
    before = run(None)
    # ...a crowd ping drops mid's eggs to $0.50 and it jumps up
    pinged = [r for r in prices() if not (r["store_id"] == "mid" and r["product_id"] == "eggs")]
    pinged.append(row("mid", "eggs", 0.50, source="crowd"))
    after = run({"price": 1, "distance": 0, "preference": 0}, pinged)
    assert after[0]["store_id"] == "mid"
    assert after[0]["last_crowd_ping"] == "just now"
    assert before[0]["last_crowd_ping"] is None


def test_missing_item_penalty_and_flag():
    rows = [r for r in prices() if not (r["store_id"] == "far" and r["product_id"] == "oats")]
    ranked = run({"price": 1, "distance": 0, "preference": 0}, rows)
    far = next(s for s in ranked if s["store_id"] == "far")
    assert far["missing_items"] == ["oats"]
    # oats counted at the most expensive price seen anywhere ($5.00)
    assert far["total_basket_price"] == pytest.approx(2.0 + 5.0)
    assert any(not b["in_stock"] for b in far["items_breakdown"])


def test_out_of_stock_activates_stock_weight():
    assert normalize_weights(None, any_out_of_stock=False)["stock"] == 0
    assert normalize_weights(None, any_out_of_stock=True)["stock"] > 0


def test_weights_sum_to_one_and_clamp_negatives():
    w = normalize_weights({"price": 6, "distance": 3, "preference": 1})
    assert sum(w.values()) == pytest.approx(1.0)
    assert normalize_weights({"price": -1, "distance": 0, "preference": 0})["price"] == pytest.approx(0.6)


def test_unmatched_words_listed_in_every_store():
    ranked = rank_stores(USER, ITEMS + [("unobtainium", None)], None, None, prices(), STORES, now=NOW)
    assert all("unobtainium" in s["missing_items"] for s in ranked)


def test_output_matches_contract_keys():
    s = run(None)[0]
    assert set(s) == {"store_id", "name", "lat", "lon", "distance_miles", "total_basket_price",
                      "unit_price_savings_pct", "ml_rank_score", "last_crowd_ping",
                      "missing_items", "items_breakdown"}
    assert set(s["items_breakdown"][0]) == {"query", "name", "price", "unit_price", "in_stock", "source"}


def test_haversine_and_time_ago():
    assert haversine_miles(43.0, -89.0, 43.0, -89.0) == 0
    assert 0.9 < haversine_miles(43.0731, -89.4012, 43.0731, -89.4012 + 0.0197) < 1.1
    assert time_ago(None, NOW) is None
    assert time_ago(datetime(2026, 11, 14, 21, 56, tzinfo=timezone.utc), NOW) == "4 mins ago"
