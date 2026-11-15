from data_source import MockData
from parse_list import parse_list
from voice_match import VoiceMatcher, sound

P = MockData().products()


def match(text):
    return VoiceMatcher(P).match(text)


def test_sound_keys():
    assert sound("bread") == sound("bred")
    assert sound("ramen") == sound("ramon") == sound("romaine")
    assert sound("milk") != sound("rice")


def test_exact_alias_fuzzy_phonetic_levels():
    assert match("milk")["match_type"] == "exact" and match("milk")["confidence"] == 100
    assert match("bred")["match_type"] == "alias"
    assert match("sandwhich bread")["match_type"] == "fuzzy"
    m = match("mylk")
    assert m["product_id"] == "milk_gal" and m["match_type"] == "phonetic" and m["needs_confirm"]


def test_unknown_product_is_not_guessed():
    m = match("dragonfruit")
    assert not m["matched"] and m["product_id"] is None
    assert not match("ice cream")["matched"]


def test_weak_match_asks_user_to_confirm():
    m = match("paper towels")
    assert m["matched"] and m["needs_confirm"]          # matched, but flagged, never silent


def test_apostrophe_s():
    assert match("banana's")["product_id"] == "bananas_lb"


def test_quantities_flow_to_rank_items():
    out = parse_list("two bred and three rise", P)
    assert out["rank_items"] == [{"text": "Sandwich bread, 20 oz", "quantity": 2},
                                 {"text": "White rice, 2 lb", "quantity": 3}]


def test_rank_items_resolve_in_ranking_matcher():
    """Names we hand back must match again in /api/rank-stores (which knows no aliases)."""
    from matching import match_items
    out = parse_list("bred, ramon and tee pee", P)
    texts = [r["text"] for r in out["rank_items"]]
    assert all(pid is not None for _, pid in match_items(texts, P))


def test_alternatives_rescue_bad_guess():
    out = parse_list("brod and mill", P, ["bread and milk"])
    assert [i["product_id"] for i in out["items"]] == ["bread_20oz", "milk_gal"]
    assert out["items"][1]["match_type"] == "alternative" and out["items"][1]["needs_confirm"]


def test_unmatched_has_suggestions_field():
    out = parse_list("bred and unobtainium", P)
    assert out["unmatched"] == ["unobtainium"]
    assert all("suggestions" in i and "confidence" in i for i in out["items"])


def test_endpoint_accepts_alternatives():
    from fastapi.testclient import TestClient
    import main
    r = TestClient(main.app).post("/api/parse-list", json={"text": "brod", "alternatives": ["bread"]})
    assert r.status_code == 200 and r.json()["items"][0]["product_id"] == "bread_20oz"


def test_eval_voice_new_beats_old():
    import eval_voice
    new, _ = eval_voice.score(eval_voice._new, eval_voice.CASES, P)
    old, _ = eval_voice.score(eval_voice._old, eval_voice.CASES, P)
    assert new["item_accuracy"] > old["item_accuracy"] and new["confident_wrong"] == 0
