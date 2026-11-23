import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import paho.mqtt.client as mqtt
from sqlalchemy import delete, select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Channel, ChannelState, Device, DeviceCommand, Event, Telemetry
from app.services.events import add_device_event
from app.services.iot_values import coerce_channel_value, decode_mqtt_payload
from app.services.mqtt_security import MqttSecurityError, mqtt_security
from app.services.realtime import realtime_manager

logger = logging.getLogger(__name__)


class MqttRuntime:
    def __init__(self) -> None:
        self.client: mqtt.Client | None = None
        self.loop: asyncio.AbstractEventLoop | None = None
        self.connected = False
        self.expiry_task: asyncio.Task | None = None
        self.cleanup_task: asyncio.Task | None = None

    async def start(self) -> None:
        self.loop = asyncio.get_running_loop()
        last_error: Exception | None = None
        for attempt in range(10):
            try:
                await asyncio.to_thread(mqtt_security.provision_backend_client)
                last_error = None
                break
            except MqttSecurityError as error:
                last_error = error
                await asyncio.sleep(min(0.5 * (attempt + 1), 3))
        if last_error:
            logger.error("No se pudo preparar el cliente MQTT del backend: %s", last_error)
            return

        client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id="nexiot-backend-service",
            protocol=mqtt.MQTTv311,
        )
        client.username_pw_set(settings.mqtt_backend_username, settings.mqtt_backend_password)
        client.reconnect_delay_set(min_delay=1, max_delay=15)
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        self.client = client
        await asyncio.to_thread(client.connect, settings.mqtt_host, settings.mqtt_port, 30)
        client.loop_start()
        self.expiry_task = asyncio.create_task(self._expire_commands())
        self.cleanup_task = asyncio.create_task(self._cleanup_telemetry())

    async def stop(self) -> None:
        for task in (self.expiry_task, self.cleanup_task):
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        if self.client:
            self.client.disconnect()
            self.client.loop_stop()
        self.connected = False

    def _on_connect(self, client, userdata, flags, reason_code, properties):  # noqa: ANN001
        self.connected = reason_code == 0
        if not self.connected:
            logger.error("Conexión MQTT del backend rechazada: %s", reason_code)
            return
        for topic in (
            "nexiot/devices/+/telemetry/#",
            "nexiot/devices/+/state/#",
            "nexiot/devices/+/ack/#",
            "nexiot/devices/+/status",
        ):
            client.subscribe(topic, qos=1)
        logger.info("Cliente MQTT del backend conectado")

    def _on_disconnect(
        self,
        client,
        userdata,
        disconnect_flags,
        reason_code,
        properties,  # noqa: ANN001
    ):
        self.connected = False
        if reason_code != 0:
            logger.warning("Cliente MQTT desconectado: %s", reason_code)

    def _on_message(self, client, userdata, message):  # noqa: ANN001
        try:
            self._process_message(message.topic, message.payload)
        except Exception:
            logger.exception("No se pudo procesar el mensaje MQTT de %s", message.topic)

    def _process_message(self, topic: str, payload: bytes) -> None:
        parts = topic.split("/")
        if len(parts) < 4 or parts[:2] != ["nexiot", "devices"]:
            return
        try:
            device_id = uuid.UUID(parts[2])
        except ValueError:
            return
        kind = parts[3]
        with SessionLocal() as database:
            device = database.get(Device, device_id)
            if device is None or device.status == "inactivo":
                return
            if kind == "status":
                self._process_status(database, device, payload)
            elif kind in {"telemetry", "state"} and len(parts) == 5:
                self._process_telemetry(database, device, parts[4], payload)
            elif kind == "ack":
                self._process_ack(database, device, payload)

    def _process_status(self, database, device: Device, payload: bytes) -> None:  # noqa: ANN001
        text = payload.decode("utf-8").strip()
        try:
            body = json.loads(text)
            raw_status = body.get("status", text) if isinstance(body, dict) else body
        except json.JSONDecodeError:
            raw_status = text
        online = str(raw_status).lower() in {"online", "connected", "conectado", "true", "1"}
        previous_status = device.status
        device.status = "conectado" if online else "desconectado"
        if online:
            device.last_connection = datetime.now(UTC)
        if previous_status != device.status:
            event = add_device_event(
                database,
                device,
                event_type="dispositivo_conectado" if online else "dispositivo_desconectado",
                severity="info" if online else "advertencia",
                message=(
                    f"{device.name} se conectó" if online else f"{device.name} perdió la conexión"
                ),
            )
            database.flush()
        else:
            event = None
        database.commit()
        realtime_manager.broadcast_from_thread(
            {
                "type": "device_status",
                "project_id": device.project_id,
                "device_id": device.id,
                "status": device.status,
                "last_connection": device.last_connection,
            },
            self.loop,
        )
        if event:
            self._broadcast_event(event)

    def _process_telemetry(
        self,
        database,
        device: Device,
        channel_key: str,
        payload: bytes,  # noqa: ANN001
    ) -> None:
        channel = database.scalar(
            select(Channel).where(
                Channel.device_id == device.id,
                Channel.key == channel_key,
                Channel.active.is_(True),
            )
        )
        if channel is None:
            logger.warning("Canal MQTT desconocido: %s/%s", device.id, channel_key)
            event = add_device_event(
                database,
                device,
                event_type="canal_desconocido",
                severity="advertencia",
                message=f"Se recibió información para el canal desconocido {channel_key}",
                details={"channel_key": channel_key},
            )
            database.flush()
            database.commit()
            self._broadcast_event(event)
            return
        try:
            value, source_timestamp = decode_mqtt_payload(channel, payload)
        except (UnicodeDecodeError, ValueError) as error:
            logger.warning("Lectura MQTT inválida para %s: %s", channel.key, error)
            event = add_device_event(
                database,
                device,
                event_type="lectura_invalida",
                severity="advertencia",
                message=f"Lectura inválida en {channel.name}",
                channel_id=channel.id,
                details={"reason": str(error)},
            )
            database.flush()
            database.commit()
            self._broadcast_event(event)
            return

        now = datetime.now(UTC)
        state = database.get(ChannelState, channel.id)
        if state is None:
            state = ChannelState(channel_id=channel.id, value=value)
            database.add(state)
        state.value = value
        state.received_at = now
        state.source_timestamp = source_timestamp
        persisted = self._should_persist(database, channel, value, source_timestamp, now)
        if persisted:
            database.add(
                Telemetry(
                    channel_id=channel.id,
                    value=value,
                    recorded_at=now,
                    source_timestamp=source_timestamp,
                )
            )
        device.status = "conectado"
        device.last_connection = now
        database.commit()
        realtime_manager.broadcast_from_thread(
            {
                "type": "telemetry",
                "project_id": device.project_id,
                "device_id": device.id,
                "channel_id": channel.id,
                "channel_key": channel.key,
                "value": value,
                "received_at": now,
                "persisted": persisted,
            },
            self.loop,
        )

    def _should_persist(
        self,
        database,
        channel: Channel,
        value: Any,
        source_timestamp: datetime | None,
        now: datetime,
    ) -> bool:  # noqa: ANN001
        if not channel.save_history:
            return False
        if source_timestamp and database.scalar(
            select(Telemetry.id).where(
                Telemetry.channel_id == channel.id,
                Telemetry.source_timestamp == source_timestamp,
            )
        ):
            return False
        latest = database.scalar(
            select(Telemetry)
            .where(Telemetry.channel_id == channel.id)
            .order_by(Telemetry.recorded_at.desc())
            .limit(1)
        )
        if latest is None:
            return True
        elapsed = (now - latest.recorded_at).total_seconds()
        if source_timestamp is None and latest.value == value and elapsed < 1:
            return False
        if channel.save_interval_seconds > 0:
            if elapsed < channel.save_interval_seconds:
                return False
        if channel.save_only_if_changed and latest.value == value:
            return False
        if (
            channel.minimum_change is not None
            and isinstance(value, (int, float))
            and not isinstance(value, bool)
            and isinstance(latest.value, (int, float))
            and not isinstance(latest.value, bool)
            and abs(float(value) - float(latest.value)) < channel.minimum_change
        ):
            return False
        return True

    def _process_ack(self, database, device: Device, payload: bytes) -> None:  # noqa: ANN001
        try:
            body = json.loads(payload.decode("utf-8"))
            command_id = uuid.UUID(body["command_id"])
        except (UnicodeDecodeError, json.JSONDecodeError, KeyError, ValueError):
            logger.warning("ACK MQTT inválido para el dispositivo %s", device.id)
            event = add_device_event(
                database,
                device,
                event_type="ack_invalido",
                severity="advertencia",
                message=f"{device.name} envió un ACK inválido",
            )
            database.flush()
            database.commit()
            self._broadcast_event(event)
            return
        command = database.get(DeviceCommand, command_id)
        if command is None or command.device_id != device.id:
            return
        raw_status = str(body.get("status", "confirmed")).lower()
        command.status = (
            "confirmado" if raw_status in {"ok", "confirmed", "confirmado"} else "fallido"
        )
        command.error = body.get("error")
        command.confirmed_at = datetime.now(UTC)
        channel = database.get(Channel, command.channel_id)
        event = None
        if command.status == "confirmado" and channel is not None:
            try:
                value = coerce_channel_value(channel, body.get("value", command.value))
                state = database.get(ChannelState, channel.id)
                if state is None:
                    state = ChannelState(channel_id=channel.id, value=value)
                    database.add(state)
                state.value = value
                state.received_at = command.confirmed_at
                database.add(
                    Telemetry(
                        channel_id=channel.id,
                        value=value,
                        recorded_at=command.confirmed_at,
                    )
                )
            except ValueError:
                pass
        elif command.status == "fallido":
            event = add_device_event(
                database,
                device,
                event_type="comando_fallido",
                severity="critica",
                message=(
                    "El dispositivo rechazó el comando para "
                    f"{channel.name if channel else 'un canal'}"
                ),
                channel_id=command.channel_id,
                details={"command_id": str(command.id), "error": command.error},
            )
            database.flush()
        database.commit()
        realtime_manager.broadcast_from_thread(
            {
                "type": "command_ack",
                "project_id": device.project_id,
                "device_id": device.id,
                "channel_id": command.channel_id,
                "command_id": command.id,
                "status": command.status,
                "value": command.value,
                "error": command.error,
                "confirmed_at": command.confirmed_at,
            },
            self.loop,
        )
        if event:
            self._broadcast_event(event)

    def _broadcast_event(self, event: Event) -> None:
        realtime_manager.broadcast_from_thread(
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
            },
            self.loop,
        )

    def publish_command(self, command: DeviceCommand, channel: Channel, device: Device) -> None:
        if not self.client or not self.connected:
            raise RuntimeError("El servicio MQTT no está conectado")
        payload = json.dumps(
            {
                "command_id": str(command.id),
                "channel": channel.key,
                "value": command.value,
                "timestamp": command.created_at.isoformat(),
            },
            separators=(",", ":"),
        )
        topic = f"nexiot/devices/{device.id}/commands/{channel.key}"
        result = self.client.publish(topic, payload=payload, qos=1)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            raise RuntimeError(mqtt.error_string(result.rc))
        result.wait_for_publish(timeout=3)
        if not result.is_published():
            raise RuntimeError("Mosquitto no confirmó la publicación del comando")

    async def _expire_commands(self) -> None:
        while True:
            await asyncio.sleep(1)
            now = datetime.now(UTC)
            events: list[dict[str, Any]] = []
            with SessionLocal() as database:
                commands = list(
                    database.scalars(
                        select(DeviceCommand).where(
                            DeviceCommand.status.in_(["pendiente", "enviado"]),
                            DeviceCommand.expires_at <= now,
                        )
                    ).all()
                )
                for command in commands:
                    command.status = "expirado"
                    command.error = "El dispositivo no confirmó el comando a tiempo"
                    device = database.get(Device, command.device_id)
                    if device:
                        event = add_device_event(
                            database,
                            device,
                            event_type="comando_expirado",
                            severity="critica",
                            message="El dispositivo no confirmó el comando a tiempo",
                            channel_id=command.channel_id,
                            details={"command_id": str(command.id)},
                        )
                        database.flush()
                        events.append(
                            {
                                "type": "command_ack",
                                "project_id": device.project_id,
                                "device_id": device.id,
                                "channel_id": command.channel_id,
                                "command_id": command.id,
                                "status": command.status,
                                "error": command.error,
                                "event": event,
                            }
                        )
                database.commit()
            for event in events:
                stored_event = event.pop("event")
                await realtime_manager.broadcast(event)
                await realtime_manager.broadcast(
                    {
                        "type": "event",
                        "project_id": stored_event.project_id,
                        "device_id": stored_event.device_id,
                        "channel_id": stored_event.channel_id,
                        "event_id": stored_event.id,
                        "event_type": stored_event.event_type,
                        "severity": stored_event.severity,
                        "message": stored_event.message,
                        "created_at": stored_event.created_at,
                    }
                )

    async def _cleanup_telemetry(self) -> None:
        while True:
            await asyncio.sleep(3600)
            now = datetime.now(UTC)
            with SessionLocal() as database:
                channels = list(database.scalars(select(Channel).where(Channel.retention_days > 0)))
                deleted = 0
                for channel in channels:
                    result = database.execute(
                        delete(Telemetry).where(
                            Telemetry.channel_id == channel.id,
                            Telemetry.recorded_at < now - timedelta(days=channel.retention_days),
                        )
                    )
                    deleted += result.rowcount or 0
                database.commit()
                if deleted:
                    logger.info("Limpieza de telemetría completada: %s lecturas", deleted)


mqtt_runtime = MqttRuntime()
