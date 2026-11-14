"""Sift API (FastAPI). Run:  uvicorn main:app --reload --port 8000

Endpoints follow section 3 of the team build plan exactly:
  POST /api/rank-stores, POST /api/report-price, POST /api/ask-agent,
  GET /api/products, GET /api/health
The frontend only talks to this API; only this backend talks to Databricks.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from assistant import answer_question
from data_source import get_data_source
from matching import match_items
from scoring import rank_stores

app = FastAPI(title="Sift API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


class Location(BaseModel):
    lat: float
    lon: float


class Weights(BaseModel):
    price: float = 0.6
    distance: float = 0.3
    preference: float = 0.1
    stock: float | None = None


class RankRequest(BaseModel):
    user_location: Location
    items: list[str] = Field(min_length=1)
    weights: Weights = Weights()
    budget: float | None = None


class ReportPriceRequest(BaseModel):
    store_id: str
    product_id: str
    price: float = Field(gt=0)
    in_stock: bool = True


class AskRequest(BaseModel):
    question: str
    ranking: dict | None = None


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/products")
def products():
    return [{"product_id": p["product_id"], "name": p["name"]} for p in get_data_source().products()]


@app.post("/api/rank-stores")
def rank(req: RankRequest):
    ds = get_data_source()
    products_list = ds.products()
    items = match_items(req.items, products_list)
    ranked = rank_stores(
        user_location=req.user_location.model_dump(),
        items=items,
        weights=req.weights.model_dump(exclude_none=True),
        budget=req.budget,
        prices=ds.latest_prices(),
        stores=ds.stores(),
        products={p["product_id"]: p for p in products_list},
    )
    return {"ranked_stores": ranked}


@app.post("/api/report-price")
def report_price(req: ReportPriceRequest):
    ds = get_data_source()
    if req.store_id not in {s["store_id"] for s in ds.stores()}:
        raise HTTPException(404, f"Unknown store_id: {req.store_id}")
    if req.product_id not in {p["product_id"] for p in ds.products()}:
        raise HTTPException(404, f"Unknown product_id: {req.product_id}")
    ping_id = ds.add_ping(req.store_id, req.product_id, req.price, req.in_stock)
    return {"ok": True, "ping_id": ping_id}


@app.post("/api/ask-agent")
def ask_agent(req: AskRequest):
    return answer_question(req.question, req.ranking)
