import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.core.errors import DomainError, domain_error_handler
from app.core.security import hash_password
from app.models import User  # ensures all models register with Base metadata
from app.models.entities import UserRole
from app.routers import assistive, auth, clinical, documents, encounters, fhir, health, intake, summaries

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


async def ensure_bootstrap_admin() -> None:
    async with SessionLocal() as session:
        existing = await session.scalar(select(User).where(User.email == settings.bootstrap_admin_email.lower()))
        if existing is None:
            session.add(
                User(
                    email=settings.bootstrap_admin_email.lower(),
                    password_hash=hash_password(settings.bootstrap_admin_password),
                    role=UserRole.admin,
                )
            )
            await session.commit()
            logger.warning("Created bootstrap administrator; rotate BOOTSTRAP_ADMIN_PASSWORD before shared use.")


async def apply_development_schema_repairs() -> None:
    """Idempotent compatibility repair for the existing hackathon development database.

    Formal Alembic migrations remain required before a production deployment. This repair lets a
    developer container safely widen the existing FHIR status column after an application upgrade.
    """
    if not settings.auto_create_schema:
        return
    async with engine.begin() as connection:
        await connection.execute(
            text("ALTER TABLE IF EXISTS fhir_exports ALTER COLUMN validation_status TYPE VARCHAR(64)")
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auto_create_schema:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    await apply_development_schema_repairs()
    await ensure_bootstrap_admin()
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="MediKiosk clinical intake API. It does not diagnose or prescribe.",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url=f"{settings.api_v1_prefix}/docs",
    redoc_url=f"{settings.api_v1_prefix}/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-ID", str(uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(DomainError)
async def handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
    return await domain_error_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {"code": "validation_error", "message": "Request validation failed", "details": exc.errors()},
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail
    message = detail if isinstance(detail, str) else "Request could not be completed"
    details = [] if isinstance(detail, str) else [detail]
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {"code": f"http_{exc.status_code}", "message": message, "details": jsonable_encoder(details)},
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {"code": "internal_error", "message": "Unexpected server error", "details": []},
            "request_id": getattr(request.state, "request_id", None),
        },
    )


app.include_router(health.router)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(auth.admin_router, prefix=settings.api_v1_prefix)
app.include_router(encounters.router, prefix=settings.api_v1_prefix)
app.include_router(intake.router, prefix=settings.api_v1_prefix)
app.include_router(clinical.triage_router, prefix=settings.api_v1_prefix)
app.include_router(clinical.red_flag_router, prefix=settings.api_v1_prefix)
app.include_router(clinical.clinician_router, prefix=settings.api_v1_prefix)
app.include_router(documents.router, prefix=settings.api_v1_prefix)
app.include_router(assistive.router, prefix=settings.api_v1_prefix)
app.include_router(summaries.router, prefix=settings.api_v1_prefix)
app.include_router(fhir.router, prefix=settings.api_v1_prefix)
