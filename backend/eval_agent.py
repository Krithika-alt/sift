"""Score the Sift assistant against questions whose answers are computed from the real tables.

    python eval_agent.py                    # Genie and our table-based fallback, 12 questions each
    python eval_agent.py --agent genie --n 20
    python eval_agent.py --dry-run          # print the questions and expected answers only
    python eval_agent.py --tracking databricks   # also log the scores to MLflow

Expected answers are computed from the live tables (not hard-coded), so the test set stays
valid when prices change. A question passes when every expected fact (store name, price, product)
appears in the agent's answer or in the rows it returned. This is a measurement of how good
the agent is, and the score is what you tune the Genie space against. Nothing here is trained.
"""
from __future__ import annotations

import argparse
import os
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from assistant import answer_question

TYPES = ["cheapest", "compare", "stock", "protein", "swap"]


def _short(store_name: str) -> str:
    return store_name.split(" (")[0].lower()


def _money(x: float) -> str:
    return f"{x:.2f}"


def build_cases(stores: list, products: list, prices: list) -> list:
    """One list of {id, type, question, expected:[str]} computed from the tables."""
    sname = {s["store_id"]: s["name"] for s in stores}
    pmap = {p["product_id"]: p for p in products}
    latest = {}
    for r in prices:
        key = (r["store_id"], r["product_id"])
        if key not in latest or (r.get("observed_at") and latest[key].get("observed_at")
                                 and r["observed_at"] > latest[key]["observed_at"]):
            latest[key] = r
    stocked: dict = {}
    for (sid, pid), r in latest.items():
        if r.get("in_stock") and r.get("price") is not None and sid in sname:
            stocked.setdefault(pid, []).append((r["price"], sid))

    by_type: dict = {t: [] for t in TYPES}
    for pid in sorted(stocked):
        name = pmap.get(pid, {}).get("name", pid)
        rows = sorted(stocked[pid])
        if len(rows) >= 2 and rows[0][0] < rows[1][0] - 0.005:
            by_type["cheapest"].append({
                "id": f"cheapest:{pid}", "type": "cheapest",
                "question": f"Which store has the cheapest {name}?",
                "expected": [_short(sname[rows[0][1]]), _money(rows[0][0])]})
        if len(rows) >= 2 and rows[-1][0] - rows[0][0] > 0.005:
            lo, hi = rows[0], rows[-1]
            by_type["compare"].append({
                "id": f"compare:{pid}", "type": "compare",
                "question": (f"Is {name} cheaper at {sname[lo[1]]} or {sname[hi[1]]}, and by how much?"),
                "expected": [_short(sname[lo[1]]), _money(hi[0] - lo[0])]})
        have = {sid for _, sid in rows}
        lacking = [sid for sid in sname if sid not in have]
        if lacking and len(lacking) < len(sname) - 0:
            by_type["stock"].append({
                "id": f"stock:{pid}", "type": "stock",
                "question": f"Which stores do not have {name} in stock?",
                "expected": [_short(sname[s]) for s in lacking]})

    # lowest unit price among protein items, per unit
    prot: dict = {}
    for (sid, pid), r in latest.items():
        p = pmap.get(pid, {})
        if (p.get("category") or "").lower() == "protein" and r.get("in_stock") and r.get("unit_price") is not None:
            prot.setdefault(r.get("unit") or p.get("size_unit"), []).append((r["unit_price"], pid))
    for unit, rows in sorted(prot.items(), key=lambda kv: str(kv[0])):
        rows.sort()
        if len({pid for _, pid in rows}) >= 2 and rows[0][0] < rows[1][0] - 1e-9 and rows[0][1] != rows[1][1]:
            nm = pmap[rows[0][1]]["name"].split(",")[0].lower()
            by_type["protein"].append({
                "id": f"protein:{unit}", "type": "protein",
                "question": f"Which protein item has the lowest unit price per {unit}?",
                "expected": [nm]})

    # store-brand vs name-brand pairs (needs a brand_tier column)
    for sid in sorted(sname):
        for sp in products:
            if sp.get("brand_tier") != "store":
                continue
            for np_ in products:
                if (np_.get("brand_tier") == "name" and np_.get("category") == sp.get("category")
                        and np_.get("size_value") == sp.get("size_value")
                        and np_.get("size_unit") == sp.get("size_unit")):
                    a, b = latest.get((sid, sp["product_id"])), latest.get((sid, np_["product_id"]))
                    if a and b and a.get("in_stock") and b.get("in_stock") and a["price"] and b["price"]:
                        by_type["swap"].append({
                            "id": f"swap:{sid}:{sp['product_id']}:{np_['product_id']}", "type": "swap",
                            "question": (f"At {sname[sid]}, is the store-brand {sp['name']} cheaper than the "
                                         f"name-brand {np_['name']}? Give both prices."),
                            "expected": [_money(a["price"]), _money(b["price"])]})
    return by_type_round_robin(by_type)


def by_type_round_robin(by_type: dict) -> list:
    out, i = [], 0
    while any(by_type.values()):
        t = TYPES[i % len(TYPES)]
        if by_type[t]:
            out.append(by_type[t].pop(0))
        i += 1
    return out


def grade(case: dict, response: dict) -> bool:
    text = (response.get("answer", "") + " " + " ".join(response.get("facts_used", []))).lower().replace("$", "")
    return all(e.lower() in text for e in case["expected"])


def make_agents(data: dict) -> dict:
    def genie_agent(q: str) -> dict:
        from genie import ask_genie
        return ask_genie(q, stores=data["stores"])

    def grounded_agent(q: str) -> dict:
        return answer_question(q, None, data)
    return {"genie": genie_agent, "grounded": grounded_agent}


def run_agent(agent, cases: list, workers: int = 1) -> list:
    def one(case):
        t0 = time.time()
        try:
            resp = agent(case["question"])
            err = None
        except Exception as e:  # noqa: BLE001
            resp, err = {"answer": "", "facts_used": []}, f"{type(e).__name__}: {str(e)[:120]}"
        return {**case, "passed": err is None and grade(case, resp), "error": err,
                "seconds": round(time.time() - t0, 1), "answer": resp.get("answer", "")[:300]}
    if workers > 1:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            return list(ex.map(one, cases))
    return [one(c) for c in cases]


def summarize(results: list) -> dict:
    n = len(results)
    out = {"n": n, "accuracy": round(sum(r["passed"] for r in results) / n, 3) if n else 0.0,
           "median_seconds": round(statistics.median([r["seconds"] for r in results]), 1) if n else 0.0,
           "errors": sum(1 for r in results if r["error"])}
    for t in TYPES:
        sub = [r for r in results if r["type"] == t]
        if sub:
            out[f"accuracy_{t}"] = round(sum(r["passed"] for r in sub) / len(sub), 3)
    return out


def print_report(name: str, results: list, summary: dict) -> None:
    print(f"\n=== {name}: {sum(r['passed'] for r in results)}/{summary['n']} correct "
          f"({summary['accuracy']:.0%}), median {summary['median_seconds']}s ===")
    for r in results:
        mark = "PASS" if r["passed"] else "FAIL"
        print(f"  {mark}  [{r['type']:<8}] {r['question']}")
        if not r["passed"]:
            print(f"        expected: {', '.join(r['expected'])}")
            print(f"        got:      {r['error'] or r['answer'][:160]}")


def log_to_mlflow(all_summaries: dict, all_results: dict, tracking: str, facts: dict) -> str:
    import mlflow
    from log_mlflow_run import _databricks_env, default_experiment_name
    if tracking == "databricks":
        _databricks_env()
        uri = "databricks"
    else:
        uri = "file:" + os.path.abspath("mlruns")
    exp = default_experiment_name(tracking).replace("sift-scoring", "sift-agent-eval")
    mlflow.set_tracking_uri(uri)
    mlflow.set_experiment(exp)
    run_name = "agent-eval-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    with mlflow.start_run(run_name=run_name):
        mlflow.set_tags({"project": "sift", "event": "MadHacks 2026",
                         "what": "answer accuracy against expected answers computed from the tables"})
        mlflow.log_params({"agents": ",".join(all_summaries), **facts})
        for agent, s in all_summaries.items():
            mlflow.log_metrics({f"{agent}_{k}": v for k, v in s.items()})
        try:
            import csv
            import io
            for agent, res in all_results.items():
                buf = io.StringIO()
                w = csv.DictWriter(buf, fieldnames=["id", "type", "question", "expected", "passed", "error", "seconds", "answer"])
                w.writeheader()
                for r in res:
                    w.writerow({k: (", ".join(r[k]) if k == "expected" else r.get(k)) for k in w.fieldnames})
                mlflow.log_text(buf.getvalue(), f"{agent}_cases.csv")
        except Exception as e:  # noqa: BLE001
            print(f"  WARN  could not upload artifacts: {str(e)[:120]}")
    return f"{exp} / {run_name}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Evaluate the Sift assistant")
    ap.add_argument("--agent", choices=["genie", "grounded", "both"], default="both")
    ap.add_argument("--n", type=int, default=12, help="number of questions (default 12)")
    ap.add_argument("--workers", type=int, default=3, help="parallel Genie calls (default 3)")
    ap.add_argument("--dry-run", action="store_true", help="print the questions, call nothing")
    ap.add_argument("--tracking", choices=["databricks", "local", "none"], default="none",
                    help="log scores to MLflow (default: do not log)")
    args = ap.parse_args()

    from data_source import get_data_source
    ds = get_data_source()
    data = {"stores": ds.stores(), "products": ds.products(), "prices": ds.latest_prices()}
    cases = build_cases(**data)[: args.n]
    facts = {"data_source": type(ds).__name__, "n_stores": len(data["stores"]),
             "n_products": len(data["products"]), "n_cases": len(cases)}
    print(f"{len(cases)} questions built from {facts['n_stores']} stores / {facts['n_products']} products")
    if not cases:
        print("FAIL  could not build any questions from the tables")
        return 1
    if args.dry_run:
        for c in cases:
            print(f"  [{c['type']:<8}] {c['question']}  ->  {', '.join(c['expected'])}")
        return 0

    from genie import genie_enabled
    agents = make_agents(data)
    names = ["genie", "grounded"] if args.agent == "both" else [args.agent]
    if "genie" in names and not genie_enabled():
        print("WARN  Genie is not configured (GENIE_SPACE_ID / DATABRICKS_* in backend/.env); skipping it")
        names.remove("genie")
    summaries, results = {}, {}
    for name in names:
        print(f"\nRunning {name} ({'parallel x' + str(args.workers) if name == 'genie' else 'instant'})...")
        res = run_agent(agents[name], cases, workers=args.workers if name == "genie" else 1)
        results[name], summaries[name] = res, summarize(res)
        print_report(name, res, summaries[name])
    if args.tracking != "none" and summaries:
        try:
            print("\nLogged to MLflow:", log_to_mlflow(summaries, results, args.tracking, facts))
        except Exception as e:  # noqa: BLE001
            print(f"\nFAIL  MLflow logging failed: {str(e).splitlines()[0][:200]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
