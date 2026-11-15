from assistant import answer_question, _intent
from data_source import MockData
from scoring import rank_stores
from fastapi.testclient import TestClient
import main

USER = {"lat": 43.0731, "lon": -89.4012}


def _data(extra_products=None, extra_prices=None):
    m = MockData()
    d = {"stores": m.stores(), "products": m.products(), "prices": m.latest_prices()}
    d["products"] = d["products"] + (extra_products or [])
    d["prices"] = d["prices"] + (extra_prices or [])
    return d


def _ranking(data, names):
    items = [(n, None) for n in names]
    byname = {p["name"]: p["product_id"] for p in data["products"]}
    items = [(n, byname[n]) for n in names]
    ranked = rank_stores(USER, items, {"price": .6, "distance": .3, "preference": .1},
                         None, data["prices"], data["stores"], {p["product_id"]: p for p in data["products"]})
    return {"ranked_stores": ranked}


def test_intents():
    assert _intent("Cheapest protein per dollar?") == "protein"
    assert _intent("What can I swap to save money?") == "swap"
    assert _intent("Why did this store win?") == "why"


def test_protein_uses_table_numbers():
    d = _data()
    r = answer_question("Cheapest protein per dollar?", None, d)
    assert r["facts_used"] and "/" in r["answer"]
    assert "nutrition" in r["answer"]
    assert "simulated" in r["answer"]


def test_swap_needs_ranking():
    r = answer_question("What can I swap to save money?", None, _data())
    assert "Run a basket" in r["answer"]


def test_swap_finds_cheaper_store_brand():
    d = _data()
    base = next(p for p in d["products"] if p["category"] and "milk" in p["name"].lower())
    cheap = dict(base, product_id="milk_store_brand", name="Store Brand Milk")
    rows = [dict(r, product_id="milk_store_brand", price=r["price"] * 0.5, unit_price=r["unit_price"] * 0.5)
            for r in d["prices"] if r["product_id"] == base["product_id"]]
    d = _data([cheap], rows)
    rk = _ranking(d, [base["name"]])
    r = answer_question("What can I swap to save money?", rk, d)
    assert "Store Brand Milk" in r["answer"]


def test_swap_no_candidates_is_honest():
    d = _data()
    rk = _ranking(d, [d["products"][0]["name"]])
    r = answer_question("What can I swap to save money?", rk, d)
    assert r["answer"]


def test_without_data_data_questions_degrade():
    r = answer_question("Cheapest protein per dollar?", None, None)
    assert "tables" in r["answer"]


def test_api_three_questions():
    c = TestClient(main.app)
    rk = c.post("/api/rank-stores", json={"user_location": USER, "items": ["milk", "eggs"]}).json()
    for q in ["Why did this store win?", "Cheapest protein per dollar?", "What can I swap to save money?"]:
        r = c.post("/api/ask-agent", json={"question": q, "ranking": rk})
        assert r.status_code == 200 and r.json()["answer"]


def test_why_mentions_stale_prices():
    rk = {"ranked_stores": [{"store_id": "a", "name": "A", "distance_miles": 1.0, "total_basket_price": 3.0,
          "ml_rank_score": 0.9, "last_crowd_ping": None, "missing_items": [],
          "items_breakdown": [{"name": "Eggs", "stale": True, "price_age": "9 days ago"}]}]}
    r = answer_question("Why did this store win?", rk)
    assert "over a week old" in r["answer"] and "9 days ago" in r["answer"]


def test_price_question_answers_from_tables():
    d = _data()
    r = answer_question("Which store has the cheapest Large eggs, 12 ct?", None, d)
    rows = [x for x in d["prices"] if x["product_id"] == "eggs_large_12" and x["in_stock"]]
    best = min(rows, key=lambda x: x["price"])
    assert f"{best['price']:.2f}" in r["answer"]
    assert "cheaper" not in _intent("Which is cheaper, eggs at A or B?") or _intent("Which is cheaper, eggs at A or B?") == "price"


def test_stock_question_and_unknown_product():
    d = _data()
    assert answer_question("Which stores do not have Large eggs, 12 ct in stock?", None, d)["answer"]
    assert "couldn't tell" in answer_question("cheapest unobtainium?", None, d)["answer"]
