import uuid
from datetime import UTC, datetime
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_project_access
from app.core.config import settings
from app.core.security import hash_token
from app.db.session import get_db
from app.models import Channel, Device, DeviceCredential, Location, User
from app.schemas.entities import (
    ChannelCreate,
    ChannelRead,
    ChannelUpdate,
    DeviceCreate,
    DeviceCredentialIssued,
    DeviceCredentialRead,
    DeviceMqttConfiguration,
    DeviceRead,
    DeviceUpdate,
)
from app.services import MqttSecurityError, mqtt_security
from app.services.mqtt_runtime import mqtt_runtime
from app.services.file_storage import StorageValidationError, file_storage
from app.services.simulator_runtime import simulator_manager

router = APIRouter()


def ensure_location(
    database: Session, project_id: uuid.UUID, location_id: uuid.UUID | None
) -> None:
    if location_id is None:
        return
    exists = database.scalar(
        select(Location.id).where(Location.id == location_id, Location.project_id == project_id)
    )
    if not exists:
        raise HTTPException(status_code=400, detail="La ubicación no pertenece al proyecto")


def get_device_with_permission(
    device_id: uuid.UUID, current_user: User, database: Session, permission: str = "read"
) -> Device:
    device = database.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    require_project_access(database, device.project_id, current_user, permission)
    return device


@router.get("/projects/{project_id}/devices", response_model=list[DeviceRead])
def list_devices(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[Device]:
    require_project_access(database, project_id, current_user)
    return list(
        database.scalars(
            select(Device).where(Device.project_id == project_id).order_by(Device.name)
        ).all()
    )


@router.post(
    "/projects/{project_id}/devices",
    response_model=DeviceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_device(
    project_id: uuid.UUID,
    payload: DeviceCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Device:
    require_project_access(database, project_id, current_user, "write")
    ensure_location(database, project_id, payload.location_id)
    if database.scalar(
        select(Device.id).where(Device.device_identifier == payload.device_identifier)
    ):
        raise HTTPException(status_code=409, detail="El identificador del dispositivo ya existe")
    device = Device(project_id=project_id, **payload.model_dump())
    database.add(device)
    database.commit()
    database.refresh(device)
    return device


@router.get("/devices/{device_id}", response_model=DeviceRead)
def get_device(
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Device:
    return get_device_with_permission(device_id, current_user, database)


@router.get("/devices/{device_id}/image")
def get_device_image(
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> FileResponse:
    device = get_device_with_permission(device_id, current_user, database)
    if not device.image_path:
        raise HTTPException(status_code=404, detail="El dispositivo no tiene imagen")
    path = file_storage.resolve(device.image_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="La imagen no existe")
    return FileResponse(path)


@router.post("/devices/{device_id}/image", status_code=status.HTTP_201_CREATED)
def upload_device_image(
    device_id: uuid.UUID,
    upload: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict[str, str]:
    device = get_device_with_permission(device_id, current_user, database, "write")
    if not (upload.content_type or "").startswith("image/"):
        raise HTTPException(status_code=422, detail="Solo se permiten imágenes")
    try:
        _, relative_path, _, _ = file_storage.save(
            device.project_id, upload.file, upload.filename or "", upload.content_type or ""
        )
    except StorageValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    previous = device.image_path
    device.image_path = relative_path
    database.commit()
    if previous:
        file_storage.delete(previous)
    return {"status": "ok"}


@router.patch("/devices/{device_id}", response_model=DeviceRead)
def update_device(
    device_id: uuid.UUID,
    payload: DeviceUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Device:
    device = get_device_with_permission(device_id, current_user, database, "write")
    changes = payload.model_dump(exclude_unset=True)
    if "location_id" in changes:
        ensure_location(database, device.project_id, changes["location_id"])
    for field, value in changes.items():
        setattr(device, field, value)
    database.commit()
    database.refresh(device)
    return device


@router.delete("/devices/{device_id}", response_model=DeviceRead)
def deactivate_device(
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Device:
    device = get_device_with_permission(device_id, current_user, database, "write")
    device.status = "inactivo"
    database.commit()
    database.refresh(device)
    return device


def topic_base_for(device: Device) -> str:
    return f"nexiot/devices/{device.id}"


def issued_credential_schema(
    credential: DeviceCredential, device: Device, password: str
) -> DeviceCredentialIssued:
    topic_base = topic_base_for(device)
    return DeviceCredentialIssued(
        id=credential.id,
        device_id=credential.device_id,
        username=credential.username,
        created_at=credential.created_at,
        revoked_at=credential.revoked_at,
        password=password,
        client_id=device.device_identifier,
        mqtt_host=settings.mqtt_public_host,
        mqtt_port=settings.mqtt_public_port,
        topic_base=topic_base,
        publish_topics=[
            f"{topic_base}/telemetry/#",
            f"{topic_base}/state/#",
            f"{topic_base}/ack/#",
            f"{topic_base}/status",
        ],
        subscribe_topics=[f"{topic_base}/commands/#"],
    )


def mqtt_configuration_schema(device: Device) -> DeviceMqttConfiguration:
    topic_base = topic_base_for(device)
    return DeviceMqttConfiguration(
        client_id=device.device_identifier,
        mqtt_host=settings.mqtt_public_host,
        mqtt_port=settings.mqtt_public_port,
        mqtt_websocket_port=settings.mqtt_public_websocket_port,
        topic_base=topic_base,
        publish_topics=[
            f"{topic_base}/telemetry/#",
            f"{topic_base}/state/#",
            f"{topic_base}/ack/#",
            f"{topic_base}/status",
        ],
        subscribe_topics=[f"{topic_base}/commands/#"],
        broker_connected=mqtt_runtime.connected,
        temporary_credential=simulator_manager.temporary_credential_for_device(device.id),
    )


@router.get(
    "/devices/{device_id}/mqtt-configuration",
    response_model=DeviceMqttConfiguration,
)
def get_device_mqtt_configuration(
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> DeviceMqttConfiguration:
    device = get_device_with_permission(device_id, current_user, database, "manage")
    return mqtt_configuration_schema(device)


def issue_device_credential(
    device: Device, current_user: User, database: Session
) -> DeviceCredentialIssued:
    credential_id = uuid.uuid4()
    username = f"device-{device.id.hex}-{credential_id.hex[:8]}"
    role_name = f"nexiot-device-{credential_id.hex}"
    password = token_urlsafe(32)
    try:
        mqtt_security.create_device_client(
            username=username,
            password=password,
            client_id=device.device_identifier,
            role_name=role_name,
            topic_base=topic_base_for(device),
        )
    except MqttSecurityError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    credential = DeviceCredential(
        id=credential_id,
        device_id=device.id,
        username=username,
        secret_hash=hash_token(password),
        role_name=role_name,
        created_by_id=current_user.id,
    )
    database.add(credential)
    try:
        database.commit()
        database.refresh(credential)
    except Exception:
        database.rollback()
        try:
            mqtt_security.revoke_device_client(username=username, role_name=role_name)
        except MqttSecurityError:
            pass
        raise
    return issued_credential_schema(credential, device, password)


@router.get("/devices/{device_id}/credentials", response_model=list[DeviceCredentialRead])
def list_device_credentials(
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[DeviceCredential]:
    get_device_with_permission(device_id, current_user, database, "manage")
    return list(
        database.scalars(
            select(DeviceCredential)
            .where(DeviceCredential.device_id == device_id)
            .order_by(DeviceCredential.created_at.desc())
        ).all()
    )


@router.post(
    "/devices/{device_id}/credentials",
    response_model=DeviceCredentialIssued,
    status_code=status.HTTP_201_CREATED,
)
def create_device_credential(
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> DeviceCredentialIssued:
    device = get_device_with_permission(device_id, current_user, database, "manage")
    active = database.scalar(
        select(DeviceCredential.id).where(
            DeviceCredential.device_id == device_id,
            DeviceCredential.revoked_at.is_(None),
        )
    )
    if active:
        raise HTTPException(
            status_code=409,
            detail="El dispositivo ya tiene una credencial activa; utiliza rotar credencial",
        )
    return issue_device_credential(device, current_user, database)


@router.post(
    "/devices/{device_id}/credentials/rotate",
    response_model=DeviceCredentialIssued,
    status_code=status.HTTP_201_CREATED,
)
def rotate_device_credential(
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> DeviceCredentialIssued:
    device = get_device_with_permission(device_id, current_user, database, "manage")
    active_credentials = list(
        database.scalars(
            select(DeviceCredential).where(
                DeviceCredential.device_id == device_id,
                DeviceCredential.revoked_at.is_(None),
            )
        ).all()
    )
    for credential in active_credentials:
        try:
            mqtt_security.revoke_device_client(
                username=credential.username, role_name=credential.role_name
            )
        except MqttSecurityError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        credential.revoked_at = datetime.now(UTC)
    database.commit()
    return issue_device_credential(device, current_user, database)


@router.delete("/device-credentials/{credential_id}", response_model=DeviceCredentialRead)
def revoke_device_credential(
    credential_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> DeviceCredential:
    credential = database.get(DeviceCredential, credential_id)
    if credential is None:
        raise HTTPException(status_code=404, detail="Credencial no encontrada")
    get_device_with_permission(credential.device_id, current_user, database, "manage")
    if credential.revoked_at is None:
        try:
            mqtt_security.revoke_device_client(
                username=credential.username, role_name=credential.role_name
            )
        except MqttSecurityError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        credential.revoked_at = datetime.now(UTC)
        database.commit()
        database.refresh(credential)
    return credential


@router.get("/devices/{device_id}/channels", response_model=list[ChannelRead])
def list_channels(
    device_id: uuid.UUID,
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[Channel]:
    get_device_with_permission(device_id, current_user, database)
    statement = select(Channel).where(Channel.device_id == device_id).order_by(Channel.name)
    if category:
        if category not in {"sensor", "actuador"}:
            raise HTTPException(status_code=400, detail="Categoría inválida")
        statement = statement.where(Channel.category == category)
    return list(database.scalars(statement).all())


@router.post(
    "/devices/{device_id}/channels",
    response_model=ChannelRead,
    status_code=status.HTTP_201_CREATED,
)
def create_channel(
    device_id: uuid.UUID,
    payload: ChannelCreate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Channel:
    get_device_with_permission(device_id, current_user, database, "write")
    exists = database.scalar(
        select(Channel.id).where(Channel.device_id == device_id, Channel.key == payload.key)
    )
    if exists:
        raise HTTPException(status_code=409, detail="La clave del canal ya existe")
    channel = Channel(device_id=device_id, **payload.model_dump())
    database.add(channel)
    database.commit()
    database.refresh(channel)
    return channel


def get_channel_with_permission(
    channel_id: uuid.UUID, current_user: User, database: Session, permission: str
) -> Channel:
    channel = database.get(Channel, channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Canal no encontrado")
    get_device_with_permission(channel.device_id, current_user, database, permission)
    return channel


@router.get("/channels/{channel_id}/image")
def get_channel_image(
    channel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> FileResponse:
    channel = get_channel_with_permission(channel_id, current_user, database, "read")
    if not channel.image_path:
        raise HTTPException(status_code=404, detail="El canal no tiene imagen")
    path = file_storage.resolve(channel.image_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="La imagen no existe")
    return FileResponse(path)


@router.post("/channels/{channel_id}/image", status_code=status.HTTP_201_CREATED)
def upload_channel_image(
    channel_id: uuid.UUID,
    upload: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict[str, str]:
    channel = get_channel_with_permission(channel_id, current_user, database, "write")
    device = database.get(Device, channel.device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    if not (upload.content_type or "").startswith("image/"):
        raise HTTPException(status_code=422, detail="Solo se permiten imágenes")
    try:
        _, relative_path, _, _ = file_storage.save(
            device.project_id, upload.file, upload.filename or "", upload.content_type or ""
        )
    except StorageValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    previous = channel.image_path
    channel.image_path = relative_path
    database.commit()
    if previous:
        file_storage.delete(previous)
    return {"status": "ok"}


@router.patch("/channels/{channel_id}", response_model=ChannelRead)
def update_channel(
    channel_id: uuid.UUID,
    payload: ChannelUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Channel:
    channel = get_channel_with_permission(channel_id, current_user, database, "write")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(channel, field, value)
    database.commit()
    database.refresh(channel)
    return channel


@router.delete("/channels/{channel_id}", response_model=ChannelRead)
def deactivate_channel(
    channel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Channel:
    channel = get_channel_with_permission(channel_id, current_user, database, "write")
    channel.active = False
    database.commit()
    database.refresh(channel)
    return channel
