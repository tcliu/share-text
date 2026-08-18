from app.settings import _read_number


def test_strips_thousand_separators():
    assert _read_number("1,000") == 1000
    assert _read_number(" 2,500 ") == 2500


def test_within_bounds():
    assert _read_number("50") == 50
    assert _read_number("500") == 500
    assert _read_number("5000") == 5000


def test_out_of_bounds_returns_none():
    assert _read_number("49") is None
    assert _read_number("5001") is None


def test_non_integer_returns_none():
    assert _read_number("abc") is None
    assert _read_number("1.5") is None


def test_none_returns_none():
    assert _read_number(None) is None
