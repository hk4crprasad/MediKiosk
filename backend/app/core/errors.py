from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    def __init__(
        self, code: str, message: str, status_code: int = 400, details: list[dict[str, Any]] | None = None
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {"code": exc.code, "message": exc.message, "details": exc.details},
            "request_id": getattr(request.state, "request_id", None),
        },
    )
