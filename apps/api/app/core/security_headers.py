"""Baseline security response headers for the API.

The frontend sets the same headers in ``next.config.js``. The API is JSON-only,
so a strict frame policy and MIME sniffing protection are safe here.
"""
from starlette.types import ASGIApp, Message, Receive, Scope, Send

HEADERS = (
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                existing = {key.lower() for key, _ in headers}
                headers.extend((key, value) for key, value in HEADERS if key not in existing)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)
