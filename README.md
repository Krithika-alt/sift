# Sift

**We dig. You dig in.**

<!-- Add a screenshot or GIF of the app here, e.g. ![Sift](docs/sift.png) -->

[Devpost](https://devpost.com/software/1551301) · Demo video: _link coming_

Sift tells you which Madison grocery store to go to for your whole list. You type or say what you need, and Sift ranks nearby stores by what your basket would actually cost, how far away each one is, and whether the stuff is in stock. When you see a price that's wrong, you can report it, and the ranking updates for everyone.

Built in 24 hours at MadHacks 2026 (UW–Madison, Nov 14–15).

## Why

Grocery prices around campus vary a lot, and nobody checks five store websites before a run. Most price tools compare one item at a time. That's not how people shop. Sift compares the whole basket, so you get an answer like "this store is a few dollars cheaper for your list, but a bit farther away."

## What it does

- **Rank stores for a basket.** Add items by typing or voice, and Sift ranks stores by total cost, distance and stock. Switch between Cheapest, Closest and your buddy's balanced pick.
- **Pick a produce buddy.** Tom the tomato, Cal the carrot, Lola the lemon and friends guide you through the app and answer your questions.
- **Map with a search radius.** Stores show up on a map around you, with a 1, 3, 5 or 10 mile radius and walk or drive times.
- **Your bag's needs.** Set a budget, a distance and up to two diets on your list.
- **Report a price.** Tap "Saw a different price?" on the receipt to report a shelf price or an out-of-stock item. It's saved to Databricks and overrides the older price right away, and the stores re-rank.
- **Ask your buddy.** Open-ended questions go to Databricks Genie. Common ones (why this store, cheaper swap, protein) are answered straight from the tables for speed. Either way, the backend checks the answer against the tables first.
- **Receipt view.** See what each item costs at the winning store, how old each price is, and what's missing.
- **Saved bags.** Save a list you buy often, edit it, and re-run it later.

## Real data, labeled honestly

Every price has a `source` label:

| source | meaning |
|---|---|
| `api` | Kroger Products API (Pick 'n Save on Park St, Metro Market in Shorewood Hills) |
| `website` | Collected from the store's own website (Target, Trader Joe's, Fresh Madison Market) |
| `crowd` | Reported by a user in the app |
| `simulated` | A placeholder for a few items we couldn't find (store-brand milk at four stores, one toilet paper price) |

Simulated prices are never used to claim savings in swap suggestions. See [`data/SOURCES.md`](data/SOURCES.md) for where every price came from.

Stores covered: Target (State St), Trader Joe's (Monroe St), Pick 'n Save (Park St), Fresh Madison Market (University Ave) and Metro Market (University Ave, Shorewood Hills). There are 15 common products, including store-brand and name-brand versions of milk, greek yogurt and peanut butter.

## How it's built

```
React + Vite frontend  →  FastAPI backend  →  Databricks (Unity Catalog + SQL warehouse)
                                          →  Databricks Genie (assistant)
```

### Frontend

A mobile-first, iPhone-sized web app built with React, Vite, Tailwind, Framer Motion and Leaflet. It has a hand-made "paper and kraft" look: produce stickers for labels, a buddy guide, and one color per store across its map pin, tags and receipt. A demo mode (`?demo=1`) runs the whole flow with mock data and a local copy of the scoring, so the app still works if the backend is down.

### Backend

FastAPI. It's the only part that talks to Databricks. Besides ranking, it handles voice list parsing, price reports and the assistant, and it falls back to mock data if Databricks isn't reachable.

### Databricks

- **Unity Catalog:** catalog `sift`, schema `main`
- **Raw layer:** price CSVs land in the `sift.main.raw` volume
- **Tables:** `stores`, `products`, `prices` (collected prices) and `price_pings` (crowd reports)
- **Serving view:** `latest_prices` picks the newest collected price per store and product, then lets a newer crowd report override it (labeled `crowd`)
- **Genie space:** answers data questions over the tables, with instructions about package sizes, store IDs and never filtering out simulated rows
- **AI/BI dashboard:** basket cost by store, where prices come from, store-brand savings and live crowd reports
- **MLflow:** logs a run of the scoring model with its weights, data sourcing and results on test baskets

### Ranking

The ranker is a transparent weighted score, not a trained model:

```
score = w_price * (cheapest_total / this_total)
      + w_distance * (1 - distance / max_distance)
      + w_stock * in_stock_share
      + w_pref * best_unit_price_share
```

`best_unit_price_share` is the share of basket items where this store has the lowest unit price (ties count).

Stock weight is 0 unless an item in the basket is reported out of stock somewhere; then it's 0.1. The weights are rescaled to sum to 1. Each view in the app uses its own price / distance / preference weights:

| View | price | distance | preference |
|---|---|---|---|
| Cheapest | 0.85 | 0.10 | 0.05 |
| Buddy's pick (default) | 0.60 | 0.30 | 0.10 |
| Closest | 0.25 | 0.70 | 0.05 |

A missing item is priced at the highest price seen anywhere, so stores can't win by not carrying something.

Package sizes differ between stores, so totals use pack-normalized prices (unit price × standard size). When that differs from the shelf price, the receipt and assistant show the shelf price and a size note.

### Matching what you say

Voice and typed items are matched to products in steps: exact, known aliases ("tee pee"), fuzzy spelling, then sound-alike ("bred" → bread). Weak matches are offered as suggestions instead of being picked silently.

### Measuring it

- **Voice parser** (`eval_voice.py`): item accuracy went from 82% to 100% on 30 messy spoken lists. 100% means every item matched the right product, with none confidently wrong. On 4 closer calls the app still asks you to confirm before using the match. The old matcher gave 2 confidently wrong answers.
- **Assistant** (`eval_agent.py`): 24 of 24 answers match the live tables. The right answers are computed from the tables, not hard-coded, so the test stays valid when prices change.
- **Genie:** 79% → 100% after we started passing store IDs instead of store names.

Both scripts can log their scores to MLflow.

## Repo layout

```
backend/              FastAPI app, scoring, matching, voice parsing, assistant, Genie client, evals, tests
frontend/             React + Vite app (src/screens, src/components, src/lib)
docs/                 team build plan and frontend design notes
notebooks/pipeline/   Databricks SQL, in run order
  01_create_tables.sql         catalog, schema, volume, tables, latest_prices view
  02_seed_stores_products.sql  stores and products
  03_load_prices.sql           loads the price CSVs
  04_dashboard_queries.sql     dashboard datasets
  05_genie_space.md            Genie instructions
data/
  kroger_prices.py    pulls prices from the Kroger Products API
  SOURCES.md          where each price came from
  raw/                stores and price CSVs
```

## Run it locally

You need Python 3.9+ and Node 18+.

**1. Backend**

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn main:app --reload --port 8000
```

By default it runs on mock data (`DATA_SOURCE=mock`), so you can try it without Databricks. To use the real tables, fill in `backend/.env`:

```
DATA_SOURCE=databricks
DATABRICKS_HOST=<workspace hostname>
DATABRICKS_HTTP_PATH=<SQL warehouse HTTP path>
DATABRICKS_TOKEN=<personal access token>
DATABRICKS_CATALOG=sift
DATABRICKS_SCHEMA=main
GENIE_SPACE_ID=<optional, turns on Genie for the assistant>
GENIE_OPEN_ENDED=1      # optional: also send swap and protein questions to Genie (slower)
```

Never commit `.env` or a token.

Check it's connected at `http://localhost:8000/api/health`. It should say `"ok": true` and `"data_source": "databricks"`. If the token is wrong, the app falls back to mock data and labels the prices as simulated.

**2. Frontend** (in a second terminal)

```bash
cd frontend
cp .env.example .env     # VITE_API_BASE=http://localhost:8000
npm install
npm run dev
```

Open `http://localhost:5173`. It's designed for a phone-sized window, so narrow your browser or use your browser's device toolbar.

If the backend doesn't answer within `FALLBACK_TIMEOUT_MS` (15 seconds, in `frontend/src/config.js`), the app switches to mock data and labels the prices as simulated. If you see "simulated for the demo," check the backend. Add `?demo=1` to the URL to run the frontend on its own mock data with no backend.

**3. Rebuild the Databricks side (optional)**

Run the files in `notebooks/pipeline/` in order in the Databricks SQL editor, after uploading `data/raw/*.csv` to the `sift.main.raw` volume. To refresh Kroger prices:

```bash
export KROGER_CLIENT_ID=...
export KROGER_CLIENT_SECRET=...
python data/kroger_prices.py                                     # Pick 'n Save, Park St
python data/kroger_prices.py metro_market_shorewood shorewood    # Metro Market
```

**Handy backend scripts**

```bash
python check_tables.py      # checks the Databricks tables are ready (PASS / WARN / FAIL)
python reset_demo.py        # clears crowd reports before a demo
python log_mlflow_run.py    # logs a scoring run to MLflow
python eval_agent.py        # scores the assistant against the live tables
python eval_voice.py        # scores the voice list parser
pytest                      # runs the tests, no Databricks needed
```

## API

| Method | Endpoint | What it does |
|---|---|---|
| GET | `/api/health` | Checks the data source (and wakes the warehouse) |
| GET | `/api/products` | Lists products |
| POST | `/api/parse-list` | Splits "milk, eggs and yogurt" into matched items. Accepts `alternatives` (other transcripts from speech-to-text) and returns `needs_confirm` and `suggestions` for each item |
| POST | `/api/rank-stores` | Ranks stores for a basket. Items can be plain strings or `{text, quantity}` |
| POST | `/api/report-price` | Saves a crowd price report |
| POST | `/api/ask-agent` | Answers a question about the ranking |

Interactive docs at `http://localhost:8000/docs`.

## Limits

- 5 stores and 15 products. It's a working pipeline, not full Madison coverage yet. Adding another Kroger-family store is one script run.
- Prices are a snapshot from this weekend. The Kroger script could run as a scheduled Databricks job to keep them fresh.
- Package sizes differ between stores (Trader Joe's oats are 18 oz); totals are pack-normalized.

## What's next

- Scheduled price refreshes as a Databricks job
- More stores and products
- Trust scores for crowd reports, so one bad report can't flip a ranking

## Team

- **Krithika** ([Krithika-alt](https://github.com/Krithika-alt)): backend, ranking, voice parsing, assistant, Genie integration, evals and MLflow
- **Aanya** ([AanyaBhatia](https://github.com/AanyaBhatia)): data collection, Kroger API script, Databricks tables and views, dashboard and Genie space
- **Adelaide** ([AdelaideKrab](https://github.com/AdelaideKrab)): frontend, design, buddies, map, voice input and motion

## License

MIT
