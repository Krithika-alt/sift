"""Data access for the API.

MockData is an in-memory stand-in for the Databricks tables so the whole app
(and the hero demo loop) works before the real pipeline exists. Everything
here is SIMULATED and labeled source='simulated'. Store coordinates are
approximate; Role 2's Google-Maps-verified `stores` table replaces them.

Swap to Databricks later by writing a class with the same four methods
(stores, products, latest_prices, add_ping) and returning it from
get_data_source().
"""
from __future__ import annotations

import itertools
import os
import random
import threading
from datetime import datetime, timedelta, timezone

try:  # load backend/.env (Databricks settings); harmless if the file is absent
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

STORES = [
    {"store_id": "trader_joes_monroe", "name": "Trader Joe's (Monroe St)",
     "address": "1810 Monroe St, Madison, WI", "lat": 43.0652, "lon": -89.4176},
    {"store_id": "fresh_madison_market", "name": "Fresh Madison Market",
     "address": "2227 University Ave, Madison, WI", "lat": 43.0738, "lon": -89.4285},
    {"store_id": "capitol_centre_market", "name": "Capitol Centre Market",
     "address": "111 S Hamilton St, Madison, WI", "lat": 43.0735, "lon": -89.3838},
    {"store_id": "target_state_st", "name": "Target (State St)",
     "address": "State St, Madison, WI", "lat": 43.0752, "lon": -89.3885},
    {"store_id": "walgreens_state_st", "name": "Walgreens (State St)",
     "address": "State St, Madison, WI", "lat": 43.0748, "lon": -89.3870},
    {"store_id": "pick_n_save", "name": "Pick 'n Save",
     "address": "Madison, WI", "lat": 43.0700, "lon": -89.4190},
]

# product_id, name, search_terms, category, size_value, size_unit, base price
PRODUCTS = [
    ("eggs_large_12", "Large eggs, 12 ct", "eggs,egg,dozen eggs,large eggs", "protein", 12, "ct", 3.20),
    ("greek_yogurt_32", "Nonfat Greek yogurt, 32 oz", "greek yogurt,greek yoghurt,yogurt", "dairy", 32, "oz", 4.80),
    ("chicken_breast_lb", "Chicken breast, 1 lb", "chicken breast,chicken breasts,chicken", "protein", 1, "lb", 4.20),
    ("oats_42oz", "Old-fashioned oats, 42 oz", "oats,oatmeal,rolled oats", "grains", 42, "oz", 5.20),
    ("bananas_lb", "Bananas, 1 lb", "bananas,banana", "produce", 1, "lb", 0.62),
    ("milk_gal", "Whole milk, 1 gal", "milk,whole milk", "dairy", 128, "oz", 3.60),
    ("bread_20oz", "Sandwich bread, 20 oz", "bread,sandwich bread,loaf", "grains", 20, "oz", 2.90),
    ("rice_2lb", "White rice, 2 lb", "rice,white rice", "grains", 2, "lb", 2.80),
    ("peanut_butter_16", "Peanut butter, 16 oz", "peanut butter", "protein", 16, "oz", 3.10),
    ("pasta_16", "Spaghetti, 16 oz", "pasta,spaghetti,noodles", "grains", 16, "oz", 1.70),
    ("ramen_3oz", "Instant ramen, 3 oz", "ramen,instant ramen", "grains", 3, "oz", 0.65),
    ("toilet_paper_12", "Toilet paper, 12 rolls", "toilet paper,tp", "household", 12, "ct", 11.50),
]

# price level per store (1.0 = baseline) and items a store does not carry
STORE_LEVEL = {
    "trader_joes_monroe": 0.88,
    "fresh_madison_market": 1.00,
    "capitol_centre_market": 1.12,
    "target_state_st": 0.97,
    "walgreens_state_st": 1.22,
    "pick_n_save": 0.90,
}
NOT_CARRIED = {
    "walgreens_state_st": {"chicken_breast_lb", "rice_2lb"},
    "capitol_centre_market": {"toilet_paper_12"},
    "trader_joes_monroe": {"toilet_paper_12"},
}


def _unit_price(price: float, size_value: float) -> float:
    return price / size_value


class MockData:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ping_ids = itertools.count(1)
        self._pings: list[dict] = []
        self._products = [
            {"product_id": pid, "name": name, "search_terms": terms, "category": cat,
             "size_value": sv, "size_unit": su, "dietary_tags": ""}
            for pid, name, terms, cat, sv, su, _ in PRODUCTS
        ]
        self._by_id = {p["product_id"]: p for p in self._products}
        self._prices = self._build_prices()

    def _build_prices(self) -> list[dict]:
        rng = random.Random(2026)  # deterministic simulated prices
        base_time = datetime.now(timezone.utc) - timedelta(hours=6)
        rows = []
        for s in STORES:
            for pid, _, _, _, sv, su, base in PRODUCTS:
                if pid in NOT_CARRIED.get(s["store_id"], set()):
                    continue
                price = round(base * STORE_LEVEL[s["store_id"]] * rng.uniform(0.96, 1.04), 2)
                rows.append({
                    "store_id": s["store_id"], "product_id": pid, "price": price,
                    "unit_price": _unit_price(price, sv), "unit": su,
                    "in_stock": True, "source": "simulated", "observed_at": base_time,
                })
        return rows

    # --- interface used by the API ---
    def stores(self) -> list[dict]:
        return list(STORES)

    def products(self) -> list[dict]:
        return list(self._products)

    def latest_prices(self) -> list[dict]:
        """Stored prices, where a newer ping overrides (source='crowd')."""
        with self._lock:
            rows = {(r["store_id"], r["product_id"]): dict(r) for r in self._prices}
            for ping in sorted(self._pings, key=lambda p: p["reported_at"]):
                key = (ping["store_id"], ping["product_id"])
                base = rows.get(key)
                if base is None or ping["reported_at"] >= base["observed_at"]:
                    prod = self._by_id[ping["product_id"]]
                    rows[key] = {
                        "store_id": ping["store_id"], "product_id": ping["product_id"],
                        "price": ping["price"],
                        "unit_price": _unit_price(ping["price"], prod["size_value"]),
                        "unit": prod["size_unit"], "in_stock": ping["in_stock"],
                        "source": "crowd", "observed_at": ping["reported_at"],
                    }
            return list(rows.values())

    def add_ping(self, store_id: str, product_id: str, price: float, in_stock: bool) -> str:
        with self._lock:
            ping_id = f"p_{next(self._ping_ids)}"
            self._pings.append({
                "ping_id": ping_id, "store_id": store_id, "product_id": product_id,
                "price": price, "in_stock": in_stock,
                "reported_at": datetime.now(timezone.utc),
            })
            return ping_id

    def ping(self) -> bool:
        return True

    def reset_pings(self) -> None:
        with self._lock:
            self._pings.clear()


_instance = None


def get_data_source():
    """DATA_SOURCE=databricks uses the real tables; anything else uses fake data."""
    global _instance
    if _instance is None:
        if os.getenv("DATA_SOURCE", "mock").strip().lower() == "databricks":
            from databricks_source import DatabricksData
            _instance = DatabricksData()
        else:
            _instance = MockData()
    return _instance


if os.getenv("DATA_SOURCE", "mock").strip().lower() == "databricks":
    get_data_source()  # connect at startup so the SQL warehouse starts waking up
