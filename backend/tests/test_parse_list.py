from data_source import MockData
from parse_list import parse_list, split_list


def texts(s, products=None):
    return [i["text"] for i in split_list(s, products)]


def test_commas_and_and():
    assert texts("milk, eggs and greek yogurt") == ["milk", "eggs", "greek yogurt"]


def test_spoken_filler_and_quantities():
    out = split_list("Um, I need two gallons of milk, a dozen eggs and some bananas please")
    assert [(i["text"], i["quantity"]) for i in out] == [("milk", 2), ("eggs", 1), ("bananas", 1)]


def test_digits_and_trailing_phrase():
    out = split_list("add 3 apples and bread to my list")
    assert [(i["text"], i["quantity"]) for i in out] == [("apples", 3), ("bread", 1)]


def test_then_also_plus_and_dedupe():
    assert texts("milk then eggs also bread plus milk") == ["milk", "eggs", "bread"]


def test_empty_and_noise():
    assert split_list("") == [] and split_list("  um  ") == []


def test_protected_and_phrase():
    prods = [{"product_id": "mc", "name": "Mac and cheese", "search_terms": "mac and cheese"}]
    assert texts("mac and cheese and milk", prods) == ["mac and cheese", "milk"]


def test_parse_matches_and_flags_unmatched():
    m = MockData()
    out = parse_list("eggs, milk and unobtainium", m.products())
    assert [i["matched"] for i in out["items"]][:2] == [True, True]
    assert out["unmatched"] == ["unobtainium"]
    assert out["rank_items"] == ["eggs", "milk", "unobtainium"]


def test_parse_list_endpoint():
    from fastapi.testclient import TestClient
    import main
    r = TestClient(main.app).post("/api/parse-list", json={"text": "I need milk, eggs and something weird"})
    assert r.status_code == 200
    body = r.json()
    assert [i["text"] for i in body["items"]] == ["milk", "eggs", "something weird"]
    assert body["rank_items"][:2] == ["milk", "eggs"]


def test_couple_of():
    out = split_list("a couple of bananas and a few apples")
    assert [(i["text"], i["quantity"]) for i in out] == [("bananas", 2), ("apples", 3)]
