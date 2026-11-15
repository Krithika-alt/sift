# Where Sift's data comes from

Collected Nov 14, 2026 during MadHacks. Every price row has a `source` label, and the raw CSVs keep a link and a note for each price.

| Store | Source | How |
|---|---|---|
| Target (610 State St) | `website` | target.com with the Madison State Street store selected |
| Trader Joe's (1810 Monroe St) | `website` | traderjoes.com with the Madison store selected |
| Fresh Madison Market (703 University Ave) | `website` | shop.freshmadisonmarket.com (the store says online prices match in-store prices) |
| Pick 'n Save (1312 S Park St) | `api` | Kroger Products API, location 53400183, via `kroger_prices.py` |

## Simulated prices (labeled on screen)

- 2% store-brand milk at Trader Joe's, Pick 'n Save and Fresh Madison Market (not listed online)
- Toilet paper at Trader Joe's: the other stores' average price per mega roll x 12

Simulated prices count toward basket rankings but are never used for "you'll save $X" swap claims.

## Things a judge might ask about

- Trader Joe's eggs are pasture-raised and its chicken is organic, since those are the only versions listed online. That makes TJ's look pricier than a like-for-like comparison would.
- Package sizes differ between stores (TJ's oats are 18 oz vs 42 oz elsewhere; Fresh Madison rice is 1 lb, toilet paper 6 rolls). `unit_price` handles this.
- Bananas are sold by the pound at Pick 'n Save and Fresh Madison. Per-banana price = per-lb price x 0.4 lb, the store's own estimate.
- Trader Joe's doesn't sell Maruchan, so ramen is genuinely unavailable there, not missing data.
- A few prices were on sale when collected; notes in the CSVs say which.

## Files

- `raw/stores.csv` – 4 stores with lat/lon from Google Maps
- `raw/prices_real.csv`, `raw/prices_batch2.csv`, `raw/prices_batch3.csv` – website prices with links
- `raw/kroger_prices.csv` – Pick 'n Save prices from the API
- `kroger_prices.py` – pulls Pick 'n Save prices. Needs `KROGER_CLIENT_ID` and `KROGER_CLIENT_SECRET` as environment variables; never commit them.
