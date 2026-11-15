import pytest
import genie
import main
from fastapi.testclient import TestClient

RK = {"ranked_stores": []}


class R:
    def __init__(self, code, data):
        self.status_code, self._d, self.text = code, data, str(data)

    def json(self):
        return self._d


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("GENIE_SPACE_ID", "space1")
    monkeypatch.setenv("USE_GENIE", "1")
    monkeypatch.setenv("DATABRICKS_HOST", "https://x.cloud.databricks.com")
    monkeypatch.setenv("DATABRICKS_TOKEN", "t")
    monkeypatch.setattr(genie.time, "sleep", lambda s: None)


def _fake(monkeypatch, statuses):
    seq = iter(statuses)
    monkeypatch.setattr(genie.requests, "post",
                        lambda *a, **k: R(200, {"conversation_id": "c", "message_id": "m"}))

    def get(url, **k):
        if url.endswith("query-result"):
            return R(200, {"statement_response": {"manifest": {"schema": {"columns": [{"name": "name"}, {"name": "up"}]}},
                                                  "result": {"data_array": [["Eggs", "0.15"]]}}})
        st = next(seq)
        if st != "COMPLETED":
            return R(200, {"status": st})
        return R(200, {"status": st, "attachments": [
            {"text": {"content": "Eggs are cheapest."},
             "attachment_id": "a", "query": {"query": "SELECT 1", "id": "a"}}]})
    monkeypatch.setattr(genie.requests, "get", get)


def test_enabled_flag(monkeypatch):
    monkeypatch.delenv("GENIE_SPACE_ID", raising=False)
    assert not genie.genie_enabled()


def test_ask_genie_polls_and_returns_facts(env, monkeypatch):
    _fake(monkeypatch, ["ASKING_AI", "EXECUTING_QUERY", "COMPLETED"])
    out = genie.ask_genie("cheapest protein?")
    assert out["answer"] == "Eggs are cheapest." and out["source"] == "genie"
    assert any("SELECT 1" in f for f in out["facts_used"])
    assert any("name=Eggs" in f for f in out["facts_used"])


def test_failed_status_raises(env, monkeypatch):
    _fake(monkeypatch, ["FAILED"])
    with pytest.raises(genie.GenieError):
        genie.ask_genie("q")


def test_api_uses_genie_then_falls_back(env, monkeypatch):
    c = TestClient(main.app)
    _fake(monkeypatch, ["COMPLETED"])
    r = c.post("/api/ask-agent", json={"question": "Cheapest protein per dollar?", "ranking": RK}).json()
    assert r["source"] == "genie"
    _fake(monkeypatch, ["FAILED"])
    r = c.post("/api/ask-agent", json={"question": "Cheapest protein per dollar?", "ranking": RK}).json()
    assert r["source"] == "grounded" and r["answer"]


def test_why_question_never_uses_genie(env, monkeypatch):
    _fake(monkeypatch, ["COMPLETED"])
    r = TestClient(main.app).post("/api/ask-agent", json={"question": "Why did this store win?", "ranking": RK}).json()
    assert r["source"] == "grounded"


def test_follow_up_question_is_dropped(env, monkeypatch):
    monkeypatch.setattr(genie.requests, "post", lambda *a, **k: R(200, {"conversation_id": "c", "message_id": "m"}))
    monkeypatch.setattr(genie.requests, "get", lambda url, **k: R(200, {"status": "COMPLETED", "attachments": [
        {"text": {"content": "Want more?", "purpose": "FOLLOW_UP_QUESTION"}},
        {"text": {"content": "Eggs win.", "purpose": "TEXT_ATTACHMENT_PURPOSE_ANSWER"}}]}))
    monkeypatch.setattr(genie.requests, "get", lambda url, **k: R(200, {"status": "COMPLETED", "attachments": [
        {"text": {"content": "Want more?", "purpose": "FOLLOW_UP_QUESTION"}},
        {"text": {"content": "Eggs win.", "purpose": "TEXT_ATTACHMENT_PURPOSE_ANSWER"}},
        {"attachment_id": "a", "query": {"query": "SELECT 1", "id": "a"}}]}) if not url.endswith("query-result") else R(200, {"statement_response": {"manifest": {"schema": {"columns": [{"name": "n"}]}}, "result": {"data_array": [["x"]]}}}))
    assert genie.ask_genie("q")["answer"] == "Eggs win."


def test_build_question_includes_basket_and_style():
    rk = {"ranked_stores": [{"name": "Target", "items_breakdown": [{"name": "Eggs"}, {"name": "Milk"}]}]}
    q = genie.build_question("What can I swap to save money?", rk)
    assert "Eggs, Milk" in q and "Target" in q and "follow-up" in q and "swaps for items" in q
    assert "Context" not in genie.build_question("Cheapest protein?", None)


def test_text_only_answer_falls_back(env, monkeypatch):
    monkeypatch.setattr(genie.requests, "post", lambda *a, **k: R(200, {"conversation_id": "c", "message_id": "m"}))
    monkeypatch.setattr(genie.requests, "get", lambda url, **k: R(200, {"status": "COMPLETED", "attachments": [
        {"text": {"content": "Probably eggs.", "purpose": "TEXT_ATTACHMENT_PURPOSE_ANSWER"}}]}))
    with pytest.raises(genie.GenieError):
        genie.ask_genie("q")


def test_headline_is_first_sentence(env, monkeypatch):
    _fake(monkeypatch, ["COMPLETED"])
    out = genie.ask_genie("q")
    assert out["headline"] == "Eggs are cheapest."


def test_headline_strips_markdown_and_swap_prompt_avoids_noop():
    assert "**" not in genie._headline("At **Target** save money. More text.")
    rk = {"ranked_stores": [{"name": "Target", "items_breakdown": [{"name": "Milk (store brand)"}]}]}
    assert "already" in genie.build_question("What can I swap to save money?", rk)
