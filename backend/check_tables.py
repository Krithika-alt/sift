#!/usr/bin/env python3
"""Check that the Databricks tables are ready for the Sift backend.

Run from the backend folder (venv active):

    python check_tables.py              # full check, including a test price report
    python check_tables.py --no-write   # read-only (skips the test price report)

It prints PASS / WARN / FAIL for each check and exits with code 1 if anything
FAILed. The test price report writes one row to price_pings, checks that the
latest_prices view shows it with source='crowd', then deletes that row.
It never prints your token.
"""
from __future__ import annotations

import argparse
import sys
import time

from dotenv import load_dotenv

load_dotenv()

from databricks_source import DatabricksData  # noqa: E402
from matching import match_items  # noqa: E402
from scoring import rank_stores  # noqa: E402

REQUIRED_COLUMNS = {
    "stores": {"store_id", "name", "address", "lat", "lon"},
    "products": {"product_id", "name", "search_terms", "category", "size_value",
                 "size_unit", "dietary_tags"},
    "prices": {"store_id", "product_id", "price", "unit_price", "unit", "in_stock",
               "source", "observed_at"},
    "price_pings": {"ping_id", "store_id", "product_id", "price", "in_stock", "reported_at"},
    "latest_prices": {"store_id", "product_id", "price", "unit_price", "in_stock",
                      "source", "observed_at"},
}
ALLOWED_SOURCES = {"website", "api", "simulated", "crowd"}
DEMO_BASKET = ["eggs", "oats", "greek yogurt", "chicken breast", "bananas"]
DEMO_USER = {"lat": 43.0731, "lon": -89.4012}  # near Grainger Hall


class Report:
    def __init__(self) -> None:
        self.counts = {"PASS": 0, "WARN": 0, "FAIL": 0}

    def _say(self, level: str, msg: str) -> None:
        self.counts[level] += 1
        print(f"  {level:<4}  {msg}")

    def ok(self, msg): self._say("PASS", msg)
    def warn(self, msg): self._say("WARN", msg)
    def fail(self, msg): self._say("FAIL", msg)

    @property
    def failed(self) -> bool:
        return self.counts["FAIL"] > 0


def _table_columns(db, table: str) -> list[str]:
    rows = db._query(f"DESCRIBE TABLE {db._t(table)}")
    cols = []
    for r in rows:
        name = (r.get("col_name") or "").strip()
        if not name or name.startswith("#"):
            break  # end of the column list (partition info follows)
        cols.append(name.lower())
    return cols


def _count(db, statement: str) -> int:
    rows = db._query(statement)
    return int(rows[0]["n"]) if rows else 0


def run_checks(db, write_test: bool = True) -> Report:
    rep = Report()
    t = db._t

    print("\n1. Connection")
    start = time.time()
    try:
        db._query("SELECT 1")
        rep.ok(f"connected to {db.host} in {time.time() - start:.1f}s")
    except Exception as e:  # noqa: BLE001
        rep.fail(f"could not connect: {str(e).splitlines()[0][:200]}")
        rep.fail("check DATABRICKS_HOST, DATABRICKS_HTTP_PATH and DATABRICKS_TOKEN in backend/.env")
        return rep

    print("\n2. Tables, columns and row counts")
    counts: dict[str, int] = {}
    for table, required in REQUIRED_COLUMNS.items():
        try:
            cols = set(_table_columns(db, table))
        except Exception as e:  # noqa: BLE001
            rep.fail(f"{table}: not found in {db.catalog}.{db.schema} ({str(e).splitlines()[0][:120]})")
            continue
        missing = required - cols
        if missing:
            rep.fail(f"{table}: missing columns {sorted(missing)} (found {sorted(cols)})")
            continue
        n = _count(db, f"SELECT COUNT(*) AS n FROM {t(table)}")
        counts[table] = n
        if n == 0 and table == "price_pings":
            rep.ok(f"{table}: columns OK, empty (fine, pings arrive during the demo)")
        elif n == 0:
            rep.warn(f"{table}: columns OK but EMPTY (waiting for data)")
        else:
            rep.ok(f"{table}: columns OK, {n} rows")

    if counts.get("prices", 0) > 0 and counts.get("latest_prices", 0) == 0:
        rep.fail("latest_prices returns no rows even though prices has data (check the view)")

    print("\n3. Data sanity")
    if counts.get("stores", 0) > 0:
        bad = _count(db, f"SELECT COUNT(*) AS n FROM {t('stores')} WHERE lat IS NULL OR lon IS NULL "
                         "OR lat NOT BETWEEN 42.9 AND 43.3 OR lon NOT BETWEEN -89.7 AND -89.1")
        (rep.fail if bad else rep.ok)(
            f"stores: {bad} with missing or non-Madison lat/lon" if bad else "stores: all lat/lon look like Madison")
    if counts.get("prices", 0) > 0:
        bad = _count(db, f"SELECT COUNT(*) AS n FROM {t('prices')} "
                         "WHERE price IS NULL OR price <= 0 OR unit_price IS NULL")
        (rep.fail if bad else rep.ok)(
            f"prices: {bad} rows with missing/zero price or unit_price" if bad
            else "prices: every row has a price and a unit_price")
        by_source = {r["source"]: int(r["n"]) for r in db._query(
            f"SELECT source, COUNT(*) AS n FROM {t('prices')} GROUP BY source")}
        odd = set(by_source) - ALLOWED_SOURCES
        if odd:
            rep.fail(f"prices: unexpected source values {sorted(odd, key=str)} "
                     f"(allowed: {sorted(ALLOWED_SOURCES)})")
        else:
            rep.ok("prices: source labels " + ", ".join(f"{k}={v}" for k, v in sorted(by_source.items())))
        if not (by_source.get("website", 0) + by_source.get("api", 0)):
            rep.warn("prices: no real (website/api) prices yet; everything is simulated")
    if counts.get("latest_prices", 0) > 0:
        for dim, parent, key in (("stores", "stores", "store_id"), ("products", "products", "product_id")):
            orphans = _count(db, f"SELECT COUNT(*) AS n FROM {t('latest_prices')} l "
                                 f"LEFT ANTI JOIN {t(parent)} p ON l.{key} = p.{key}")
            (rep.fail if orphans else rep.ok)(
                f"latest_prices: {orphans} rows point to a {key} that is not in {dim}" if orphans
                else f"latest_prices: every {key} exists in {dim}")

    if min(counts.get("stores", 0), counts.get("products", 0), counts.get("latest_prices", 0)) == 0:
        print("\n(Stopping here: stores, products and latest_prices need data for the demo checks.)")
        return rep

    print("\n4. Demo basket (eggs, oats, greek yogurt, chicken breast, bananas)")
    products, stores, prices = db.products(), db.stores(), db.latest_prices()
    matched = match_items(DEMO_BASKET, products)
    unmatched = [q for q, pid in matched if pid is None]
    if unmatched:
        rep.fail(f"no product matches for {unmatched} (check products.search_terms)")
    else:
        rep.ok("all 5 demo items match a product")
    pids = {pid for _, pid in matched if pid}
    full = [s["name"] for s in stores
            if pids and all(any(p["store_id"] == s["store_id"] and p["product_id"] == pid and p["in_stock"]
                                for p in prices) for pid in pids)]
    if len(full) >= 3:
        rep.ok(f"{len(full)} stores carry the whole basket: {', '.join(full)}")
    else:
        rep.warn(f"only {len(full)} store(s) carry the whole basket (plan wants 3-4)")
    ranked = rank_stores(DEMO_USER, matched, None, 20, prices, stores,
                         {p["product_id"]: p for p in products})
    rep.ok("ranking runs. Top 3: " + "; ".join(
        f"{s['name']} ${s['total_basket_price']:.2f}" for s in ranked[:3]))

    if not write_test:
        print("\n5. Test price report: skipped (--no-write)")
        return rep

    print("\n5. Test price report (writes one row, then deletes it)")
    target = next(((s, pid) for s in stores for pid in sorted(pids)
                   if any(p["store_id"] == s["store_id"] and p["product_id"] == pid for p in prices)), None)
    if target is None:
        rep.fail("no store/product pair to test with")
        return rep
    store, pid = target
    before = next(p for p in prices if p["store_id"] == store["store_id"] and p["product_id"] == pid)
    test_price = round(max(before["price"] * 0.5, 0.01), 2)
    ping_id = None
    try:
        ping_id = db.add_ping(store["store_id"], pid, test_price, True)
        rep.ok(f"inserted test ping {ping_id} into price_pings")
        after = next((p for p in db.latest_prices()
                      if p["store_id"] == store["store_id"] and p["product_id"] == pid), None)
        if after is None:
            rep.fail("latest_prices lost the row after the ping")
        elif abs(after["price"] - test_price) > 0.005:
            rep.fail(f"latest_prices still shows ${after['price']:.2f}, not the ping's ${test_price:.2f}: "
                     "the view must let a newer ping override the stored price")
        else:
            rep.ok(f"latest_prices now shows the ping price ${test_price:.2f}")
            if after["source"] == "crowd":
                rep.ok("the ping row has source='crowd'")
            else:
                rep.warn(f"the ping row has source='{after['source']}', not 'crowd' "
                         "(the 'Crowd-checked' badge relies on 'crowd')")
    except Exception as e:  # noqa: BLE001
        rep.fail(f"test ping failed: {str(e).splitlines()[0][:200]}")
    finally:
        if ping_id:
            try:
                db._query(f"DELETE FROM {t('price_pings')} WHERE ping_id = :ping_id", {"ping_id": ping_id})
                back = next((p for p in db.latest_prices()
                             if p["store_id"] == store["store_id"] and p["product_id"] == pid), None)
                if back is not None and abs(back["price"] - before["price"]) < 0.005:
                    rep.ok("deleted the test ping; price is back to normal")
                else:
                    rep.warn(f"deleted the test ping but the price did not return to ${before['price']:.2f}")
            except Exception as e:  # noqa: BLE001
                rep.warn(f"could not delete test ping {ping_id}; remove it by hand "
                         f"({str(e).splitlines()[0][:120]})")
    return rep


def main() -> int:
    parser = argparse.ArgumentParser(description="Check the Databricks tables for Sift")
    parser.add_argument("--no-write", action="store_true", help="read-only: skip the test price report")
    args = parser.parse_args()
    try:
        db = DatabricksData(warm=False)
    except RuntimeError as e:
        print(f"\nFAIL  {e}")
        return 1
    print("Checking Databricks (the warehouse can take up to a minute to wake up)...")
    rep = run_checks(db, write_test=not args.no_write)
    c = rep.counts
    print(f"\nResult: {c['PASS']} passed, {c['WARN']} warnings, {c['FAIL']} failed")
    print("READY for the demo." if not rep.failed and not c["WARN"]
          else "Fix the FAILs above." if rep.failed else "Works, but read the WARNs above.")
    return 1 if rep.failed else 0


if __name__ == "__main__":
    sys.exit(main())
