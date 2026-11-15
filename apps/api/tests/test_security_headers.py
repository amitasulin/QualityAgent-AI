"""Baseline security headers middleware (no database required)."""
import asyncio

from app.core.security_headers import HEADERS, SecurityHeadersMiddleware


def _run(scope):
    sent = []

    async def app(scope, receive, send):
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": b"{}"})

    async def send(message):
        sent.append(message)

    middleware = SecurityHeadersMiddleware(app)
    asyncio.run(middleware(scope, None, send))
    return sent


def test_adds_security_headers_without_dropping_existing_ones():
    sent = _run({"type": "http", "method": "GET", "path": "/health"})
    headers = dict(sent[0]["headers"])
    assert headers[b"content-type"] == b"application/json"
    for key, value in HEADERS:
        assert headers[key] == value


def test_keeps_headers_set_by_the_application():
    sent = []

    async def app(scope, receive, send):
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"x-frame-options", b"SAMEORIGIN")],
            }
        )

    async def send(message):
        sent.append(message)

    asyncio.run(SecurityHeadersMiddleware(app)({"type": "http"}, None, send))
    assert dict(sent[0]["headers"])[b"x-frame-options"] == b"SAMEORIGIN"
