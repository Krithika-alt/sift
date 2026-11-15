import genie

STORES = [{"store_id": "pick_n_save_park", "name": "Pick 'n Save (Park St)"},
          {"store_id": "target_state_st", "name": "Target (State St)"}]


def test_store_hint_lists_ids_and_warns_about_apostrophes():
    h = genie.store_hint(STORES)
    assert "pick_n_save_park = Pick 'n Save (Park St)" in h and "store_id" in h and "apostrophes" in h
    assert genie.store_hint(None) == ""


def test_question_includes_hint_with_and_without_basket():
    q1 = genie.build_question("Which store is cheapest for eggs?", None, STORES)
    assert q1.startswith("Store ids") and "cheapest for eggs" in q1
    rk = {"ranked_stores": [{"name": "Target", "items_breakdown": [{"name": "Eggs"}]}]}
    q2 = genie.build_question("What can I swap to save money?", rk, STORES)
    assert "pick_n_save_park" in q2 and "Eggs" in q2
    assert "Store ids" not in genie.build_question("q", None)
