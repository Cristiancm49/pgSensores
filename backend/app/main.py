import logging
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import update

from app.api.router import api_router
from app.core.config import settings
from app.core.observability import configure_logging
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models import AuditLog, SimulatorSession
from app.services.mqtt_runtime import mqtt_runtime
from app.services.simulator_runtime import simulator_manager

configure_logging()
logger = logging.getLogger("nexiot.http")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    with SessionLocal() as database:
        database.execute(
            update(SimulatorSession)
            .where(SimulatorSession.state.in_(["preparando", "ejecutando", "pausada"]))
            .values(
                state="detenida",
                last_error="El sistema se reinició y la simulación se detuvo.",
                stopped_at=datetime.now(UTC),
            )
        )
        database.commit()
    await mqtt_runtime.start()
    try:
        yield
    finally:
        simulator_manager.shutdown_all()
        await mqtt_runtime.stop()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_prefix)


@app.middleware("http")
async def request_context(request: Request, call_next):  # noqa: ANN001
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    request.state.request_id = request_id
    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "Solicitud HTTP completada",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        user_id = None
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            try:
                payload = decode_token(authorization[7:])
                if payload.get("type") == "access":
                    user_id = uuid.UUID(payload["sub"])
            except Exception:
                user_id = None
        try:
            with SessionLocal() as database:
                database.add(
                    AuditLog(
                        user_id=user_id,
                        action=request.method,
                        resource=request.url.path[:500],
                        status_code=response.status_code,
                        ip=request.client.host if request.client else None,
                        details={"request_id": request_id},
                    )
                )
                database.commit()
        except Exception:
            logger.exception("No se pudo registrar la auditoría", extra={"request_id": request_id})
    return response


@app.exception_handler(HTTPException)
async def http_error(request: Request, error: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={
            "detail": error.detail,
            "code": f"http_{error.status_code}",
            "request_id": getattr(request.state, "request_id", None),
        },
        headers=error.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Los datos enviados no son válidos",
            "code": "validation_error",
            "errors": jsonable_encoder(error.errors()),
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(Exception)
async def unexpected_error(request: Request, error: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.exception("Error no controlado", extra={"request_id": request_id})
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Ocurrió un error interno",
            "code": "internal_error",
            "request_id": request_id,
        },
    )
