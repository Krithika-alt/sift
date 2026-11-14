"""MLflow run script: the evaluation is tested directly; logging is tested in local mode."""
import pytest

from data_source import MockData
from log_mlflow_run import BASKETS, data_facts, evaluate_baskets, log_run


@pytest.fixture(scope="module")
def data():
    ds = MockData()
    return ds.stores(), ds.products(), ds.latest_prices()


def test_all_five_baskets_are_evaluated(data):
    stores, products, prices = data
    res = evaluate_baskets(stores, products, prices)
    assert set(res["baskets"]) == set(BASKETS)
    assert res["summary"]["baskets_run"] == 5
    assert all(not r["skipped"] for r in res["baskets"].values())
    assert len(res["rankings"]) == 5 * len(stores)
    assert len(res["sweep"]) == 5 * 11


def test_hero_basket_matches_the_demo(data):
    stores, products, prices = data
    hero = evaluate_baskets(stores, products, prices)["baskets"]["b1_hero"]
    assert hero["top_store"] == "Trader Joe's (Monroe St)"
    assert hero["flip_at_distance_weight"] is not None      # distance slider changes the winner
    assert 0 < hero["flip_at_distance_weight"] <= 1
    assert hero["distinct_winners"] >= 2


def test_unmatched_items_are_reported_not_fatal(data):
    stores, products, prices = data
    res = evaluate_baskets(stores, products, prices,
                           baskets={"x": ["eggs", "unobtainium"], "y": ["unobtainium"]})
    assert res["baskets"]["x"]["unmatched"] == ["unobtainium"] and not res["baskets"]["x"]["skipped"]
    assert res["baskets"]["y"]["skipped"]


def test_data_facts_report_simulated_share(data):
    stores, products, prices = data
    f = data_facts(stores, products, prices, "mock")
    assert f["pct_simulated_prices"] == 100.0 and f["pct_real_prices"] == 0.0


def test_log_run_to_local_mlflow(data, tmp_path):
    pytest.importorskip("mlflow")
    from mlflow.tracking import MlflowClient
    stores, products, prices = data
    res = evaluate_baskets(stores, products, prices)
    uri = "file:" + str(tmp_path / "mlruns")
    run_id, _ = log_run(res, data_facts(stores, products, prices, "mock"),
                        {"price": 0.6, "distance": 0.3, "preference": 0.1}, uri, "sift-test", "t1")
    run = MlflowClient(uri).get_run(run_id)
    assert run.data.params["w_price"] == "0.6"
    assert run.data.tags["model_type"].endswith("(not a trained model)")
    assert run.data.tags["data_is_simulated"] == "true"
    assert run.data.metrics["b1_hero_top_score"] > 0
    arts = {a.path for a in MlflowClient(uri).list_artifacts(run_id)}
    assert {"scoring_config.json", "rankings.csv", "distance_weight_sweep.csv"} <= arts
