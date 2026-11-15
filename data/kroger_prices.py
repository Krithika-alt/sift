"""
Pull real Pick 'n Save (Kroger) prices for Sift's products and write kroger_prices.csv.

Usage:
  export KROGER_CLIENT_ID=...
  export KROGER_CLIENT_SECRET=...
  python3 kroger_prices.py

Uses only the Python standard library, so there's nothing to install.
Never commit your client ID/secret. Keep them in your shell or a .env file that's in .gitignore.
"""

import base64
import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime

BASE = "https://api.kroger.com/v1"
ZIP = "53715"
STORE_HINT = "park"          # we want the Park St store
STORE_ID = "pick_n_save_park"

# (sift product_id, search term, expected unit, expected size, words that disqualify a result)
PRODUCTS = [
    ("eggs_large_12",          "kroger grade a large white eggs",   "ct",  12, ["extra large", "organic", "cage free", "jumbo"]),
    ("oats_rolled",            "old fashioned oats 42 oz",          "oz",  42, []),
    ("greek_yogurt_32oz",      "kroger plain nonfat greek yogurt",  "oz",  32, []),
    ("greek_yogurt_32oz_name", "chobani plain nonfat greek yogurt", "oz",  32, []),
    ("chicken_breast_lb",      "boneless skinless chicken breast",  "lb",  1,  ["organic", "tenderloin", "thin"]),
    ("milk_2pct_gal",          "kroger 2% reduced fat milk",        "gal", 1,  ["lactose", "chocolate", "organic", "1%", "skim", "whole"]),
    ("milk_2pct_gal_name",     "kemps 2% milk gallon",              "gal", 1,  ["lactose", "chocolate", "1%", "skim", "whole"]),
    ("pb_creamy_16oz",         "kroger creamy peanut butter",       "oz",  16, ["honey", "natural", "no sugar"]),
    ("pb_creamy_16oz_name",    "jif creamy peanut butter",          "oz",  16, ["natural", "reduced fat", "to go"]),
    ("bananas_each",           "fresh bananas",                     "ct",  1,  ["organic", "baby", "plantain", "pepper", "smoothie", "mix"]),
    ("bread_white_20oz",       "kroger white bread",                "oz",  20, ["wheat", "whole", "bun", "sourdough", "italian", "texas"]),
    ("rice_white_2lb",         "kroger long grain white rice",      "lb",  2,  ["instant", "brown", "jasmine", "basmati", "boil", "minute"]),
    ("pasta_spaghetti_16oz",   "kroger spaghetti",                  "oz",  16, ["thin", "angel", "whole", "gluten", "sauce"]),
    ("ramen_3oz",              "maruchan chicken ramen",            "oz",  3,  ["cup", "bowl"]),
    ("toilet_paper_12",        "kroger toilet paper",               "ct",  12, ["wipes", "flushable"]),
]

LB_PER_BANANA = 0.4  # bananas are sold by the pound; convert to a per-banana price


def http(method, url, headers=None, body=None):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} from {url}\n{e.read().decode()[:500]}")
        sys.exit(1)


def get_token(client_id, client_secret):
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    body = urllib.parse.urlencode({"grant_type": "client_credentials", "scope": "product.compact"}).encode()
    data = http("POST", f"{BASE}/connect/oauth2/token",
                {"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"}, body)
    return data["access_token"]


def find_location(token):
    q = urllib.parse.urlencode({"filter.zipCode.near": ZIP, "filter.limit": 10})
    data = http("GET", f"{BASE}/locations?{q}", {"Authorization": f"Bearer {token}", "Accept": "application/json"})
    print("Nearby Kroger-family stores:")
    chosen = None
    for loc in data.get("data", []):
        addr = loc.get("address", {}).get("addressLine1", "")
        print(f"  {loc['locationId']}  {loc.get('name', '')}  {addr}")
        if chosen is None and STORE_HINT in addr.lower():
            chosen = loc
    if not chosen:
        print(f"Couldn't find a store with '{STORE_HINT}' in the address. Edit STORE_HINT and rerun.")
        sys.exit(1)
    print(f"\nUsing: {chosen['locationId']} {chosen.get('name', '')} {chosen['address']['addressLine1']}\n")
    return chosen["locationId"]


def parse_size(size_str):
    """'42 oz' -> (42.0, 'oz'); '1 gal' -> (1.0, 'gal'); '12 ct' -> (12.0, 'ct'). Returns (None, None) if unclear."""
    if not size_str:
        return None, None
    s = size_str.lower().replace("fl oz", "floz").replace("1/2", "0.5")
    s = re.sub(r"(\d)\s+(mega|double|family|regular|triple|super)\s+(rolls?)", r"\1 \3", s)
    m = re.search(r"([\d.]+)\s*(oz|floz|ct|count|gal|lb|lbs|each|ea|dozen|dz|rolls|roll|rl)\b", s)
    if not m:
        return None, None
    val, unit = float(m.group(1)), m.group(2)
    unit = {"count": "ct", "each": "ct", "ea": "ct", "lbs": "lb", "floz": "oz",
            "rolls": "ct", "roll": "ct", "rl": "ct"}.get(unit, unit)
    if unit in ("dozen", "dz"):
        return val * 12, "ct"
    return val, unit


def search(token, location_id, term):
    q = urllib.parse.urlencode({"filter.term": term, "filter.locationId": location_id, "filter.limit": 10})
    data = http("GET", f"{BASE}/products?{q}", {"Authorization": f"Bearer {token}", "Accept": "application/json"})
    return data.get("data", [])


def main():
    cid, secret = os.environ.get("KROGER_CLIENT_ID"), os.environ.get("KROGER_CLIENT_SECRET")
    if not cid or not secret:
        print("Set KROGER_CLIENT_ID and KROGER_CLIENT_SECRET first.")
        sys.exit(1)

    token = get_token(cid, secret)
    location_id = find_location(token)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rows = []

    for pid, term, want_unit, want_size, exclude in PRODUCTS:
        print(f"== {pid}  (search: '{term}', want {want_size} {want_unit})")
        picked = None
        for p in search(token, location_id, term):
            desc = p.get("description", "").lower()
            if any(word in desc for word in exclude):
                continue
            for item in p.get("items", []):
                price = item.get("price") or {}
                regular, promo = price.get("regular") or 0, price.get("promo") or 0
                shelf = promo if promo else regular
                size_val, size_unit = parse_size(item.get("size", ""))
                sold_by = (item.get("soldBy") or "").upper()
                print(f"   {p.get('description', '')[:60]:60}  size={item.get('size', '')!r:12}  "
                      f"regular={regular}  promo={promo}  soldBy={sold_by}")
                if picked or not shelf:
                    continue
                # bananas: sold per lb, convert to a per-banana price
                if pid == "bananas_each" and sold_by == "WEIGHT" and "banana" in desc:
                    picked = (round(shelf * LB_PER_BANANA, 2), 1, "ct", p, promo)
                # chicken is sold by weight: price is per lb
                elif want_unit == "lb" and sold_by == "WEIGHT":
                    picked = (shelf, 1, "lb", p, promo)
                elif size_unit == want_unit and size_val and abs(size_val - want_size) / want_size < 0.15:
                    picked = (shelf, size_val, size_unit, p, promo)
        if not picked:
            print("   -> no confident match, skipped (stays simulated)\n")
            continue
        shelf, size_val, size_unit, p, promo = picked
        note = p.get("description", "") + (" (promo price)" if promo else "")
        if pid == "bananas_each":
            note += f" (per-lb price x {LB_PER_BANANA} lb per banana)"
        print(f"   -> PICKED ${shelf} for {size_val} {size_unit}: {note}\n")
        rows.append({
            "store_id": STORE_ID, "product_id": pid, "price": shelf,
            "size_value": size_val, "size_unit": size_unit, "in_stock": "true",
            "source": "api", "observed_at": now,
            "source_url": f"https://www.picknsave.com/p/{p.get('productId', '')}",
            "notes": note.replace(",", " "),
        })

    with open("kroger_prices.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["store_id", "product_id", "price", "size_value", "size_unit",
                                          "in_stock", "source", "observed_at", "source_url", "notes"])
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to kroger_prices.csv. Check the PICKED lines above before uploading.")


if __name__ == "__main__":
    main()
