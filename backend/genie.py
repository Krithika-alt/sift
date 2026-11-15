"""Optional Databricks Genie backend for the assistant.

If GENIE_SPACE_ID (plus DATABRICKS_HOST / DATABRICKS_TOKEN) is set, data questions
("cheapest protein", "what can I swap") are sent to the Genie space, which writes SQL
over our gold tables. We return Genie's text and the SQL + first rows as `facts_used`.
Any failure or timeout raises GenieError and the caller falls back to the grounded
answers in assistant.py, so the demo never depends on Genie being up.
"""
from __future__ import annotations

import os
import time

import requests

POLL_SECONDS = 1.5
DONE = {"COMPLETED"}
BAD = {"FAILED", "CANCELLED", "QUERY_RESULT_EXPIRED"}


class GenieError(RuntimeError):
    pass


def genie_enabled() -> bool:
    return bool(os.getenv("GENIE_SPACE_ID", "").strip()) and os.getenv("USE_GENIE", "1") != "0" \
        and bool(os.getenv("DATABRICKS_HOST")) and bool(os.getenv("DATABRICKS_TOKEN"))


def _base() -> str:
    host = os.environ["DATABRICKS_HOST"].strip()
    host = host.replace("https://", "").replace("http://", "").rstrip("/")
    return f"https://{host}/api/2.0/genie/spaces/{os.environ['GENIE_SPACE_ID'].strip()}"


def _headers() -> dict:
    return {"Authorization": f"Bearer {os.environ['DATABRICKS_TOKEN'].strip()}"}


def _get(url: str) -> dict:
    r = requests.get(url, headers=_headers(), timeout=15)
    if r.status_code >= 400:
        raise GenieError(f"Genie GET {r.status_code}: {r.text[:200]}")
    return r.json()


def ask_genie(question: str, timeout: float = 25.0, max_rows: int = 5) -> dict:
    """Return {"answer": str, "facts_used": [str], "source": "genie"}."""
    base = _base()
    r = requests.post(f"{base}/start-conversation", headers=_headers(),
                      json={"content": question}, timeout=15)
    if r.status_code >= 400:
        raise GenieError(f"Genie start {r.status_code}: {r.text[:200]}")
    start = r.json()
    cid = start.get("conversation_id") or (start.get("conversation") or {}).get("id")
    mid = start.get("message_id") or (start.get("message") or {}).get("id")
    if not cid or not mid:
        raise GenieError("Genie did not return conversation/message ids")

    msg_url = f"{base}/conversations/{cid}/messages/{mid}"
    deadline = time.time() + timeout
    msg = {}
    while True:
        msg = _get(msg_url)
        status = msg.get("status")
        if status in DONE:
            break
        if status in BAD:
            raise GenieError(f"Genie status {status}: {msg.get('error')}")
        if time.time() > deadline:
            raise GenieError("Genie timed out")
        time.sleep(POLL_SECONDS)

    texts, descs, facts = [], [], []
    for att in msg.get("attachments") or []:
        t = att.get("text")
        # skip Genie's clarifying follow-up questions; keep the actual answer
        if t and t.get("content") and t.get("purpose") != "FOLLOW_UP_QUESTION":
            texts.append(t["content"].strip())
        q = att.get("query")
        if q:
            if q.get("description"):
                descs.append(q["description"].strip())
            if q.get("query"):
                facts.append("Genie SQL: " + " ".join(q["query"].split()))
            aid = att.get("attachment_id") or att.get("id") or q.get("id")
            if aid:
                try:
                    res = _get(f"{msg_url}/attachments/{aid}/query-result")
                    sr = res.get("statement_response") or res
                    cols = [c["name"] for c in sr.get("manifest", {}).get("schema", {}).get("columns", [])]
                    for row in (sr.get("result", {}).get("data_array") or [])[:max_rows]:
                        facts.append("Genie row: " + ", ".join(f"{c}={v}" for c, v in zip(cols, row)))
                except GenieError:
                    pass
    if not texts:
        texts = descs  # no text answer: fall back to Genie's description of the query
    if not texts and not facts:
        raise GenieError("Genie returned no answer")
    answer = " ".join(dict.fromkeys(texts)) or "See the rows Genie returned."
    return {"answer": answer, "facts_used": facts, "source": "genie"}
