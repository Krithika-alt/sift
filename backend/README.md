# Sift backend (Role 1)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000     # http://localhost:8000/docs
pytest                                    # 18 tests, no Databricks needed
```

Runs on **mock data** (all prices `source='simulated'`) until the Databricks
tables exist. Endpoints match section 3 of the team build plan:
`POST /api/rank-stores`, `POST /api/report-price`, `POST /api/ask-agent`,
`GET /api/products`, `GET /api/health`.

- `scoring.py`: the scoring formula (a scoring model with tunable weights, not deep learning)
- `matching.py`: user text to product_id (exact + rapidfuzz)
- `data_source.py`: in-memory mock of the Databricks tables; replace with a Databricks class
- `assistant.py`: explains a ranking using only numbers in the ranking JSON
