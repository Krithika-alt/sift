"""Databricks source tests with the SQL layer faked (no network, no credentials)."""
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from databricks_source import DatabricksData


@pytest.fixture
def db(monkeypatch):
    monkeypatch.setenv("DATABRICKS_HOST", "https://dbc-test.cloud.databricks.com/")
    monkeypatch.setenv("DATABRICKS_HTTP_PATH", "/sql/1.0/warehouses/abc")
    monkeypatch.setenv("DATABRICKS_TOKEN", "dapi-fake")
    d = DatabricksData(warm=False)
    d.calls = []

    def fake_query(statement, params=None):
        d.calls.append((statement, params))
        if "sift.main.stores" in statement:
            return [{"store_id": "s1", "name": "S1", "address": "x", "lat": Decimal("43.1"), "lon": -89.4}]
        if "sift.main.products" in statement:
            return [{"product_id": "eggs", "name": "Eggs", "search_terms": "eggs", "category": "protein",
                     "size_value": Decimal("12"), "size_unit": "ct", "dietary_tags": None}]
        if "sift.main.latest_prices" in statement:
            return [
                {"store_id": "s1", "product_id": "eggs", "price": Decimal("3.20"),
                 "unit_price": Decimal("0.2667"), "in_stock": True, "source": "website",
                 "observed_at": datetime(2026, 11, 14, 12, 0)},          # naive timestamp
                {"store_id": "s1", "product_id": "bad", "price": None,
                 "unit_price": None, "in_stock": True, "source": "x", "observed_at": None},
            ]
        return []

    monkeypatch.setattr(d, "_query", fake_query)
    return d


def test_host_is_cleaned(db):
    assert db.host == "dbc-test.cloud.databricks.com"


def test_missing_settings_gives_clear_error(monkeypatch):
    for k in ("DATABRICKS_HOST", "DATABRICKS_HTTP_PATH", "DATABRICKS_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    with pytest.raises(RuntimeError, match="backend/.env"):
        DatabricksData(warm=False)


def test_rows_are_converted_for_scoring(db):
    assert db.stores()[0]["lat"] == pytest.approx(43.1)
    assert db.products()[0]["size_value"] == 12.0
    rows = db.latest_prices()
    assert len(rows) == 1                                  # row with no price is skipped
    r = rows[0]
    assert isinstance(r["price"], float) and r["unit"] == "ct"   # unit filled from products
    assert r["observed_at"].tzinfo is timezone.utc                # naive -> UTC-aware


def test_stores_and_products_are_cached(db):
    db.stores(); db.stores(); db.products(); db.products()
    assert sum("sift.main.stores" in c[0] for c in db.calls) == 1
    assert sum("sift.main.products" in c[0] for c in db.calls) == 1


def test_add_ping_inserts_into_price_pings(db):
    pid = db.add_ping("s1", "eggs", 2.49, True)
    stmt, params = db.calls[-1]
    assert "INSERT INTO sift.main.price_pings" in stmt
    assert params["price"] == 2.49 and params["in_stock"] is True and params["ping_id"] == pid
