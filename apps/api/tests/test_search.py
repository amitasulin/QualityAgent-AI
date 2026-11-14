"""Global search helpers (no database required)."""
from app.api.v1.search import escape_like


def test_escape_like_escapes_wildcards():
    assert escape_like("100%") == "100\\%"
    assert escape_like("a_b") == "a\\_b"
    assert escape_like("c:\\temp") == "c:\\\\temp"


def test_escape_like_keeps_regular_text():
    assert escape_like("מכולה") == "מכולה"
    assert escape_like("NCR-1052") == "NCR-1052"
    assert escape_like("") == ""
