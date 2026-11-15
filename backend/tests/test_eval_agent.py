import eval_agent as ev
from data_source import MockData


def _data():
    m = MockData()
    return {"stores": m.stores(), "products": m.products(), "prices": m.latest_prices()}


def test_cases_are_built_from_tables():
    cases = ev.build_cases(**_data())
    assert cases and {c["type"] for c in cases} >= {"cheapest", "compare"}
    assert all(c["expected"] and c["question"].endswith(("?", ".")) for c in cases)


def test_cheapest_expected_matches_data():
    d = _data()
    c = next(c for c in ev.build_cases(**d) if c["type"] == "cheapest")
    pid = c["id"].split(":", 1)[1]
    rows = [r for r in d["prices"] if r["product_id"] == pid and r["in_stock"]]
    best = min(rows, key=lambda r: r["price"])
    assert f"{best['price']:.2f}" in c["expected"]


def test_grade_requires_every_expected_fact():
    case = {"expected": ["target", "1.79"]}
    assert ev.grade(case, {"answer": "Target has it for $1.79", "facts_used": []})
    assert not ev.grade(case, {"answer": "Target has it", "facts_used": []})
    assert ev.grade(case, {"answer": "Target", "facts_used": ["row price=1.79"]})


def test_perfect_and_broken_agents():
    cases = ev.build_cases(**_data())[:6]
    by_q = {c["question"]: c for c in cases}
    perfect = lambda q: {"answer": " ".join(by_q[q]["expected"]), "facts_used": []}  # noqa: E731
    broken = lambda q: (_ for _ in ()).throw(RuntimeError("boom"))  # noqa: E731
    assert ev.summarize(ev.run_agent(perfect, cases))["accuracy"] == 1.0
    s = ev.summarize(ev.run_agent(broken, cases))
    assert s["accuracy"] == 0.0 and s["errors"] == len(cases)


def test_round_robin_mixes_types_and_workers_work():
    cases = ev.build_cases(**_data())
    assert len({c["type"] for c in cases[:3]}) >= 2
    res = ev.run_agent(lambda q: {"answer": "", "facts_used": []}, cases[:4], workers=3)
    assert len(res) == 4


def test_grounded_agent_runs_on_all_cases():
    d = _data()
    agent = ev.make_agents(d)["grounded"]
    res = ev.run_agent(agent, ev.build_cases(**d))
    assert len(res) == len(ev.build_cases(**d))
