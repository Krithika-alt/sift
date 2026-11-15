-- Sift: table setup (Databricks Free Edition, Unity Catalog)
-- Run once. Creates the catalog, schema, raw volume, tables and the latest_prices view.

CREATE CATALOG IF NOT EXISTS sift;
CREATE SCHEMA IF NOT EXISTS sift.main;
CREATE VOLUME IF NOT EXISTS sift.main.raw;   -- raw CSVs are uploaded here

CREATE TABLE IF NOT EXISTS sift.main.stores (
  store_id STRING, name STRING, address STRING, lat DOUBLE, lon DOUBLE
);

CREATE TABLE IF NOT EXISTS sift.main.products (
  product_id STRING, name STRING, search_terms STRING, category STRING,
  size_value DOUBLE, size_unit STRING, dietary_tags STRING,
  brand_tier STRING   -- 'store', 'name' or 'generic'; pairs store vs name brand for swaps
);

CREATE TABLE IF NOT EXISTS sift.main.prices (
  store_id STRING, product_id STRING, price DOUBLE, unit_price DOUBLE,
  unit STRING, in_stock BOOLEAN,
  source STRING,          -- 'website' | 'api' | 'simulated'
  observed_at TIMESTAMP
);

-- live "snitch a price" reports written by the backend
CREATE TABLE IF NOT EXISTS sift.main.price_pings (
  ping_id STRING, store_id STRING, product_id STRING,
  price DOUBLE, in_stock BOOLEAN, reported_at TIMESTAMP
);

-- Gold view the backend, Genie and the dashboard read.
-- Newest stored price per store x product; a newer ping overrides it and is labeled 'crowd'.
CREATE OR REPLACE VIEW sift.main.latest_prices AS
WITH b AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY store_id, product_id ORDER BY observed_at DESC) AS rn
  FROM sift.main.prices
),
p AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY store_id, product_id ORDER BY reported_at DESC) AS rn
  FROM sift.main.price_pings
)
SELECT
  b.store_id,
  b.product_id,
  CASE WHEN p.reported_at > b.observed_at THEN p.price ELSE b.price END AS price,
  CASE WHEN p.reported_at > b.observed_at THEN p.price * b.unit_price / b.price ELSE b.unit_price END AS unit_price,
  b.unit,
  CASE WHEN p.reported_at > b.observed_at THEN p.in_stock ELSE b.in_stock END AS in_stock,
  CASE WHEN p.reported_at > b.observed_at THEN 'crowd' ELSE b.source END AS source,
  GREATEST(b.observed_at, COALESCE(p.reported_at, b.observed_at)) AS observed_at
FROM b
LEFT JOIN p ON b.store_id = p.store_id AND b.product_id = p.product_id AND p.rn = 1
WHERE b.rn = 1;
