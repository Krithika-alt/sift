from datetime import datetime, timezone

from fastapi.testclient import TestClient

import main
from scoring import rank_stores

NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)
STORES = [{"store_id": "a", "name": "A", "lat": 43.07, "lon": -89.4},
          {"store_id": "b", "name": "B", "lat": 43.07, "lon": -89.4}]
PRODS = {"m": {"name": "Milk"}, "e": {"name": "Eggs"}}


def _rows(pm_a, pm_b, pe_a, pe_b):
    base = {"unit_price": 1.0, "unit": "ct", "in_stock": True, "source": "website", "observed_at": NOW}
    return [dict(base, store_id="a", product_id="m", price=pm_a), dict(base, store_id="b", product_id="m", price=pm_b),
            dict(base, store_id="a", product_id="e", price=pe_a), dict(base, store_id="b", product_id="e", price=pe_b)]


def _rank(quantities=None):
    return rank_stores({"lat": 43.07, "lon": -89.4}, [("milk", "m"), ("eggs", "e")], {"price": 1, "distance": 0, "preference": 0},
                       None, _rows(4.0, 3.0, 1.0, 2.0), STORES, PRODS, NOW, quantities=quantities)


def test_default_is_one_each_and_has_quantity_fields():
    r = {s["store_id"]: s for s in _rank()}
    assert r["a"]["total_basket_price"] == 5.0 and r["b"]["total_basket_price"] == 5.0
    line = r["a"]["items_breakdown"][0]
    assert line["quantity"] == 1 and line["line_total"] == line["price"]


def test_quantities_change_totals_and_the_winner():
    r = {s["store_id"]: s for s in _rank({"m": 3})}   # 3 milks: A 12+1=13, B 9+2=11
    assert r["a"]["total_basket_price"] == 13.0 and r["b"]["total_basket_price"] == 11.0
    assert _rank({"m": 3})[0]["store_id"] == "b"
    milk = next(i for i in r["a"]["items_breakdown"] if i["name"] == "Milk")
    assert milk["quantity"] == 3 and milk["line_total"] == 12.0 and milk["price"] == 4.0


def test_missing_item_counts_at_highest_price_times_quantity():
    rows = [x for x in _rows(4.0, 3.0, 1.0, 2.0) if not (x["store_id"] == "b" and x["product_id"] == "m")]
    out = rank_stores({"lat": 43.07, "lon": -89.4}, [("milk", "m")], None, None, rows, STORES, PRODS, NOW,
                      quantities={"m": 2})
    b = next(s for s in out if s["store_id"] == "b")
    assert b["total_basket_price"] == 8.0 and b["missing_items"] == ["milk"]


def test_api_accepts_strings_and_objects():
    c = TestClient(main.app)
    loc = {"lat": 43.0731, "lon": -89.4012}
    one = c.post("/api/rank-stores", json={"user_location": loc, "items": ["milk", "eggs"]}).json()
    two = c.post("/api/rank-stores", json={"user_location": loc, "items": [{"text": "milk", "quantity": 2}, "eggs"]}).json()
    t1 = {s["store_id"]: s["total_basket_price"] for s in one["ranked_stores"]}
    t2 = {s["store_id"]: s["total_basket_price"] for s in two["ranked_stores"]}
    assert all(t2[k] > t1[k] for k in t1)
    line = two["ranked_stores"][0]["items_breakdown"]
    assert any(i["quantity"] == 2 for i in line)


def test_api_rejects_bad_quantity():
    r = TestClient(main.app).post("/api/rank-stores", json={
        "user_location": {"lat": 43.0, "lon": -89.4}, "items": [{"text": "milk", "quantity": 0}]})
    assert r.status_code == 422
