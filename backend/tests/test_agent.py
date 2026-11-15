import agent
from data_source import MockData


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


def test_open_ended_questions_trust_genie():
    d = _data()
    g = {"answer": "Switch to store brand.", "facts_used": ["Genie row: x"], "source": "genie"}
    out = agent.respond("Cheapest protein per dollar?", None, d, lambda q: dict(g))
    assert out["source"] == "genie"


def test_no_internal_keys_leak():
    out = agent.respond(Q, None, _data(), None)
    assert "verify" not in out and out["headline"]
