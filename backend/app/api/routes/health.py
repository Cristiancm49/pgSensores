from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import engine
from app.services.mqtt_runtime import mqtt_runtime

router = APIRouter()


@router.get("/live")
def liveness() -> dict[str, str]:
    return {"status": "ok", "service": "udlaiot-api"}


@router.get("/ready")
def readiness() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La base de datos no está disponible",
        ) from error
    return {
        "status": "ok",
        "database": "connected",
        "mqtt": "connected" if mqtt_runtime.connected else "disconnected",
    }
