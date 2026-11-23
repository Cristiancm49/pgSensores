import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OrmSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    full_name: str = Field(min_length=2, max_length=160)
    email: str | None = Field(default=None, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    is_admin: bool = False


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    email: str | None = Field(default=None, max_length=254)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    active: bool | None = None
    is_admin: bool | None = None


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    email: str | None = Field(default=None, max_length=254)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserRead(OrmSchema):
    id: uuid.UUID
    username: str
    full_name: str
    email: str | None
    active: bool
    is_admin: bool
    last_access: datetime | None
    created_at: datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=5000)
    summary: str | None = Field(default=None, max_length=3000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    summary: str | None = Field(default=None, max_length=3000)
    status: str | None = Field(default=None, pattern=r"^(borrador|activo|finalizado|archivado)$")


class ProjectRead(OrmSchema):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: str
    summary: str | None
    status: str
    cover_image_path: str | None
    created_at: datetime
    updated_at: datetime


class MemberCreate(BaseModel):
    username: str
    role_code: str = Field(pattern=r"^(editor|visualizador)$")


class MemberUpdate(BaseModel):
    role_code: str = Field(pattern=r"^(editor|visualizador)$")


class MemberRead(BaseModel):
    user_id: uuid.UUID
    username: str
    full_name: str
    role_code: str
    role_name: str
    added_at: datetime


class LocationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)


class LocationRead(OrmSchema):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class DeviceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    board_type: str = Field(min_length=2, max_length=80)
    connection_type: str = Field(default="mqtt_directo", pattern=r"^(mqtt_directo|simulador)$")
    device_identifier: str = Field(min_length=3, max_length=120)
    location_id: uuid.UUID | None = None
    firmware_version: str | None = Field(default=None, max_length=80)
    configuration: dict = Field(default_factory=dict)


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    board_type: str | None = Field(default=None, min_length=2, max_length=80)
    connection_type: str | None = Field(default=None, pattern=r"^(mqtt_directo|simulador)$")
    location_id: uuid.UUID | None = None
    firmware_version: str | None = Field(default=None, max_length=80)
    status: str | None = Field(default=None, pattern=r"^(conectado|desconectado|error|inactivo)$")
    configuration: dict | None = None


class DeviceRead(OrmSchema):
    id: uuid.UUID
    project_id: uuid.UUID
    location_id: uuid.UUID | None
    name: str
    description: str | None
    board_type: str
    connection_type: str
    device_identifier: str
    status: str
    last_connection: datetime | None
    firmware_version: str | None
    configuration: dict
    created_at: datetime
    updated_at: datetime


class DeviceCredentialRead(OrmSchema):
    id: uuid.UUID
    device_id: uuid.UUID
    username: str
    created_at: datetime
    revoked_at: datetime | None


class DeviceCredentialIssued(DeviceCredentialRead):
    password: str
    client_id: str
    mqtt_host: str
    mqtt_port: int
    topic_base: str
    publish_topics: list[str]
    subscribe_topics: list[str]


class DeviceTemporaryCredential(BaseModel):
    session_id: uuid.UUID
    username: str
    client_id: str
    state: str


class DeviceMqttConfiguration(BaseModel):
    client_id: str
    mqtt_host: str
    mqtt_port: int
    mqtt_websocket_port: int
    topic_base: str
    publish_topics: list[str]
    subscribe_topics: list[str]
    broker_connected: bool
    temporary_credential: DeviceTemporaryCredential | None = None


class ChannelCreate(BaseModel):
    key: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    category: str = Field(pattern=r"^(sensor|actuador)$")
    data_type: str = Field(pattern=r"^(booleano|numero|texto|entero|json)$")
    unit: str | None = Field(default=None, max_length=30)
    gpio: str | None = Field(default=None, max_length=30)
    writable: bool = False
    widget_type: str = Field(max_length=40)
    minimum_value: float | None = None
    maximum_value: float | None = None
    configuration: dict = Field(default_factory=dict)
    save_history: bool = True
    save_interval_seconds: int = Field(default=5, ge=0, le=86400)
    save_only_if_changed: bool = False
    minimum_change: float | None = Field(default=None, ge=0)
    retention_days: int = Field(default=30, ge=1, le=3650)

    @model_validator(mode="after")
    def validate_range_and_category(self):
        if (
            self.minimum_value is not None
            and self.maximum_value is not None
            and self.minimum_value > self.maximum_value
        ):
            raise ValueError("El valor mínimo no puede superar el máximo")
        if self.category == "actuador" and not self.writable:
            self.writable = True
        return self


class ChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    data_type: str | None = Field(default=None, pattern=r"^(booleano|numero|texto|entero|json)$")
    unit: str | None = Field(default=None, max_length=30)
    gpio: str | None = Field(default=None, max_length=30)
    writable: bool | None = None
    widget_type: str | None = Field(default=None, max_length=40)
    minimum_value: float | None = None
    maximum_value: float | None = None
    configuration: dict | None = None
    save_history: bool | None = None
    save_interval_seconds: int | None = Field(default=None, ge=0, le=86400)
    save_only_if_changed: bool | None = None
    minimum_change: float | None = Field(default=None, ge=0)
    retention_days: int | None = Field(default=None, ge=1, le=3650)
    active: bool | None = None


class ChannelRead(OrmSchema):
    id: uuid.UUID
    device_id: uuid.UUID
    key: str
    name: str
    description: str | None
    category: str
    data_type: str
    unit: str | None
    gpio: str | None
    writable: bool
    widget_type: str
    minimum_value: float | None
    maximum_value: float | None
    configuration: dict
    save_history: bool
    save_interval_seconds: int
    save_only_if_changed: bool
    minimum_change: float | None
    retention_days: int
    active: bool
    created_at: datetime
    updated_at: datetime


class ChannelStateRead(OrmSchema):
    channel_id: uuid.UUID
    value: Any
    received_at: datetime
    source_timestamp: datetime | None


class TelemetryRead(OrmSchema):
    id: int
    channel_id: uuid.UUID
    value: Any
    recorded_at: datetime
    source_timestamp: datetime | None


class TelemetryPage(BaseModel):
    items: list[TelemetryRead]
    total: int
    page: int
    page_size: int


class CommandCreate(BaseModel):
    value: Any
    timeout_seconds: int = Field(default=10, ge=3, le=60)


class CommandRead(OrmSchema):
    id: uuid.UUID
    device_id: uuid.UUID
    channel_id: uuid.UUID
    requested_by_id: uuid.UUID
    value: Any
    status: str
    error: str | None
    created_at: datetime
    sent_at: datetime | None
    confirmed_at: datetime | None
    expires_at: datetime


class DocumentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    content: str = Field(default="", max_length=200_000)


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=180)
    content: str | None = Field(default=None, max_length=200_000)


class DocumentRead(OrmSchema):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    content: str
    order: int
    updated_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class DocumentOrderUpdate(BaseModel):
    document_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


class ProjectFileRead(OrmSchema):
    id: uuid.UUID
    project_id: uuid.UUID
    uploaded_by_id: uuid.UUID
    uploaded_by_name: str
    original_name: str
    mime_type: str
    size_bytes: int
    description: str | None
    created_at: datetime


class EventRead(OrmSchema):
    id: uuid.UUID
    project_id: uuid.UUID
    device_id: uuid.UUID | None
    channel_id: uuid.UUID | None
    event_type: str
    severity: str
    message: str
    details: dict
    created_at: datetime


class EventPage(BaseModel):
    items: list[EventRead]
    total: int
    page: int
    page_size: int


class SimulatorSessionCreate(BaseModel):
    project_id: uuid.UUID
    device_id: uuid.UUID
    name: str = Field(min_length=2, max_length=160)
    board_profile: str = Field(default="esp32_devkit", min_length=2, max_length=60)
    tick_ms: int = Field(default=2000, ge=250, le=60000)
    seed: int = Field(default=1, ge=0, le=2_147_483_647)
    configuration: dict = Field(default_factory=dict)
    scenario: dict = Field(default_factory=dict)


class SimulatorSessionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    board_profile: str | None = Field(default=None, min_length=2, max_length=60)
    tick_ms: int | None = Field(default=None, ge=250, le=60000)
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)
    configuration: dict | None = None
    scenario: dict | None = None


class SimulatorLaboratoryCreate(BaseModel):
    project_id: uuid.UUID
    name: str = Field(min_length=2, max_length=160)
    device_name: str = Field(min_length=2, max_length=160)
    board_profile: str = Field(default="esp32_devkit", min_length=2, max_length=60)
    starter_kit: str = Field(default="environmental", min_length=2, max_length=60)
    components: list[str] = Field(default_factory=list, max_length=30)
    firmware_language: str = Field(
        default="arduino", pattern=r"^(arduino|micropython|python|cpp|none)$"
    )
    firmware_code: str = Field(default="", max_length=200_000)
    tick_ms: int = Field(default=2000, ge=250, le=60000)
    seed: int = Field(default=1, ge=0, le=2_147_483_647)
    configuration: dict = Field(default_factory=dict)
    scenario: dict = Field(default_factory=dict)


class SimulatorSessionRead(OrmSchema):
    id: uuid.UUID
    project_id: uuid.UUID
    device_id: uuid.UUID
    created_by_id: uuid.UUID
    name: str
    board_profile: str
    state: str
    tick_ms: int
    seed: int
    configuration: dict
    scenario: dict
    last_error: str | None
    started_at: datetime | None
    stopped_at: datetime | None
    created_at: datetime
    updated_at: datetime


class SimulatorInputs(BaseModel):
    values: dict[str, Any]


class SimulatorFaults(BaseModel):
    network_disconnected: bool | None = None
    drop_ack: bool | None = None
    latency_ms: int | None = Field(default=None, ge=0, le=30000)
    noise_multiplier: float | None = Field(default=None, ge=0, le=20)


class SimulatorScenarioDocument(BaseModel):
    name: str = Field(default="Escenario", min_length=1, max_length=160)
    steps: list[dict[str, Any]] = Field(default_factory=list, max_length=200)


class SimulatorRunRead(OrmSchema):
    id: uuid.UUID
    session_id: uuid.UUID | None
    project_id: uuid.UUID
    device_id: uuid.UUID
    created_by_id: uuid.UUID
    state: str
    scenario: dict
    summary: dict
    logs: list
    started_at: datetime
    finished_at: datetime | None


class AuditRead(OrmSchema):
    id: int
    user_id: uuid.UUID | None
    action: str
    resource: str
    status_code: int
    ip: str | None
    details: dict
    created_at: datetime
