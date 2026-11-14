"""reset_demo.py against a stand-in database (no Databricks needed)."""
from data_source import MockData
from reset_demo import run_reset


class FakeDB:
    host, catalog, schema = "fake.cloud.databricks.com", "sift", "main"

    def __init__(self, fail_delete=False, keep_view_crowd=False):
        self.mock = MockData()
        self.fail_delete = fail_delete
        self.keep_view_crowd = keep_view_crowd
        self.deleted = False

    def _t(self, table): return f"sift.main.{table}"
    def stores(self): return self.mock.stores()
    def products(self): return self.mock.products()
    def add_ping(self, *a): return self.mock.add_ping(*a)

    def latest_prices(self):
        rows = self.mock.latest_prices()
        if self.keep_view_crowd and rows:
            rows[0]["source"] = "crowd"
        return rows

    def _query(self, stmt, params=None):
        if "COUNT(*) AS n FROM sift.main.price_pings" in stmt:
            return [{"n": len(self.mock._pings)}]
        if stmt.startswith("DELETE FROM sift.main.price_pings"):
            if self.fail_delete:
                return []                    # pretend the delete did nothing
            self.mock._pings.clear()
            self.deleted = True
            return []
        raise AssertionError(f"unexpected SQL: {stmt}")


def two_pings(db):
    db.add_ping("trader_joes_monroe", "eggs_large_12", 2.49, True)
    db.add_ping("target_state_st", "oats_42oz", 1.99, True)


def test_yes_flag_clears_all_pings_and_shows_start_state(capsys):
    db = FakeDB(); two_pings(db)
    assert run_reset(db, assume_yes=True) == 0
    out = capsys.readouterr().out
    assert db.mock._pings == [] and "deleted 2 ping(s)" in out
    assert "Default weights" in out and "Distance slider up" in out
    assert "simulated" in out                     # honesty reminder (mock data is all simulated)


def test_asks_for_confirmation_and_cancel_deletes_nothing(capsys):
    db = FakeDB(); two_pings(db)
    assert run_reset(db, ask=lambda _: "no") == 1
    assert len(db.mock._pings) == 2 and "Cancelled" in capsys.readouterr().out


def test_typing_yes_deletes(capsys):
    db = FakeDB(); two_pings(db)
    assert run_reset(db, ask=lambda _: "YES") == 0
    assert db.mock._pings == []


def test_no_input_available_counts_as_no():
    db = FakeDB(); two_pings(db)
    def eof(_): raise EOFError
    assert run_reset(db, ask=eof) == 1 and len(db.mock._pings) == 2


def test_already_clean_needs_no_confirmation(capsys):
    db = FakeDB()
    assert run_reset(db, ask=lambda _: (_ for _ in ()).throw(AssertionError("should not ask"))) == 0
    assert "nothing to delete" in capsys.readouterr().out


def test_failed_delete_is_reported(capsys):
    db = FakeDB(fail_delete=True); two_pings(db)
    assert run_reset(db, assume_yes=True) == 1
    assert "still there" in capsys.readouterr().out


def test_leftover_crowd_rows_in_view_warn(capsys):
    db = FakeDB(keep_view_crowd=True)
    assert run_reset(db, assume_yes=True) == 0
    assert "source='crowd'" in capsys.readouterr().out
