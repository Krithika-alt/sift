-- Sift: load prices. Real prices are labeled 'website' or 'api'; estimates are 'simulated'.
-- unit_price = shelf price / actual package size at that store.
-- latest_prices keeps the newest row per store x product, so later loads replace earlier ones.

-- Real prices from store websites (Target, Trader Joe's, Fresh Madison Market online store)
INSERT INTO sift.main.prices
SELECT store_id, product_id, CAST(price AS DOUBLE),
       CAST(price AS DOUBLE) / CAST(size_value AS DOUBLE),
       size_unit, CAST(in_stock AS BOOLEAN), source, CAST(observed_at AS TIMESTAMP)
FROM read_files('/Volumes/sift/main/raw/prices_real.csv', format => 'csv', header => true);

INSERT INTO sift.main.prices
SELECT store_id, product_id, CAST(price AS DOUBLE),
       CAST(price AS DOUBLE) / CAST(size_value AS DOUBLE),
       size_unit, CAST(in_stock AS BOOLEAN), source, CAST(observed_at AS TIMESTAMP)
FROM read_files('/Volumes/sift/main/raw/prices_batch2.csv', format => 'csv', header => true);

INSERT INTO sift.main.prices
SELECT store_id, product_id, CAST(price AS DOUBLE),
       CAST(price AS DOUBLE) / CAST(size_value AS DOUBLE),
       size_unit, CAST(in_stock AS BOOLEAN), source, CAST(observed_at AS TIMESTAMP)
FROM read_files('/Volumes/sift/main/raw/prices_batch3.csv', format => 'csv', header => true);

-- Real Pick 'n Save prices from the Kroger Products API (data/kroger_prices.py -> kroger_prices.csv)
INSERT INTO sift.main.prices
SELECT store_id, product_id, CAST(price AS DOUBLE),
       CAST(price AS DOUBLE) / CAST(size_value AS DOUBLE),
       size_unit, CAST(in_stock AS BOOLEAN), source, CAST(observed_at AS TIMESTAMP)
FROM read_files('/Volumes/sift/main/raw/kroger_prices.csv', format => 'csv', header => true);

-- Manual corrections from the same sources
INSERT INTO sift.main.prices VALUES
  -- traderjoes.com: pasture-raised large eggs (only eggs listed online), oats 18 oz
  ('trader_joes_monroe', 'eggs_large_12',   5.99,  5.99 / 12,  'ct', true, 'website', TIMESTAMP '2026-11-14 18:00:00'),
  ('trader_joes_monroe', 'oats_rolled',     2.99,  2.99 / 18,  'oz', true, 'website', TIMESTAMP '2026-11-14 18:00:00'),
  -- Kroger API: rice listed as 32 oz (= 2 lb); 12 mega rolls to match other stores' mega rolls
  ('pick_n_save_park',   'rice_white_2lb',  1.89,  1.89 / 2,   'lb', true, 'api',     TIMESTAMP '2026-11-14 22:45:00'),
  ('pick_n_save_park',   'toilet_paper_12', 13.49, 13.49 / 12, 'ct', true, 'api',     TIMESTAMP '2026-11-14 22:45:00');

-- Simulated estimates (labeled on screen). Not used for swap-savings claims.
INSERT INTO sift.main.prices VALUES
  ('trader_joes_monroe',   'milk_2pct_gal',   3.99,  3.99,       'gal', true, 'simulated', TIMESTAMP '2026-11-14 00:00:00'),
  ('pick_n_save_park',     'milk_2pct_gal',   3.69,  3.69,       'gal', true, 'simulated', TIMESTAMP '2026-11-14 00:00:00'),
  ('fresh_madison_market', 'milk_2pct_gal',   3.99,  3.99,       'gal', true, 'simulated', TIMESTAMP '2026-11-14 00:00:00'),
  -- TJ's toilet paper: average per-mega-roll price of the other 3 stores (~$1.13) x 12
  ('trader_joes_monroe',   'toilet_paper_12', 13.59, 13.59 / 12, 'ct',  true, 'simulated', TIMESTAMP '2026-11-14 00:00:00');

-- Check: where each price comes from
SELECT source, COUNT(*) FROM sift.main.latest_prices GROUP BY source;
