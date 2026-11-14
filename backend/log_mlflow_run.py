#!/usr/bin/env python3
"""Log a Sift scoring run to MLflow (shows up under Experiments in Databricks).

What this logs, honestly: Sift's ranker is a weighted scoring formula with
user-tunable weights, NOT a trained model. The run records the default weights,
the formula, how the data was sourced (real vs simulated prices), and what the
ranking does on 5 test baskets, including a sweep of the distance weight that
shows when the #1 store flips.

Run from the backend folder (venv active):

    pip install -r requirements-mlflow.txt      # once
    python log_mlflow_run.py --dry-run          # just print results, log nothing
    python log_mlflow_run.py                    # log to Databricks (uses backend/.env)
    python log_mlflow_run.py --tracking local   # log to ./mlruns instead
    python log_mlflow_run.py --source mock      # use the fake data (labeled simulated)

It never prints your token.
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from matching import match_items  # noqa: E402
from scoring import DEFAULT_WEIGHTS, normalize_weights, rank_stores  # noqa: E402

GRAINGER_HALL = {"lat": 43.0731, "lon": -89.4012}
FORMULA = ("score = w_p*(cheapest_total/store_total) + w_d*(1 - d/d_max) "
           "+ w_s*in_stock_share + w_m*best_unit_price_share")
BASKETS = {
    "b1_hero": ["eggs", "oats", "greek yogurt", "chicken breast", "bananas"],
    "b2_protein": ["chicken breast", "eggs", "greek yogurt", "peanut butter", "milk"],
    "b3_dorm_staples": ["ramen", "rice", "pasta", "bread", "peanut butter"],
    "b4_breakfast": ["oats", "milk", "bananas", "eggs", "bread"],
    "b5_household": ["toilet paper", "bread", "milk", "eggs", "rice"],
}
REAL_SOURCES = {"website", "api"}


def evaluate_baskets(stores, products, prices, baskets=None, user=None, weights=None):
    """Rank every test basket at the given weights and sweep the distance weight."""
    baskets = baskets or BASKETS
    user = user or GRAINGER_HALL
    weights = weights or dict(DEFAULT_WEIGHTS)
    prod_map = {p["product_id"]: p for p in products}
    results, rank_rows, sweep_rows = {}, [], []

    for key, words in baskets.items():
        matched = match_items(words, products)
        unmatched = [q for q, pid in matched if pid is None]
        if not any(pid for _, pid in matched) or not stores:
            results[key] = {"skipped": True, "unmatched": unmatched}
            continue
        ranked = rank_stores(user, matched, weights, None, prices, stores, prod_map)
        top = ranked[0]
        second = ranked[1] if len(ranked) > 1 else None
        cheapest = min(ranked, key=lambda s: s["total_basket_price"])

        winners = []
        for step in range(0, 11):
            wd = round(step / 10, 1)
            sweep = rank_stores(user, matched, {"price": 1 - wd, "distance": wd, "preference": 0.0},
                                None, prices, stores, prod_map)
            winners.append((wd, sweep[0]["store_id"]))
            sweep_rows.append({"basket": key, "distance_weight": wd, "winner": sweep[0]["store_id"]})
        flip_at = next((wd for wd, w in winners if w != winners[0][1]), None)

        results[key] = {
            "skipped": False, "unmatched": unmatched,
            "top_store": top["name"], "top_score": top["ml_rank_score"],
            "top_total": top["total_basket_price"],
            "margin": round(top["ml_rank_score"] - second["ml_rank_score"], 4) if second else 0.0,
            "top_is_cheapest": top["store_id"] == cheapest["store_id"],
            "distinct_winners": len({w for _, w in winners}),
            "flip_at_distance_weight": flip_at,
        }
        for i, s in enumerate(ranked, 1):
            rank_rows.append({"basket": key, "rank": i, "store": s["name"],
                              "score": s["ml_rank_score"], "basket_total": s["total_basket_price"],
                              "distance_miles": s["distance_miles"],
                              "missing_items": "; ".join(s["missing_items"])})

    ran = [r for r in results.values() if not r["skipped"]]
    summary = {"baskets_run": len(ran), "baskets_skipped": len(results) - len(ran)}
    if ran:
        summary.update({
            "mean_top_score": round(sum(r["top_score"] for r in ran) / len(ran), 4),
            "mean_margin_over_second": round(sum(r["margin"] for r in ran) / len(ran), 4),
            "share_top_is_cheapest": round(sum(r["top_is_cheapest"] for r in ran) / len(ran), 3),
            "mean_distinct_winners": round(sum(r["distinct_winners"] for r in ran) / len(ran), 2),
        })
    return {"baskets": results, "summary": summary, "rankings": rank_rows, "sweep": sweep_rows}


def data_facts(stores, products, prices, source_name):
    n = len(prices)
    sim = sum(1 for p in prices if p.get("source") == "simulated")
    real = sum(1 for p in prices if p.get("source") in REAL_SOURCES)
    return {"data_source": source_name, "n_stores": len(stores), "n_products": len(products),
            "n_prices": n, "pct_simulated_prices": round(100 * sim / n, 1) if n else 0.0,
            "pct_real_prices": round(100 * real / n, 1) if n else 0.0}


def _csv_text(rows):
    if not rows:
        return ""
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def log_run(results, facts, weights, tracking_uri, experiment_name, run_name):
    """Write one MLflow run. Returns (run_id, experiment_id)."""
    import mlflow

    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(experiment_name)
    w = normalize_weights(weights)
    with mlflow.start_run(run_name=run_name) as run:
        mlflow.set_tags({
            "project": "sift", "event": "MadHacks 2026",
            "model_type": "weighted scoring formula (not a trained model)",
            "data_is_simulated": str(facts["pct_real_prices"] == 0.0).lower(),
        })
        mlflow.log_params({
            "w_price": round(w["price"], 4), "w_distance": round(w["distance"], 4),
            "w_preference": round(w["preference"], 4), "w_stock": round(w["stock"], 4),
            "formula": FORMULA,
            "distance_metric": "haversine miles, d_max = farthest store (min 1 mile)",
            "missing_item_rule": "counted at highest price seen anywhere, and flagged",
            "test_user_location": "Grainger Hall (43.0731, -89.4012)",
            **{k: v for k, v in facts.items() if k in ("data_source", "n_stores", "n_products", "n_prices")},
        })
        mlflow.log_metrics({
            "pct_simulated_prices": facts["pct_simulated_prices"],
            "pct_real_prices": facts["pct_real_prices"],
            **results["summary"],
        })
        for key, r in results["baskets"].items():
            if r["skipped"]:
                continue
            mlflow.log_metrics({
                f"{key}_top_score": r["top_score"], f"{key}_top_total": r["top_total"],
                f"{key}_margin": r["margin"], f"{key}_distinct_winners": r["distinct_winners"],
                **({f"{key}_flip_at_distance_weight": r["flip_at_distance_weight"]}
                   if r["flip_at_distance_weight"] is not None else {}),
            })
        try:  # a metrics-only run is still useful if artifact upload is not allowed
            mlflow.log_dict({"weights": w, "formula": FORMULA, "facts": facts,
                             "baskets": BASKETS, "summary": results["summary"]}, "scoring_config.json")
            mlflow.log_text(_csv_text(results["rankings"]), "rankings.csv")
            mlflow.log_text(_csv_text(results["sweep"]), "distance_weight_sweep.csv")
        except Exception as e:  # noqa: BLE001
            print(f"  WARN  could not upload artifacts ({str(e).splitlines()[0][:150]}); "
                  "params and metrics were still logged")
        return run.info.run_id, run.info.experiment_id


def _databricks_env() -> str:
    """MLflow reads DATABRICKS_HOST (full URL) and DATABRICKS_TOKEN. Returns the bare host."""
    host = os.environ["DATABRICKS_HOST"].strip().replace("https://", "").replace("http://", "").rstrip("/")
    os.environ["DATABRICKS_HOST"] = f"https://{host}"
    return host


def default_experiment_name(tracking: str) -> str:
    if os.getenv("MLFLOW_EXPERIMENT_NAME"):
        return os.environ["MLFLOW_EXPERIMENT_NAME"]
    if tracking == "local":
        return "sift-scoring"
    try:  # Databricks experiments live under /Users/<your username>/...
        from databricks.sdk import WorkspaceClient
        user = WorkspaceClient(host=os.environ["DATABRICKS_HOST"],
                               token=os.environ["DATABRICKS_TOKEN"]).current_user.me().user_name
        return f"/Users/{user}/sift-scoring"
    except Exception:  # noqa: BLE001
        return "/Shared/sift-scoring"


def print_results(results, facts):
    print(f"\nData: {facts['data_source']} | {facts['n_stores']} stores, {facts['n_products']} products, "
          f"{facts['n_prices']} prices ({facts['pct_real_prices']}% real, {facts['pct_simulated_prices']}% simulated)")
    print(f"\n{'basket':<18}{'#1 store':<28}{'total':>8}{'score':>8}   {'#1 changes at':<16}")
    for key, r in results["baskets"].items():
        if r["skipped"]:
            print(f"{key:<18}SKIPPED (no matching products; unmatched: {r['unmatched']})")
            continue
        flip = r["flip_at_distance_weight"]
        print(f"{key:<18}{r['top_store']:<28}{r['top_total']:>8.2f}{r['top_score']:>8.3f}"
              f"   {('distance weight ' + str(flip)) if flip is not None else 'never':<16}")
        if r["unmatched"]:
            print(f"{'':<18}(no product match for: {', '.join(r['unmatched'])})")
    print("\nSummary:", results["summary"])


def main() -> int:
    ap = argparse.ArgumentParser(description="Log a Sift scoring run to MLflow")
    ap.add_argument("--source", choices=["databricks", "mock"], help="data to rank (default: DATA_SOURCE in .env)")
    ap.add_argument("--tracking", choices=["databricks", "local"], help="where to log (default: databricks if configured)")
    ap.add_argument("--dry-run", action="store_true", help="print results, log nothing")
    args = ap.parse_args()
    if args.source:
        os.environ["DATA_SOURCE"] = args.source

    from data_source import get_data_source  # imported after DATA_SOURCE is final
    try:
        ds = get_data_source()
        stores, products, prices = ds.stores(), ds.products(), ds.latest_prices()
    except Exception as e:  # noqa: BLE001
        print(f"FAIL  could not read the data: {str(e).splitlines()[0][:200]}")
        print("      (use --source mock to run on the fake data)")
        return 1
    source_name = "databricks" if type(ds).__name__ == "DatabricksData" else "mock"
    if not (stores and products and prices):
        print("The tables are empty (waiting for data). Run with --source mock to try the script now.")
        return 1

    results = evaluate_baskets(stores, products, prices)
    facts = data_facts(stores, products, prices, source_name)
    print_results(results, facts)
    if args.dry_run:
        print("\nDry run: nothing logged.")
        return 0

    try:
        import mlflow  # noqa: F401
    except ImportError:
        print("\nFAIL  mlflow is not installed. Run:  pip install -r requirements-mlflow.txt")
        return 1

    have_dbx = all(os.getenv(k) for k in ("DATABRICKS_HOST", "DATABRICKS_TOKEN"))
    tracking = args.tracking or ("databricks" if have_dbx else "local")
    if tracking == "databricks":
        if not have_dbx:
            print("\nFAIL  DATABRICKS_HOST / DATABRICKS_TOKEN missing in backend/.env (or use --tracking local)")
            return 1
        host = _databricks_env()
        uri = "databricks"
    else:
        host, uri = None, "file:" + os.path.abspath("mlruns")
    experiment = default_experiment_name(tracking)
    run_name = "scoring-defaults-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    print(f"\nLogging to MLflow ({tracking}), experiment: {experiment}")
    try:
        run_id, exp_id = log_run(results, facts, dict(DEFAULT_WEIGHTS), uri, experiment, run_name)
    except Exception as e:  # noqa: BLE001
        print(f"FAIL  MLflow logging failed: {str(e).splitlines()[0][:250]}")
        if tracking == "databricks":
            print("      Try --tracking local, or set MLFLOW_EXPERIMENT_NAME=/Users/<your Databricks username>/sift-scoring")
        return 1
    print(f"PASS  logged run {run_name}")
    if host:
        print(f"      Open it: https://{host}/ml/experiments/{exp_id}/runs/{run_id}")
        print("      Or in Databricks: left sidebar > Experiments > sift-scoring")
    else:
        print("      View it with:  mlflow ui   (then open http://localhost:5000)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
