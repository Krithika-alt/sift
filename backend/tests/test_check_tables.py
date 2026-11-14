"""check_tables.py against a stand-in database (no Databricks needed)."""
from check_tables import REQUIRED_COLUMNS, run_checks
from data_source import MockData


class FakeDB:
    host, catalog, schema = "fake.cloud.databricks.com", "sift", "main"

    def __init__(self, view_honors_pings=True, drop_column=None, empty=False):
        self.mock = MockData()
        self.view_honors_pings = view_honors_pings
        self.drop_column = drop_column      # (table, column)
        self.empty = empty

    def _t(self, table):
        return f"sift.main.{table}"

    def stores(self): return self.mock.stores()
    def products(self): return self.mock.products()
    def add_ping(self, *a): return self.mock.add_ping(*a)

    def latest_prices(self):
        if self.view_honors_pings:
            return self.mock.latest_prices()
        return [dict(r) for r in self.mock._prices]

    def _query(self, stmt, params=None):
        if stmt == "SELECT 1":
            return [{"1": 1}]
        if stmt.startswith("DESCRIBE TABLE"):
            table = stmt.split(".")[-1]
            cols = [c for c in REQUIRED_COLUMNS[table] if (table, c) != self.drop_column]
            return ([{"col_name": c, "data_type": "string"} for c in cols]
                    + [{"col_name": "", "data_type": ""}, {"col_name": "# Partition", "data_type": ""}])
        if "GROUP BY source" in stmt:
            return [{"source": "simulated", "n": 60}, {"source": "website", "n": 12}]
        if stmt.startswith("DELETE FROM"):
            self.mock._pings = [p for p in self.mock._pings if p["ping_id"] != params["ping_id"]]
            return []
        if "COUNT(*) AS n" in stmt:
            if "WHERE" in stmt or "LEFT ANTI" in stmt:
                return [{"n": 0}]
            table = stmt.split("FROM sift.main.")[1].split()[0]
            return [{"n": 0 if self.empty or table == "price_pings" else 72}]
        raise AssertionError(f"unexpected SQL: {stmt}")


def test_healthy_tables_pass_and_clean_up(capsys):
    db = FakeDB()
    rep = run_checks(db)
    out = capsys.readouterr().out
    assert not rep.failed and rep.counts["WARN"] == 0
    assert "source='crowd'" in out
    assert db.mock._pings == []            # test ping was deleted


def test_view_that_ignores_pings_fails(capsys):
    rep = run_checks(FakeDB(view_honors_pings=False))
    assert rep.failed
    assert "newer ping override" in capsys.readouterr().out


def test_missing_column_fails(capsys):
    rep = run_checks(FakeDB(drop_column=("prices", "unit_price")))
    assert rep.failed
    assert "unit_price" in capsys.readouterr().out


def test_empty_tables_warn_but_do_not_fail(capsys):
    rep = run_checks(FakeDB(empty=True))
    assert not rep.failed and rep.counts["WARN"] >= 3
    assert "EMPTY" in capsys.readouterr().out


def test_no_write_mode_writes_nothing():
    db = FakeDB()
    run_checks(db, write_test=False)
    assert db.mock._pings == []
