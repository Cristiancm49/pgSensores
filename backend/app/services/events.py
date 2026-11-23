import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import Device, Event


def add_event(
    database: Session,
    *,
    project_id: uuid.UUID,
    event_type: str,
    severity: str,
    message: str,
    device_id: uuid.UUID | None = None,
    channel_id: uuid.UUID | None = None,
    details: dict[str, Any] | None = None,
) -> Event:
    event = Event(
        project_id=project_id,
        device_id=device_id,
        channel_id=channel_id,
        event_type=event_type,
        severity=severity,
        message=message,
        details=details or {},
    )
    database.add(event)
    return event


def add_device_event(
    database: Session,
    device: Device,
    *,
    event_type: str,
    severity: str,
    message: str,
    channel_id: uuid.UUID | None = None,
    details: dict[str, Any] | None = None,
) -> Event:
    return add_event(
        database,
        project_id=device.project_id,
        device_id=device.id,
        channel_id=channel_id,
        event_type=event_type,
        severity=severity,
        message=message,
        details=details,
    )
