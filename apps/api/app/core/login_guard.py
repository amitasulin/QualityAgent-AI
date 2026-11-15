"""In-memory login throttling.

Counts failed sign-ins per client IP and per email address, and temporarily
locks a key after too many failures. State lives in this process, which matches
the current single-instance deployment; the class is small enough to swap for a
Redis-backed implementation later without touching the routes.
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Callable, Iterable, Optional

from fastapi import Request

from app.core.config import settings


@dataclass
class _State:
    failures: list[float] = field(default_factory=list)
    locked_until: float = 0.0


class LoginGuard:
    def __init__(
        self,
        max_attempts: int = 5,
        window_seconds: int = 15 * 60,
        lockout_seconds: int = 15 * 60,
        max_keys: int = 10_000,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_attempts = max(1, max_attempts)
        self.window_seconds = max(1, window_seconds)
        self.lockout_seconds = max(1, lockout_seconds)
        self.max_keys = max(100, max_keys)
        self._clock = clock
        self._states: dict[str, _State] = {}
        self._lock = Lock()

    def check(self, keys: Iterable[str]) -> int:
        """Return seconds until the key may retry, or 0 when it is allowed."""
        now = self._clock()
        retry_after = 0
        with self._lock:
            for key in keys:
                state = self._states.get(key)
                if not state:
                    continue
                self._prune(state, now)
                if state.locked_until > now:
                    retry_after = max(retry_after, math.ceil(state.locked_until - now))
        return retry_after

    def record_failure(self, keys: Iterable[str]) -> None:
        now = self._clock()
        with self._lock:
            self._shrink_if_needed(now)
            for key in keys:
                state = self._states.setdefault(key, _State())
                self._prune(state, now)
                state.failures.append(now)
                if len(state.failures) >= self.max_attempts:
                    state.locked_until = now + self.lockout_seconds
                    state.failures.clear()

    def reset(self, keys: Iterable[str]) -> None:
        with self._lock:
            for key in keys:
                self._states.pop(key, None)

    def _prune(self, state: _State, now: float) -> None:
        cutoff = now - self.window_seconds
        state.failures = [stamp for stamp in state.failures if stamp >= cutoff]

    def _shrink_if_needed(self, now: float) -> None:
        """Drop expired keys so a public endpoint cannot grow memory forever."""
        if len(self._states) < self.max_keys:
            return
        for key in list(self._states):
            state = self._states[key]
            self._prune(state, now)
            if not state.failures and state.locked_until <= now:
                del self._states[key]


def client_ip(request: Request) -> str:
    """Real client IP, including deployments behind a reverse proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def login_keys(request: Request, email: Optional[str]) -> list[str]:
    """Throttle both the source IP and the targeted account."""
    keys = [f"ip:{client_ip(request)}"]
    if email:
        keys.append(f"email:{email.strip().lower()}")
    return keys


login_guard = LoginGuard(
    max_attempts=settings.LOGIN_MAX_ATTEMPTS,
    window_seconds=settings.LOGIN_WINDOW_MINUTES * 60,
    lockout_seconds=settings.LOGIN_LOCKOUT_MINUTES * 60,
)
