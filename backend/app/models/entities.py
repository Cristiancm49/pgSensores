import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(Base, TimestampMixin):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column("nombre_usuario", String(64), unique=True, index=True)
    full_name: Mapped[str] = mapped_column("nombre_completo", String(160))
    email: Mapped[str | None] = mapped_column("correo", String(254), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column("contrasena_hash", String(255))
    avatar_path: Mapped[str | None] = mapped_column("avatar_ruta", String(500), nullable=True)
    active: Mapped[bool] = mapped_column("activo", Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(
        "es_administrador", Boolean, default=False, nullable=False
    )
    last_access: Mapped[datetime | None] = mapped_column(
        "ultimo_acceso", DateTime(timezone=True), nullable=True
    )


class UserSession(Base):
    __tablename__ = "sesiones_usuario"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        "usuario_id", ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column("agente_usuario", Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column("expira_en", DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        "revocada_en", DateTime(timezone=True), nullable=True
    )


class ProjectRole(Base):
    __tablename__ = "roles_proyecto"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=False)
    code: Mapped[str] = mapped_column("codigo", String(40), unique=True)
    name: Mapped[str] = mapped_column("nombre", String(80))
    description: Mapped[str | None] = mapped_column("descripcion", Text, nullable=True)


class Project(Base, TimestampMixin):
    __tablename__ = "proyectos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        "propietario_id", ForeignKey("usuarios.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column("nombre", String(160))
    description: Mapped[str] = mapped_column("descripcion", Text, default="")
    summary: Mapped[str | None] = mapped_column("resumen", Text, nullable=True)
    status: Mapped[str] = mapped_column("estado", String(30), default="activo", index=True)
    cover_image_path: Mapped[str | None] = mapped_column(
        "imagen_portada_ruta", String(500), nullable=True
    )


class ProjectMember(Base):
    __tablename__ = "miembros_proyecto"
    __table_args__ = (UniqueConstraint("proyecto_id", "usuario_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        "proyecto_id", ForeignKey("proyectos.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        "usuario_id", ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    role_id: Mapped[int] = mapped_column(
        "rol_id", ForeignKey("roles_proyecto.id", ondelete="RESTRICT")
    )
    added_at: Mapped[datetime] = mapped_column(
        "agregado_en", DateTime(timezone=True), server_default=func.now()
    )


class Location(Base, TimestampMixin):
    __tablename__ = "ubicaciones"
    __table_args__ = (UniqueConstraint("proyecto_id", "nombre"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        "proyecto_id", ForeignKey("proyectos.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column("nombre", String(120))
    description: Mapped[str | None] = mapped_column("descripcion", Text, nullable=True)


class Device(Base, TimestampMixin):
    __tablename__ = "dispositivos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        "proyecto_id", ForeignKey("proyectos.id", ondelete="CASCADE"), index=True
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        "ubicacion_id", ForeignKey("ubicaciones.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column("nombre", String(160))
    description: Mapped[str | None] = mapped_column("descripcion", Text, nullable=True)
    board_type: Mapped[str] = mapped_column("tipo_placa", String(80))
    connection_type: Mapped[str] = mapped_column(
        "tipo_conexion", String(40), default="mqtt_directo"
    )
    device_identifier: Mapped[str] = mapped_column(
        "identificador_dispositivo", String(120), unique=True, index=True
    )
    status: Mapped[str] = mapped_column("estado", String(30), default="desconectado", index=True)
    last_connection: Mapped[datetime | None] = mapped_column(
        "ultima_conexion", DateTime(timezone=True), nullable=True
    )
    firmware_version: Mapped[str | None] = mapped_column(
        "version_firmware", String(80), nullable=True
    )
    image_path: Mapped[str | None] = mapped_column("imagen_ruta", String(500), nullable=True)
    configuration: Mapped[dict] = mapped_column("configuracion", JSON, default=dict)


class DeviceCredential(Base):
    __tablename__ = "credenciales_dispositivo"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(
        "dispositivo_id", ForeignKey("dispositivos.id", ondelete="CASCADE"), index=True
    )
    username: Mapped[str] = mapped_column("nombre_usuario", String(160), unique=True, index=True)
    secret_hash: Mapped[str] = mapped_column("secreto_hash", String(64))
    role_name: Mapped[str] = mapped_column("nombre_rol", String(160), unique=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        "creado_por_id", ForeignKey("usuarios.id", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        "revocada_en", DateTime(timezone=True), nullable=True, index=True
    )


class Channel(Base, TimestampMixin):
    __tablename__ = "canales"
    __table_args__ = (UniqueConstraint("dispositivo_id", "clave"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(
        "dispositivo_id", ForeignKey("dispositivos.id", ondelete="CASCADE"), index=True
    )
    key: Mapped[str] = mapped_column("clave", String(80))
    name: Mapped[str] = mapped_column("nombre", String(120))
    description: Mapped[str | None] = mapped_column("descripcion", Text, nullable=True)
    category: Mapped[str] = mapped_column("categoria", String(30), index=True)
    data_type: Mapped[str] = mapped_column("tipo_dato", String(30))
    unit: Mapped[str | None] = mapped_column("unidad", String(30), nullable=True)
    gpio: Mapped[str | None] = mapped_column(String(30), nullable=True)
    writable: Mapped[bool] = mapped_column("es_escribible", Boolean, default=False)
    widget_type: Mapped[str] = mapped_column("tipo_widget", String(40))
    minimum_value: Mapped[float | None] = mapped_column("valor_minimo", Float, nullable=True)
    maximum_value: Mapped[float | None] = mapped_column("valor_maximo", Float, nullable=True)
    image_path: Mapped[str | None] = mapped_column("imagen_ruta", String(500), nullable=True)
    configuration: Mapped[dict] = mapped_column("configuracion", JSON, default=dict)
    save_history: Mapped[bool] = mapped_column("guardar_historico", Boolean, default=True)
    save_interval_seconds: Mapped[int] = mapped_column(
        "intervalo_guardado_segundos", SmallInteger, default=5
    )
    save_only_if_changed: Mapped[bool] = mapped_column(
        "guardar_solo_si_cambia", Boolean, default=False
    )
    minimum_change: Mapped[float | None] = mapped_column("cambio_minimo", Float, nullable=True)
    retention_days: Mapped[int] = mapped_column("retencion_dias", SmallInteger, default=30)
    active: Mapped[bool] = mapped_column("activo", Boolean, default=True)


class ChannelState(Base):
    __tablename__ = "estado_canales"

    channel_id: Mapped[uuid.UUID] = mapped_column(
        "canal_id", ForeignKey("canales.id", ondelete="CASCADE"), primary_key=True
    )
    value: Mapped[Any] = mapped_column("valor", JSON)
    received_at: Mapped[datetime] = mapped_column(
        "recibido_en", DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    source_timestamp: Mapped[datetime | None] = mapped_column(
        "marca_tiempo_origen", DateTime(timezone=True), nullable=True
    )


class Telemetry(Base):
    __tablename__ = "telemetria"
    __table_args__ = (Index("ix_telemetria_canal_registrado", "canal_id", "registrado_en"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    channel_id: Mapped[uuid.UUID] = mapped_column(
        "canal_id", ForeignKey("canales.id", ondelete="CASCADE"), index=True
    )
    value: Mapped[Any] = mapped_column("valor", JSON)
    recorded_at: Mapped[datetime] = mapped_column(
        "registrado_en", DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    source_timestamp: Mapped[datetime | None] = mapped_column(
        "marca_tiempo_origen", DateTime(timezone=True), nullable=True
    )


class DeviceCommand(Base):
    __tablename__ = "comandos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(
        "dispositivo_id", ForeignKey("dispositivos.id", ondelete="CASCADE"), index=True
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        "canal_id", ForeignKey("canales.id", ondelete="CASCADE"), index=True
    )
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        "solicitado_por_id", ForeignKey("usuarios.id", ondelete="RESTRICT")
    )
    value: Mapped[Any] = mapped_column("valor", JSON)
    status: Mapped[str] = mapped_column("estado", String(30), default="pendiente", index=True)
    error: Mapped[str | None] = mapped_column("error", Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        "enviado_en", DateTime(timezone=True), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        "confirmado_en", DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        "expira_en", DateTime(timezone=True), nullable=False, index=True
    )


class ProjectDocument(Base, TimestampMixin):
    __tablename__ = "documentos_proyecto"
    __table_args__ = (UniqueConstraint("proyecto_id", "orden"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        "proyecto_id", ForeignKey("proyectos.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column("titulo", String(180))
    content: Mapped[str] = mapped_column("contenido", Text, default="")
    order: Mapped[int] = mapped_column("orden", SmallInteger)
    updated_by_id: Mapped[uuid.UUID] = mapped_column(
        "actualizado_por_id", ForeignKey("usuarios.id", ondelete="RESTRICT")
    )


class ProjectFile(Base):
    __tablename__ = "archivos_proyecto"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        "proyecto_id", ForeignKey("proyectos.id", ondelete="CASCADE"), index=True
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        "subido_por_id", ForeignKey("usuarios.id", ondelete="RESTRICT")
    )
    original_name: Mapped[str] = mapped_column("nombre_original", String(255))
    stored_name: Mapped[str] = mapped_column("nombre_fisico", String(255), unique=True)
    relative_path: Mapped[str] = mapped_column("ruta_relativa", String(500), unique=True)
    mime_type: Mapped[str] = mapped_column("tipo_mime", String(160))
    size_bytes: Mapped[int] = mapped_column("tamano_bytes", BigInteger)
    description: Mapped[str | None] = mapped_column("descripcion", Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Event(Base):
    __tablename__ = "eventos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        "proyecto_id", ForeignKey("proyectos.id", ondelete="CASCADE"), index=True
    )
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        "dispositivo_id",
        ForeignKey("dispositivos.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        "canal_id", ForeignKey("canales.id", ondelete="CASCADE"), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column("tipo", String(60), index=True)
    severity: Mapped[str] = mapped_column("severidad", String(20), index=True)
    message: Mapped[str] = mapped_column("mensaje", String(500))
    details: Mapped[dict] = mapped_column("detalles", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class SimulatorSession(Base, TimestampMixin):
    __tablename__ = "sesiones_simulador"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        "proyecto_id", ForeignKey("proyectos.id", ondelete="CASCADE"), index=True
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        "dispositivo_id", ForeignKey("dispositivos.id", ondelete="CASCADE"), index=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        "creado_por_id", ForeignKey("usuarios.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column("nombre", String(160))
    board_profile: Mapped[str] = mapped_column("perfil_placa", String(60))
    state: Mapped[str] = mapped_column("estado", String(30), default="creada", index=True)
    tick_ms: Mapped[int] = mapped_column("intervalo_ms", SmallInteger, default=2000)
    seed: Mapped[int] = mapped_column("semilla", BigInteger, default=1)
    configuration: Mapped[dict] = mapped_column("configuracion", JSON, default=dict)
    scenario: Mapped[dict] = mapped_column("escenario", JSON, default=dict)
    last_error: Mapped[str | None] = mapped_column("ultimo_error", Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        "iniciada_en", DateTime(timezone=True), nullable=True
    )
    stopped_at: Mapped[datetime | None] = mapped_column(
        "detenida_en", DateTime(timezone=True), nullable=True
    )


class SimulatorRun(Base):
    __tablename__ = "ejecuciones_simulador"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        "sesion_id",
        ForeignKey("sesiones_simulador.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        "proyecto_id", ForeignKey("proyectos.id", ondelete="CASCADE"), index=True
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        "dispositivo_id", ForeignKey("dispositivos.id", ondelete="CASCADE"), index=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        "creado_por_id", ForeignKey("usuarios.id", ondelete="RESTRICT"), index=True
    )
    state: Mapped[str] = mapped_column("estado", String(30), default="ejecutando", index=True)
    scenario: Mapped[dict] = mapped_column("escenario", JSON, default=dict)
    summary: Mapped[dict] = mapped_column("resumen", JSON, default=dict)
    logs: Mapped[list] = mapped_column("registros", JSON, default=list)
    started_at: Mapped[datetime] = mapped_column(
        "iniciada_en", DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        "finalizada_en", DateTime(timezone=True), nullable=True
    )


class AuditLog(Base):
    __tablename__ = "auditoria"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        "usuario_id", ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column("accion", String(120), index=True)
    resource: Mapped[str] = mapped_column("recurso", String(500))
    status_code: Mapped[int] = mapped_column("codigo_estado", SmallInteger)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict] = mapped_column("detalles", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
