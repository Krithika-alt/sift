from data_source import MockData
from matching import match_items

PRODUCTS = MockData().products()


def ids(texts):
    # match each word on its own (a basket with two words for one product is de-duplicated)
    return {t: match_items([t], PRODUCTS)[0][1] for t in texts}


def test_exact_and_fuzzy_matches():
    m = ids(["eggs", "eggz", "greek yoghurt", "Chicken Breast", "oatmeal"])
    assert m["eggs"] == "eggs_large_12"
    assert m["eggz"] == "eggs_large_12"
    assert m["greek yoghurt"] == "greek_yogurt_32"
    assert m["Chicken Breast"] == "chicken_breast_lb"
    assert m["oatmeal"] == "oats_42oz"


def test_unknown_item_returns_none():
    assert ids(["unobtainium"])["unobtainium"] is None


def test_duplicates_collapse_to_one_product():
    result = match_items(["eggs", "dozen eggs"], PRODUCTS)
    assert len([pid for _, pid in result if pid == "eggs_large_12"]) == 1
