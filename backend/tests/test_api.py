"""API tests, including the hero demo loop on mock data."""
import pytest
from fastapi.testclient import TestClient

import main
from data_source import get_data_source

client = TestClient(main.app)
BASKET = ["eggs", "oats", "greek yogurt", "chicken breast", "bananas"]


def rank(weights=None):
    body = {"user_location": {"lat": 43.0731, "lon": -89.4012}, "items": BASKET, "budget": 20}
    if weights:
        body["weights"] = weights
    r = client.post("/api/rank-stores", json=body)
    assert r.status_code == 200
    return r.json()["ranked_stores"]


@pytest.fixture(autouse=True)
def clean_pings():
    get_data_source().reset_pings()
    yield
    get_data_source().reset_pings()


def test_health_and_products():
    assert client.get("/api/health").json() == {"ok": True}
    products = client.get("/api/products").json()
    assert {"product_id": "eggs_large_12", "name": "Large eggs, 12 ct"} in products


def test_cors_open():
    r = client.options("/api/rank-stores", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert r.headers["access-control-allow-origin"] == "*"


def test_hero_demo_loop():
    # 2. Store A ranks #1
    assert rank()[0]["store_id"] == "trader_joes_monroe"
    # 3. distance slider up -> Store B jumps to #1
    assert rank({"price": 0.2, "distance": 0.8, "preference": 0})[0]["store_id"] == "target_state_st"
    # 4. snitch a price at Store C -> Store C jumps to #1 live
    r = client.post("/api/report-price", json={
        "store_id": "pick_n_save", "product_id": "eggs_large_12", "price": 2.49, "in_stock": True})
    assert r.json()["ok"] is True and r.json()["ping_id"].startswith("p_")
    after = rank()
    assert after[0]["store_id"] == "pick_n_save"
    assert after[0]["last_crowd_ping"] == "just now"
    # 5. the assistant explains using the ranking numbers
    ans = client.post("/api/ask-agent", json={
        "question": "Why did Pick 'n Save win?", "ranking": {"ranked_stores": after}}).json()
    assert "Pick 'n Save" in ans["answer"] and ans["facts_used"]


def test_report_price_validates_ids():
    bad = client.post("/api/report-price", json={"store_id": "nope", "product_id": "eggs_large_12", "price": 2})
    assert bad.status_code == 404
    assert client.post("/api/report-price", json={
        "store_id": "pick_n_save", "product_id": "eggs_large_12", "price": -1}).status_code == 422


def test_unmatched_item_is_flagged():
    body = {"user_location": {"lat": 43.0731, "lon": -89.4012}, "items": ["eggs", "unobtainium"]}
    stores = client.post("/api/rank-stores", json=body).json()["ranked_stores"]
    assert all("unobtainium" in s["missing_items"] for s in stores)


def test_ask_agent_without_ranking():
    assert client.post("/api/ask-agent", json={"question": "hi"}).json()["facts_used"] == []
