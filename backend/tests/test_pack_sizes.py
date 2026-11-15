from datetime import datetime, timezone

from scoring import rank_stores

NOW = datetime(2026, 11, 15, tzinfo=timezone.utc)
STORES = [{"store_id": "a", "name": "A", "lat": 43.07, "lon": -89.4},
          {"store_id": "b", "name": "B", "lat": 43.07, "lon": -89.4}]
PRODUCTS = {"rice": {"name": "White rice, 2 lb", "size_value": 2.0, "size_unit": "lb"}}


def row(store, price, unit_price):
    return {"store_id": store, "product_id": "rice", "price": price, "unit_price": unit_price,
            "unit": "lb", "in_stock": True, "source": "website", "observed_at": NOW}


def test_smaller_pack_is_not_treated_as_cheaper():
    # A: 2 lb for $3.00 ($1.50/lb). B: 1 lb for $2.00 ($2.00/lb) -> B is really pricier.
    prices = [row("a", 3.00, 1.50), row("b", 2.00, 2.00)]
    out = rank_stores({"lat": 43.07, "lon": -89.4}, [("rice", "rice")], None, None, prices, STORES, PRODUCTS, now=NOW)
    by = {r["store_id"]: r for r in out}
    line_b = by["b"]["items_breakdown"][0]
    assert line_b["price"] == 4.0 and line_b["shelf_price"] == 2.0 and by["b"]["total_basket_price"] == 4.0 and "pack_note" in line_b
    assert "shelf_price" not in by["a"]["items_breakdown"][0]
    assert out[0]["store_id"] == "a"


def test_same_pack_unchanged():
    prices = [row("a", 3.00, 1.50), row("b", 3.50, 1.75)]
    out = rank_stores({"lat": 43.07, "lon": -89.4}, [("rice", "rice")], None, None, prices, STORES, PRODUCTS, now=NOW)
    assert [l["items_breakdown"][0]["price"] for l in sorted(out, key=lambda r: r["store_id"])] == [3.0, 3.5]


def test_assistant_cheapest_uses_standard_pack():
    from assistant import price_answer
    stores = [{"store_id": "a", "name": "Alpha"}, {"store_id": "b", "name": "Beta"}]
    prods = [{"product_id": "rice", "name": "White rice, 2 lb", "size_value": 2.0, "size_unit": "lb"}]
    data = {"stores": stores, "products": prods,
            "prices": [row("a", 3.00, 1.50), row("b", 1.60, 1.60)]}
    out = price_answer("Which store has the cheapest White rice, 2 lb?", data)
    assert "is $3.00 at Alpha" in out["answer"]
    assert "Beta $3.20" in out["answer"] and "shelf $1.60 for a 1 lb pack" in out["answer"]
