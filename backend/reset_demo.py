#!/usr/bin/env python3
"""Reset Sift to a clean starting state before a demo or rehearsal.

Run from the backend folder (venv active):

    python reset_demo.py          # asks you to confirm before deleting
    python reset_demo.py --yes    # no question asked

What it does:
  1. connects to Databricks (this also wakes the SQL warehouse)
  2. deletes every row in sift.main.price_pings (the "snitched" prices)
  3. checks that no crowd price is left showing in latest_prices
  4. shows the starting state of the hero demo: who is #1 by default, who is #1
     when the distance slider goes up, and how much of the data is real

Only price_pings is touched. Stores, products and prices are never changed.
Run it before every rehearsal and right before the judging.
"""
from __future__ import annotations

import argparse
import sys

from dotenv import load_dotenv

load_dotenv()

from check_tables import DEMO_BASKET, DEMO_USER  # noqa: E402
from databricks_source import DatabricksData  # noqa: E402
from matching import match_items  # noqa: E402
from scoring import rank_stores  # noqa: E402

DISTANCE_HEAVY = {"price": 0.2, "distance": 0.8, "preference": 0.0}


def _count_pings(db) -> int:
    rows = db._query(f"SELECT COUNT(*) AS n FROM {db._t('price_pings')}")
    return int(rows[0]["n"]) if rows else 0


def run_reset(db, assume_yes: bool = False, ask=input) -> int:
    """Returns 0 on success, 1 on failure or if you decline."""
    print("1. Connecting (the warehouse can take up to a minute to wake up)...")
    try:
        n = _count_pings(db)
    except Exception as e:  # noqa: BLE001
        print(f"   FAIL  could not read price_pings: {str(e).splitlines()[0][:200]}")
        return 1
    print(f"   price_pings currently has {n} row(s)")

    print("\n2. Clearing price_pings")
    if n == 0:
        print("   nothing to delete")
    else:
        if not assume_yes:
            try:
                answer = ask(f"   Delete all {n} ping(s)? Type YES to continue: ").strip()
            except EOFError:
                answer = ""
            if answer != "YES":
                print("   Cancelled. Nothing was deleted.")
                return 1
        try:
            db._query(f"DELETE FROM {db._t('price_pings')}")
            left = _count_pings(db)
        except Exception as e:  # noqa: BLE001
            print(f"   FAIL  delete failed: {str(e).splitlines()[0][:200]}")
            return 1
        if left:
            print(f"   FAIL  {left} row(s) are still there")
            return 1
        print(f"   PASS  deleted {n} ping(s); price_pings is empty")

    print("\n3. Checking latest_prices")
    stores, products, prices = db.stores(), db.products(), db.latest_prices()
    crowd = [p for p in prices if p.get("source") == "crowd"]
    if crowd:
        print(f"   WARN  {len(crowd)} row(s) in latest_prices still say source='crowd' "
              "(the view may be reading something other than price_pings)")
    else:
        print("   PASS  no crowd prices showing; every price is back to its stored value")

    print("\n4. Starting state of the hero demo")
    matched = match_items(DEMO_BASKET, products)
    missing = [q for q, pid in matched if pid is None]
    if missing or not stores or not prices:
        print(f"   WARN  cannot rank the demo basket (unmatched: {missing or 'none'}, "
              f"{len(stores)} stores, {len(prices)} prices)")
        return 0
    prod_map = {p["product_id"]: p for p in products}
    start = rank_stores(DEMO_USER, matched, None, 20, prices, stores, prod_map)
    far = rank_stores(DEMO_USER, matched, DISTANCE_HEAVY, 20, prices, stores, prod_map)
    print(f"   Default weights      -> #1 {start[0]['name']} (${start[0]['total_basket_price']:.2f}), "
          f"#2 {start[1]['name'] if len(start) > 1 else '-'}")
    print(f"   Distance slider up   -> #1 {far[0]['name']}")
    if start[0]["store_id"] == far[0]["store_id"]:
        print("   WARN  the distance slider does not change the winner for this basket and location")
    real = sum(1 for p in prices if p.get("source") in ("website", "api"))
    pct = 100 * real / len(prices)
    print(f"   Data: {pct:.0f}% real prices, {100 - pct:.0f}% simulated or crowd")
    if real == 0:
        print("   WARN  every price is still simulated: say so out loud in the demo")
    print("\nReady. Report a price at any store to start the demo.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Clear price_pings and show the demo's starting state")
    ap.add_argument("--yes", action="store_true", help="do not ask for confirmation")
    args = ap.parse_args()
    try:
        db = DatabricksData(warm=False)
    except RuntimeError as e:
        print(f"FAIL  {e}")
        return 1
    return run_reset(db, assume_yes=args.yes)


if __name__ == "__main__":
    sys.exit(main())
