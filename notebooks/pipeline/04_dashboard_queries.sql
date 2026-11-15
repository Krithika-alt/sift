-- Sift: datasets behind the AI/BI dashboard "Sift: Madison Grocery Prices"

-- basket_by_store: demo basket total per store (cheapest version of each item)
WITH items AS (
  SELECT store_id, price,
    CASE WHEN product_id LIKE 'greek_yogurt%' THEN 'yogurt'
         WHEN product_id LIKE 'milk%' THEN 'milk'
         WHEN product_id LIKE 'pb_%' THEN 'peanut butter'
         ELSE product_id END AS item
  FROM sift.main.latest_prices
),
cheapest AS (SELECT store_id, item, MIN(price) AS price FROM items GROUP BY store_id, item)
SELECT s.name AS store, ROUND(SUM(c.price), 2) AS basket_total
FROM cheapest c JOIN sift.main.stores s ON c.store_id = s.store_id
WHERE c.item IN ('eggs_large_12', 'oats_rolled', 'yogurt', 'chicken_breast_lb', 'bananas_each')
GROUP BY s.name
ORDER BY basket_total;

-- price_sources: real vs simulated share
SELECT CASE source
         WHEN 'website' THEN 'Real: store website'
         WHEN 'api' THEN 'Real: Kroger API'
         WHEN 'crowd' THEN 'Crowd report'
         ELSE 'Simulated' END AS source_label,
       COUNT(*) AS prices
FROM sift.main.latest_prices
GROUP BY 1;

-- brand_savings: name brand minus store brand at the same store (real prices only)
SELECT s.name AS store,
       CASE WHEN p.product_id LIKE 'milk%' THEN 'Milk (1 gal)'
            WHEN p.product_id LIKE 'pb_%' THEN 'Peanut butter (16 oz)'
            ELSE 'Greek yogurt (32 oz)' END AS item,
       ROUND(MAX(CASE WHEN p.brand_tier = 'name' THEN lp.price END)
           - MAX(CASE WHEN p.brand_tier = 'store' THEN lp.price END), 2) AS savings
FROM sift.main.latest_prices lp
JOIN sift.main.products p ON lp.product_id = p.product_id
JOIN sift.main.stores s ON lp.store_id = s.store_id
WHERE (p.product_id LIKE 'milk%' OR p.product_id LIKE 'pb_%' OR p.product_id LIKE 'greek_yogurt%')
  AND lp.source <> 'simulated'
GROUP BY 1, 2
HAVING savings IS NOT NULL;

-- live_pings: newest crowd reports
SELECT pp.reported_at, s.name AS store, pr.name AS product, pp.price, pp.in_stock
FROM sift.main.price_pings pp
JOIN sift.main.stores s ON pp.store_id = s.store_id
JOIN sift.main.products pr ON pp.product_id = pr.product_id
ORDER BY pp.reported_at DESC
LIMIT 20;
