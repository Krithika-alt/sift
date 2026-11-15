-- Sift: load stores (from CSV) and products (15 common student items)

-- Stores: data/raw/stores.csv uploaded to the raw volume.
-- Addresses from store sites/listings; lat/lon read off Google Maps.
INSERT OVERWRITE sift.main.stores
SELECT store_id, name, address, CAST(lat AS DOUBLE) AS lat, CAST(lon AS DOUBLE) AS lon
FROM read_files('/Volumes/sift/main/raw/stores.csv', format => 'csv', header => true);

-- Products. size_value/size_unit is a typical package; the real per-store size
-- is captured in prices.unit_price (price / actual package size).
INSERT OVERWRITE sift.main.products VALUES
  ('eggs_large_12',          'Large eggs, 12 ct',                           'eggs,egg,dozen eggs,large eggs',              'protein',   12, 'ct',  'vegetarian,gluten_free', 'store'),
  ('oats_rolled',            'Old fashioned rolled oats',                   'oats,oatmeal,rolled oats',                    'grains',    42, 'oz',  'vegan',                  'store'),
  ('greek_yogurt_32oz',      'Plain nonfat greek yogurt, 32 oz',            'greek yogurt,yogurt,plain yogurt',            'dairy',     32, 'oz',  'vegetarian,gluten_free', 'store'),
  ('greek_yogurt_32oz_name', 'Plain nonfat greek yogurt, 32 oz (Chobani)',  'greek yogurt,yogurt,plain yogurt,chobani',    'dairy',     32, 'oz',  'vegetarian,gluten_free', 'name'),
  ('chicken_breast_lb',      'Boneless skinless chicken breast',            'chicken,chicken breast,chicken breasts',      'protein',   1,  'lb',  'gluten_free',            'generic'),
  ('bananas_each',           'Banana, each',                                'banana,bananas',                              'produce',   1,  'ct',  'vegan,gluten_free',      'generic'),
  ('milk_2pct_gal',          '2% milk, 1 gal (store brand)',                'milk,2% milk,gallon of milk',                 'dairy',     1,  'gal', 'vegetarian,gluten_free', 'store'),
  ('milk_2pct_gal_name',     '2% milk, 1 gal (Kemps)',                      'milk,2% milk,gallon of milk,kemps',           'dairy',     1,  'gal', 'vegetarian,gluten_free', 'name'),
  ('pb_creamy_16oz',         'Creamy peanut butter, 16 oz (store brand)',   'peanut butter,pb,creamy peanut butter',       'pantry',    16, 'oz',  'vegan',                  'store'),
  ('pb_creamy_16oz_name',    'Creamy peanut butter, 16 oz (Jif)',           'peanut butter,pb,creamy peanut butter,jif',   'pantry',    16, 'oz',  'vegan',                  'name'),
  ('bread_white_20oz',       'White sandwich bread, 20 oz (store brand)',   'bread,white bread,sandwich bread,loaf',       'grains',    20, 'oz',  'vegetarian',             'store'),
  ('rice_white_2lb',         'Long grain white rice, 2 lb (store brand)',   'rice,white rice,long grain rice',             'grains',    2,  'lb',  'vegan,gluten_free',      'store'),
  ('pasta_spaghetti_16oz',   'Spaghetti, 16 oz (store brand)',              'pasta,spaghetti,noodles',                     'grains',    16, 'oz',  'vegan',                  'store'),
  ('ramen_3oz',              'Instant ramen, chicken flavor, 3 oz',         'ramen,instant noodles,maruchan',              'grains',    3,  'oz',  '',                       'name'),
  ('toilet_paper_12',        'Toilet paper, 12 rolls (store brand)',        'toilet paper,tp,toilet roll',                 'household', 12, 'ct',  '',                       'store');
