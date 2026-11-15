"""Score the voice-list parser on messy spoken lists (no Databricks needed).

    python eval_voice.py                      # new parser vs the old plain fuzzy matcher
    python eval_voice.py --tracking local     # also log to MLflow (experiment sift-voice-eval)
    python eval_voice.py --tracking databricks

Each case is a transcript like speech-to-text would produce (with typical mishearings) and the
items it should give back. Expected items are named by a search term ("milk"), looked up in the
live product table, so the same cases work on mock and real data. Cases that need a product
the table does not have are skipped and counted.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

from matching import _norm, build_term_index, match_items
from parse_list import parse_list, split_list

# (transcript, other speech guesses, [(term, quantity) or (None, qty) = should be unmatched])
CASES = [
    ("milk, eggs and bread", [], [("milk", 1), ("eggs", 1), ("bread", 1)]),
    ("I need two gallons of milk and a dozen eggs", [], [("milk", 2), ("eggs", 1)]),
    ("um add three bananas and some rice please", [], [("bananas", 3), ("rice", 1)]),
    ("get me peanut butter, pasta and ramen", [], [("peanut butter", 1), ("pasta", 1), ("ramen", 1)]),
    ("a couple of bananas and a few apples", [], [("bananas", 2), (None, 3)]),
    ("two loaves of bread", [], [("bread", 2)]),
    ("toilet paper and milk to my list", [], [("toilet paper", 1), ("milk", 1)]),
    ("5 eggs", [], [("eggs", 5)]),
    # mishearings
    ("bred and milk", [], [("bread", 1), ("milk", 1)]),
    ("I want rise and pasto", [], [("rice", 1), ("pasta", 1)]),
    ("ramon noodles and eggz", [], [("ramen", 1), ("eggs", 1)]),
    ("raman and bananer", [], [("ramen", 1), ("bananas", 1)]),
    ("tee pee and melk", [], [("toilet paper", 1), ("milk", 1)]),
    ("yogert and peanut but her", [], [("greek yogurt", 1), ("peanut butter", 1)]),
    ("greek yoghurt, bannanas", [], [("greek yogurt", 1), ("bananas", 1)]),
    ("chicken brest and oat meal", [], [("chicken breast", 1), ("oatmeal", 1)]),
    ("banana's, egg's and milk's", [], [("bananas", 1), ("eggs", 1), ("milk", 1)]),
    ("two bred and three rise", [], [("bread", 2), ("rice", 3)]),
    ("top ramen and spaghetti noodles", [], [("ramen", 1), ("pasta", 1)]),
    ("bathroom tissue and a gallon of milk", [], [("toilet paper", 1), ("milk", 1)]),
    ("ramen noodles, bred, two peanut butters", [], [("ramen", 1), ("bread", 1), ("peanut butter", 2)]),
    # speech engine alternatives rescue a bad first guess
    ("brod and mill", ["bread and milk"], [("bread", 1), ("milk", 1)]),
    ("rams and eggs", ["ramen and eggs"], [("ramen", 1), ("eggs", 1)]),
    # things we do not sell must NOT be matched to something else
    ("unobtainium", [], [(None, 1)]),
    ("milk and dragonfruit", [], [("milk", 1), (None, 1)]),
    ("something weird and eggs", [], [(None, 1), ("eggs", 1)]),
    ("orange juice and bread", [], [(None, 1), ("bread", 1)]),
    ("ice cream", [], [(None, 1)]),
    # spoken fillers
    ("hey so I'm getting milk, then eggs, also bread", [], [("milk", 1), ("eggs", 1), ("bread", 1)]),
    ("okay let's get rice and pasta and ramen", [], [("rice", 1), ("pasta", 1), ("ramen", 1)]),
]


def _expected(case, index):
    """Resolve terms to product_ids; None if the table lacks the product (skip the case)."""
    out = []
    for term, qty in case[2]:
        if term is None:
            out.append((None, qty))
        else:
            pid = index.get(_norm(term))
            if pid is None:
                return None
            out.append((pid, qty))
    return out


def _new(case, products):
    r = parse_list(case[0], products, case[1])
    return [(i["product_id"], i["quantity"], i["needs_confirm"]) for i in r["items"]]


def _old(case, products):
    """The previous behaviour: split, then plain fuzzy matching, no aliases, no alternatives."""
    out = []
    for piece in split_list(case[0], products):
        m = match_items([piece["text"]], products)
        out.append((m[0][1] if m else None, piece["quantity"], False))
    return out


def score(runner, cases, products):
    index = build_term_index(products)
    items = right = wrong_silent = asked = perfect = used = skipped = 0
    detail = []
    for case in cases:
        exp = _expected(case, index)
        if exp is None:
            skipped += 1
            continue
        used += 1
        got = runner(case, products)
        ok_case = len(got) == len(exp)
        for k, (pid, qty) in enumerate(exp):
            items += 1
            g = got[k] if k < len(got) else (None, 0, False)
            good = g[0] == pid and (pid is None or g[1] == qty)
            right += good
            if not good and g[0] is not None and not g[2]:
                wrong_silent += 1          # confident and wrong: the worst outcome
            if g[0] is not None and g[2]:
                asked += 1                 # matched but asked the user to confirm
            ok_case = ok_case and good
        perfect += ok_case
        detail.append((case[0], ok_case))
    return {"cases": used, "skipped": skipped, "items": items,
            "item_accuracy": round(right / items, 4) if items else 0.0,
            "perfect_lists": perfect, "list_accuracy": round(perfect / used, 4) if used else 0.0,
            "confident_wrong": wrong_silent, "asked_to_confirm": asked}, detail


def log_to_mlflow(summaries: dict, tracking: str) -> str:
    import mlflow
    from log_mlflow_run import _databricks_env, default_experiment_name
    if tracking == "databricks":
        _databricks_env()
        uri = "databricks"
    else:
        uri = "file:" + os.path.abspath("mlruns")
    exp = default_experiment_name(tracking).replace("sift-scoring", "sift-voice-eval")
    mlflow.set_tracking_uri(uri)
    mlflow.set_experiment(exp)
    name = "voice-eval-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    with mlflow.start_run(run_name=name):
        mlflow.set_tags({"project": "sift", "event": "MadHacks 2026",
                         "what": "voice list parsing on messy spoken lists"})
        mlflow.log_params({"parsers": ",".join(summaries), "cases": len(CASES)})
        for parser, s in summaries.items():
            mlflow.log_metrics({f"{parser}_{k}": v for k, v in s.items()})
    return f"{exp} / {name}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Evaluate Sift's voice-list parser")
    ap.add_argument("--tracking", choices=["databricks", "local", "none"], default="none")
    ap.add_argument("--verbose", action="store_true", help="list the lists that failed")
    args = ap.parse_args()
    from data_source import get_data_source
    products = get_data_source().products()
    summaries = {}
    for label, runner in (("old", _old), ("new", _new)):
        s, detail = score(runner, CASES, products)
        summaries[label] = s
        print(f"\n{label.upper()} parser: {s['items']} items in {s['cases']} lists "
              f"({s['skipped']} lists skipped: product not in table)")
        print(f"  item accuracy   {s['item_accuracy']:.0%}")
        print(f"  perfect lists   {s['perfect_lists']}/{s['cases']}")
        print(f"  confident wrong {s['confident_wrong']}   (matched the wrong product without asking)")
        print(f"  asked to confirm {s['asked_to_confirm']}")
        if args.verbose:
            for text, ok in detail:
                if not ok:
                    print("   FAIL:", text)
    if args.tracking != "none":
        try:
            print("\nLogged to MLflow:", log_to_mlflow(summaries, args.tracking))
        except Exception as e:  # noqa: BLE001
            print("\nCould not log to MLflow:", str(e)[:200])
    return 0


if __name__ == "__main__":
    sys.exit(main())
