"""The assistant's brain: Genie answers, the tables check them.

For price, stock and "which is cheaper" questions we compute the answer straight from the
tables as well (assistant.py). If Genie's answer does not contain the key facts from the tables
(the cheapest store and its price, both prices, the stores without stock), we return the table
answer instead and say so. For open-ended questions (swaps, protein) Genie answers on its own.
If Genie is off or fails, the table answer is returned. Every response says where it came from:

    source   "genie"      Genie's answer (verified True when the tables agreed)
             "grounded"   straight from the tables (Genie off, failed, or disagreed: see `note`)
"""
from __future__ import annotations

from assistant import _intent, answer_question


def _norm(text: str) -> str:
    return text.lower().replace("’", "'").replace("$", "")


def agrees(verify: list, genie: dict) -> bool:
    """True when every key fact from the tables appears in Genie's answer or rows."""
    text = _norm(genie.get("answer", "") + " " + " ".join(genie.get("facts_used", [])))
    return all(_norm(v) in text for v in verify)


def respond(question: str, ranking: dict | None, data: dict, genie_fn=None) -> dict:
    grounded = answer_question(question, ranking, data)
    verify = grounded.pop("verify", None)
    grounded["source"] = "grounded"
    grounded["headline"] = grounded["answer"].split(". ")[0].rstrip(".") + "."
    if genie_fn is None or _intent(question) == "why":
        return grounded
    try:
        genie = genie_fn(question)
    except Exception:  # noqa: BLE001  Genie down, slow or empty: the table answer still works
        return grounded
    if verify:
        if agrees(verify, genie):
            genie["verified"] = True
        else:
            grounded["note"] = "Genie's answer did not match our price tables, so this answer comes straight from the tables."
            grounded["genie_answer"] = genie.get("answer", "")
            return grounded
    return genie
