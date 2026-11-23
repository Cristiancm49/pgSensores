import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_project_access
from app.db.session import get_db
from app.models import Channel, ChannelState, Device, DeviceCommand, Telemetry, User
from app.schemas.entities import (
    ChannelStateRead,
    CommandCreate,
    CommandRead,
    TelemetryPage,
)
from app.services.events import add_device_event
from app.services.iot_values import coerce_channel_value
from app.services.mqtt_runtime import mqtt_runtime
from app.services.realtime import realtime_manager

router = APIRouter()


def channel_with_access(
    channel_id: uuid.UUID,
    current_user: User,
    database: Session,
    permission: str = "read",
) -> tuple[Channel, Device]:
    channel = database.get(Channel, channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Canal no encontrado")
    device = database.get(Device, channel.device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    require_project_access(database, device.project_id, current_user, permission)
    return channel, device


@router.get("/channels/{channel_id}/state", response_model=ChannelStateRead)
def get_channel_state(
    channel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChannelState:
    channel_with_access(channel_id, current_user, database)
    state = database.get(ChannelState, channel_id)
    if state is None:
        raise HTTPException(status_code=404, detail="El canal aún no tiene lecturas")
    return state


@router.get("/channels/{channel_id}/telemetry", response_model=TelemetryPage)
def get_channel_telemetry(
    channel_id: uuid.UUID,
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> TelemetryPage:
    channel_with_access(channel_id, current_user, database)
    statement = select(Telemetry).where(Telemetry.channel_id == channel_id)
    if from_date:
        statement = statement.where(Telemetry.recorded_at >= from_date)
    if to_date:
        statement = statement.where(Telemetry.recorded_at <= to_date)
    total = database.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = list(
        database.scalars(
            statement.order_by(Telemetry.recorded_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    rows.reverse()
    return TelemetryPage(items=rows, total=total, page=page, page_size=page_size)


@router.post(
    "/channels/{channel_id}/commands",
    response_model=CommandRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_channel_command(
    channel_id: uuid.UUID,
    payload: CommandCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> DeviceCommand:
    channel, device = channel_with_access(channel_id, current_user, database, "write")
    if channel.category != "actuador" or not channel.writable or not channel.active:
        raise HTTPException(status_code=400, detail="El canal no admite comandos")
    try:
        value = coerce_channel_value(channel, payload.value)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    now = datetime.now(UTC)
    command = DeviceCommand(
        device_id=device.id,
        channel_id=channel.id,
        requested_by_id=current_user.id,
        value=value,
        status="pendiente",
        created_at=now,
        expires_at=now + timedelta(seconds=payload.timeout_seconds),
    )
    database.add(command)
    database.flush()
    try:
        await asyncio.to_thread(mqtt_runtime.publish_command, command, channel, device)
        command.status = "enviado"
        command.sent_at = datetime.now(UTC)
    except RuntimeError as error:
        command.status = "fallido"
        command.error = str(error)
        event = add_device_event(
            database,
            device,
            event_type="publicacion_comando_fallida",
            severity="critica",
            message=f"No fue posible enviar un comando a {device.name}",
            channel_id=channel.id,
            details={"command_id": str(command.id), "error": str(error)},
        )
        database.flush()
    else:
        event = None
    database.commit()
    database.refresh(command)
    await realtime_manager.broadcast(
        {
            "type": "command_status",
            "project_id": device.project_id,
            "device_id": device.id,
            "channel_id": channel.id,
            "command_id": command.id,
            "status": command.status,
            "error": command.error,
        }
    )
    if event:
        await realtime_manager.broadcast(
            {
                "type": "event",
                "project_id": event.project_id,
                "device_id": event.device_id,
                "channel_id": event.channel_id,
                "event_id": event.id,
                "event_type": event.event_type,
                "severity": event.severity,
                "message": event.message,
                "created_at": event.created_at,
            }
        )
    return command


@router.get("/commands/{command_id}", response_model=CommandRead)
def get_command(
    command_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> DeviceCommand:
    command = database.get(DeviceCommand, command_id)
    if command is None:
        raise HTTPException(status_code=404, detail="Comando no encontrado")
    device = database.get(Device, command.device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    require_project_access(database, device.project_id, current_user)
    return command


@router.get("/devices/{device_id}/commands", response_model=list[CommandRead])
def list_device_commands(
    device_id: uuid.UUID,
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[DeviceCommand]:
    device = database.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    require_project_access(database, device.project_id, current_user)
    return list(
        database.scalars(
            select(DeviceCommand)
            .where(DeviceCommand.device_id == device_id)
            .order_by(DeviceCommand.created_at.desc())
            .limit(limit)
        ).all()
    )
