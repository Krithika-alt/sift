import agent
import pytest
from data_source import MockData


@pytest.fixture(autouse=True)
def _fresh_cache(monkeypatch):
    agent._CACHE.clear()
    monkeypatch.delenv("GENIE_OPEN_ENDED", raising=False)


def _data():
    m = MockData()
    return {"stores": m.stores(), "products": m.products(), "prices": m.latest_prices()}


Q = "Which store has the cheapest Large eggs, 12 ct?"


def _truth(d):
    rows = [r for r in d["prices"] if r["product_id"] == "eggs_large_12" and r["in_stock"]]
    best = min(rows, key=lambda r: r["price"])
    name = next(s["name"] for s in d["stores"] if s["store_id"] == best["store_id"])
    return name, f"{best['price']:.2f}"


def test_agrees_requires_every_key_fact():
    g = {"answer": "Target has it for $1.79", "facts_used": []}
    assert agent.agrees(["target", "1.79"], g) and not agent.agrees(["target", "1.99"], g)
    assert agent.agrees(["pick 'n save"], {"answer": "Pick ’n Save", "facts_used": []})


def test_verified_genie_answer_is_kept():
    d = _data()
    name, price = _truth(d)
    good = {"answer": f"{name} at ${price}", "facts_used": [], "source": "genie"}
    out = agent.respond(Q, None, d, lambda q: dict(good))
    assert out["source"] == "genie" and out["verified"] is True


def test_wrong_genie_answer_is_corrected_from_tables():
    d = _data()
    name, price = _truth(d)
    bad = {"answer": "Nobody sells that, no price data.", "facts_used": [], "source": "genie"}
    out = agent.respond(Q, None, d, lambda q: dict(bad))
    assert out["source"] == "grounded" and price in out["answer"]
    assert "did not match" in out["note"] and out["genie_answer"].startswith("Nobody")


def test_genie_failure_falls_back_and_why_skips_genie():
    d = _data()

    def boom(q):
        raise RuntimeError("down")
    assert agent.respond(Q, None, d, boom)["source"] == "grounded"
    called = []
    out = agent.respond("Why did this store win?", {"ranked_stores": []}, d, lambda q: called.append(q))
    assert not called and out["source"] == "grounded"


def test_open_ended_questions_trust_genie(monkeypatch):
    monkeypatch.setenv("GENIE_OPEN_ENDED", "1")
    d = _data()
    g = {"answer": "Switch to store brand.", "facts_used": ["Genie row: x"], "source": "genie"}
    out = agent.respond("Cheapest protein per dollar?", None, d, lambda q: dict(g))
    assert out["source"] == "genie"


def test_no_internal_keys_leak():
    out = agent.respond(Q, None, _data(), None)
    assert "verify" not in out and out["headline"]


def test_swap_and_protein_are_instant_from_tables_by_default():
    d = _data()
    def boom(q):
        raise AssertionError("Genie must not be called for swap/protein by default")
    for q in ("Cheaper swap?", "Which protein item has the lowest unit price per oz?"):
        out = agent.respond(q, None, d, boom)
        assert out["source"] == "grounded"


def test_repeated_question_is_served_from_cache_and_new_price_invalidates_it():
    d = _data()
    name, price = _truth(d)
    calls = []
    def genie(q):
        calls.append(q)
        return {"answer": f"{name} at ${price}", "facts_used": [], "source": "genie"}
    first = agent.respond(Q, None, d, genie)
    second = agent.respond(Q, None, d, genie)
    assert len(calls) == 1 and second["answer"] == first["answer"] and second["verified"] is True
    d["prices"][0] = {**d["prices"][0], "price": d["prices"][0]["price"] + 0.01}   # a price changed
    agent.respond(Q, None, d, genie)
    assert len(calls) == 2
