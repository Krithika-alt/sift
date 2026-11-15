"""Sift API (FastAPI). Run:  uvicorn main:app --reload --port 8000

Endpoints follow section 3 of the team build plan exactly:
  POST /api/rank-stores, POST /api/report-price, POST /api/ask-agent,
  GET /api/products, GET /api/health
The frontend only talks to this API; only this backend talks to Databricks.
"""
from typing import Optional, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agent import respond
from data_source import get_data_source
from matching import match_items
from genie import genie_enabled, ask_genie
from parse_list import parse_list
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
    stock: Optional[float] = None


class ItemSpec(BaseModel):
    text: str
    quantity: int = Field(default=1, ge=1, le=99)


class RankRequest(BaseModel):
    user_location: Location
    # plain strings (one of each) or {"text": "milk", "quantity": 2}; /api/parse-list returns that shape
    items: list[Union[str, ItemSpec]] = Field(min_length=1)
    weights: Weights = Weights()
    budget: Optional[float] = None


class ParseListRequest(BaseModel):
    text: str
    # other transcripts the speech engine considered (SpeechRecognition maxAlternatives)
    alternatives: list[str] = []


class ReportPriceRequest(BaseModel):
    store_id: str
    product_id: str
    price: float = Field(gt=0)
    in_stock: bool = True


class AskRequest(BaseModel):
    question: str
    ranking: Optional[dict] = None


@app.get("/api/health")
def health():
    """200 {"ok": true} when the data source answers; 503 {"ok": false, ...} when it does not.
    With Databricks this also wakes the SQL warehouse: hit it before the demo."""
    ds = get_data_source()
    kind = "databricks" if type(ds).__name__ == "DatabricksData" else "mock"
    try:
        ds.ping()
    except Exception as e:  # noqa: BLE001
        msg = (str(e).splitlines() or [type(e).__name__])[0][:200]
        raise HTTPException(503, detail={"ok": False, "data_source": kind, "error": msg})
    return {"ok": True, "data_source": kind}


@app.get("/api/products")
def products():
    return [{"product_id": p["product_id"], "name": p["name"]} for p in get_data_source().products()]


@app.post("/api/parse-list")
def parse_list_endpoint(req: ParseListRequest):
    """Split a spoken/typed list ("milk, eggs and greek yogurt") into separate matched items.
    The frontend sends the speech-to-text transcript here, shows the items, then passes
    `rank_items` straight to /api/rank-stores."""
    return parse_list(req.text, get_data_source().products(), req.alternatives)


@app.post("/api/rank-stores")
def rank(req: RankRequest):
    ds = get_data_source()
    products_list = ds.products()
    specs = [ItemSpec(text=i) if isinstance(i, str) else i for i in req.items]
    items = match_items([sp.text for sp in specs], products_list)
    quantities: dict = {}
    for sp in specs:  # sum quantities per product, even when two phrases match the same product
        hit = match_items([sp.text], products_list)
        if hit and hit[0][1]:
            quantities[hit[0][1]] = quantities.get(hit[0][1], 0) + sp.quantity
    ranked = rank_stores(
        user_location=req.user_location.model_dump(),
        items=items,
        weights=req.weights.model_dump(exclude_none=True),
        budget=req.budget,
        prices=ds.latest_prices(),
        stores=ds.stores(),
        products={p["product_id"]: p for p in products_list},
        quantities=quantities,
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
    ds = get_data_source()
    data = {"stores": ds.stores(), "products": ds.products(), "prices": ds.latest_prices()}
    genie_fn = None
    if genie_enabled():
        def genie_fn(q):
            return ask_genie(q, ranking=req.ranking, stores=data["stores"])
    return respond(req.question, req.ranking, data, genie_fn)
