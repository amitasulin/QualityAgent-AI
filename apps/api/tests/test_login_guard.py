"""Login throttling (no database required)."""
from starlette.requests import Request

from app.core.login_guard import LoginGuard, client_ip, login_keys


def _guard(max_attempts: int = 3) -> tuple[LoginGuard, list[float]]:
    now = [1000.0]
    guard = LoginGuard(
        max_attempts=max_attempts,
        window_seconds=60,
        lockout_seconds=120,
        clock=lambda: now[0],
    )
    return guard, now


def _request(ip: str = "1.2.3.4", forwarded: str | None = None) -> Request:
    headers = []
    if forwarded:
        headers.append((b"x-forwarded-for", forwarded.encode()))
    return Request(
        {"type": "http", "method": "POST", "path": "/api/v1/auth/login", "headers": headers, "client": (ip, 1234)}
    )


def test_allows_attempts_below_the_threshold():
    guard, _ = _guard()
    guard.record_failure(["ip:1"])
    guard.record_failure(["ip:1"])
    assert guard.check(["ip:1"]) == 0


def test_locks_after_reaching_the_threshold():
    guard, _ = _guard()
    for _ in range(3):
        guard.record_failure(["ip:1"])
    assert guard.check(["ip:1"]) == 120


def test_lock_expires_and_gives_fresh_attempts():
    guard, now = _guard()
    for _ in range(3):
        guard.record_failure(["ip:1"])
    now[0] += 121
    assert guard.check(["ip:1"]) == 0
    guard.record_failure(["ip:1"])
    assert guard.check(["ip:1"]) == 0


def test_successful_login_resets_the_counter():
    guard, _ = _guard()
    guard.record_failure(["ip:1"])
    guard.record_failure(["ip:1"])
    guard.reset(["ip:1"])
    guard.record_failure(["ip:1"])
    guard.record_failure(["ip:1"])
    assert guard.check(["ip:1"]) == 0


def test_old_failures_fall_outside_the_window():
    guard, now = _guard()
    guard.record_failure(["ip:1"])
    guard.record_failure(["ip:1"])
    now[0] += 61
    guard.record_failure(["ip:1"])
    assert guard.check(["ip:1"]) == 0


def test_each_key_is_throttled_independently():
    guard, _ = _guard()
    for _ in range(3):
        guard.record_failure(["ip:1", "email:a@example.com"])
    assert guard.check(["ip:1"]) == 120
    assert guard.check(["ip:2"]) == 0


def test_many_keys_do_not_raise():
    guard = LoginGuard(max_attempts=2, window_seconds=60, lockout_seconds=60, max_keys=100)
    for index in range(150):
        guard.record_failure([f"ip:{index}"])
    assert guard.check(["ip:999"]) == 0


def test_client_ip_prefers_forwarded_header():
    assert client_ip(_request(forwarded="8.8.8.8, 10.0.0.1")) == "8.8.8.8"
    assert client_ip(_request(ip="1.2.3.4")) == "1.2.3.4"


def test_login_keys_normalise_email_and_include_ip():
    keys = login_keys(_request(ip="1.2.3.4"), "  Demo@Example.com ")
    assert keys == ["ip:1.2.3.4", "email:demo@example.com"]
