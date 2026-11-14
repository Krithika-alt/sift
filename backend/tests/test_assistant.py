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
