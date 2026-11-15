"""Real data source: reads/writes the Databricks tables in catalog sift, schema main.

Same four methods as MockData (stores, products, latest_prices, add_ping), so the
API code does not change. Needs these in backend/.env (never commit it):

    DATA_SOURCE=databricks
    DATABRICKS_HOST=dbc-xxxx.cloud.databricks.com
    DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/xxxx
    DATABRICKS_TOKEN=dapi...
    DATABRICKS_CATALOG=sift      (optional, default sift)
    DATABRICKS_SCHEMA=main       (optional, default main)

Stores and products are cached after the first read. Prices are re-read on every
request so a new ping shows up on the next /api/rank-stores call.
price_pings is written through the SQL warehouse (Delta table). If Role 2 puts it
in Lakebase instead, only add_ping needs to change.
"""
from __future__ import annotations

import os
import threading
import uuid
from datetime import datetime, timezone


def _to_dt(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = datetime.fromisoformat(v.replace("Z", "+00:00"))
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v


def _f(v):
    return None if v is None else float(v)


class DatabricksData:
    def __init__(self, warm: bool = True) -> None:
        missing = [k for k in ("DATABRICKS_HOST", "DATABRICKS_HTTP_PATH", "DATABRICKS_TOKEN")
                   if not os.getenv(k)]
        if missing:
            raise RuntimeError(
                f"Missing {', '.join(missing)} in backend/.env "
                "(or set DATA_SOURCE=mock to run on fake data)."
            )
        host = os.environ["DATABRICKS_HOST"].strip()
        self.host = host.replace("https://", "").replace("http://", "").rstrip("/")
        self.http_path = os.environ["DATABRICKS_HTTP_PATH"].strip()
        self.token = os.environ["DATABRICKS_TOKEN"].strip()
        self.catalog = os.getenv("DATABRICKS_CATALOG", "sift")
        self.schema = os.getenv("DATABRICKS_SCHEMA", "main")
        self._conn = None
        self._lock = threading.Lock()
        self._stores: list[dict] | None = None
        self._products: list[dict] | None = None
        if warm:
            # a Free Edition warehouse can take ~a minute to wake: start it now
            threading.Thread(target=self._warm, daemon=True).start()

    # --- plumbing ---
    def _t(self, table: str) -> str:
        return f"{self.catalog}.{self.schema}.{table}"

    def _connect(self):
        from databricks import sql  # imported lazily so tests need no connector
        return sql.connect(
            server_hostname=self.host, http_path=self.http_path, access_token=self.token
        )

    def _close(self) -> None:
        try:
            if self._conn is not None:
                self._conn.close()
        except Exception:
            pass
        self._conn = None

    def _query(self, statement: str, params: dict | None = None) -> list[dict]:
        with self._lock:
            for attempt in (1, 2):
                try:
                    if self._conn is None:
                        self._conn = self._connect()
                    with self._conn.cursor() as cur:
                        cur.execute(statement, params)
                        if cur.description is None:
                            return []
                        cols = [d[0] for d in cur.description]
                        return [dict(zip(cols, row)) for row in cur.fetchall()]
                except Exception:
                    self._close()  # stale connection: reconnect once, then give up
                    if attempt == 2:
                        raise
        return []

    def _warm(self) -> None:
        try:
            self._query("SELECT 1")
        except Exception:
            pass

    def ping(self) -> bool:
        """True if the warehouse answers. Handy for a health check."""
        self._query("SELECT 1")
        return True

    # --- interface used by the API ---
    def stores(self) -> list[dict]:
        if self._stores is None:
            rows = self._query(f"SELECT * FROM {self._t('stores')}")
            self._stores = [
                {"store_id": r["store_id"], "name": r["name"], "address": r.get("address"),
                 "lat": float(r["lat"]), "lon": float(r["lon"])}
                for r in rows
            ]
        return list(self._stores)

    def products(self) -> list[dict]:
        if self._products is None:
            rows = self._query(f"SELECT * FROM {self._t('products')}")
            self._products = [
                {"product_id": r["product_id"], "name": r["name"],
                 "search_terms": r.get("search_terms") or "", "category": r.get("category"),
                 "size_value": _f(r.get("size_value")), "size_unit": r.get("size_unit"),
                 "dietary_tags": r.get("dietary_tags") or "",
                 "brand_tier": r.get("brand_tier")}
                for r in rows
            ]
        return list(self._products)

    def latest_prices(self) -> list[dict]:
        rows = self._query(f"SELECT * FROM {self._t('latest_prices')}")
        size_unit = {p["product_id"]: p["size_unit"] for p in self.products()}
        out = []
        for r in rows:
            if r.get("price") is None:
                continue
            out.append({
                "store_id": r["store_id"], "product_id": r["product_id"],
                "price": float(r["price"]), "unit_price": _f(r.get("unit_price")),
                "unit": r.get("unit") or size_unit.get(r["product_id"]),
                "in_stock": True if r.get("in_stock") is None else bool(r["in_stock"]),
                "source": r.get("source"), "observed_at": _to_dt(r.get("observed_at")),
            })
        return out

    def add_ping(self, store_id: str, product_id: str, price: float, in_stock: bool) -> str:
        ping_id = f"p_{uuid.uuid4().hex[:8]}"
        self._query(
            f"INSERT INTO {self._t('price_pings')} "
            "(ping_id, store_id, product_id, price, in_stock, reported_at) "
            "VALUES (:ping_id, :store_id, :product_id, :price, :in_stock, current_timestamp())",
            {"ping_id": ping_id, "store_id": store_id, "product_id": product_id,
             "price": float(price), "in_stock": bool(in_stock)},
        )
        return ping_id
