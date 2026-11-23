from __future__ import annotations

import json
import math
import random
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime
from secrets import token_urlsafe
from typing import Any

import paho.mqtt.client as mqtt

from app.core.config import settings
from app.models import Channel, Device, SimulatorSession
from app.services.mqtt_security import MqttSecurityError, mqtt_security


@dataclass(frozen=True)
class BoardProfile:
    id: str
    name: str
    family: str
    digital_pins: int
    analog_pins: int
    connectivity: tuple[str, ...]


BOARD_PROFILES = (
    BoardProfile("generic_mqtt", "Dispositivo MQTT genérico", "generic", 0, 0, ("mqtt",)),
    BoardProfile("arduino_uno", "Arduino Uno", "avr", 14, 6, ("serial", "mqtt_bridge")),
    BoardProfile("arduino_nano", "Arduino Nano", "avr", 14, 8, ("serial", "mqtt_bridge")),
    BoardProfile("arduino_mega", "Arduino Mega 2560", "avr", 54, 16, ("serial", "mqtt_bridge")),
    BoardProfile("arduino_leonardo", "Arduino Leonardo", "avr", 20, 12, ("serial", "mqtt_bridge")),
    BoardProfile("esp32_devkit", "ESP32 DevKit", "esp32", 25, 15, ("mqtt", "wifi")),
    BoardProfile("esp32_s3", "ESP32-S3", "esp32", 45, 20, ("mqtt", "wifi", "usb")),
    BoardProfile("esp32_c3", "ESP32-C3", "esp32", 22, 6, ("mqtt", "wifi", "bluetooth")),
    BoardProfile("esp8266", "ESP8266 NodeMCU", "esp", 11, 1, ("mqtt", "wifi")),
    BoardProfile("raspberry_pico", "Raspberry Pi Pico", "rp2040", 26, 3, ("serial", "mqtt_bridge")),
    BoardProfile("raspberry_pico_w", "Raspberry Pi Pico W", "rp2040", 26, 3, ("mqtt", "wifi")),
    BoardProfile(
        "raspberry_pi_zero",
        "Raspberry Pi Zero",
        "raspberry_linux",
        28,
        0,
        ("mqtt", "wifi", "linux"),
    ),
    BoardProfile(
        "raspberry_pi_3",
        "Raspberry Pi 3",
        "raspberry_linux",
        28,
        0,
        ("mqtt", "wifi", "ethernet", "linux"),
    ),
    BoardProfile(
        "raspberry_pi_4",
        "Raspberry Pi 4",
        "raspberry_linux",
        28,
        0,
        ("mqtt", "wifi", "ethernet", "linux"),
    ),
    BoardProfile("custom_board", "Placa personalizada", "custom", 0, 0, ("mqtt",)),
)


STARTER_KITS: dict[str, dict[str, Any]] = {
    "basic": {
        "name": "Kit básico",
        "description": "Temperatura y un LED para la primera prueba.",
        "channels": [
            {
                "key": "temperatura",
                "name": "Temperatura",
                "category": "sensor",
                "data_type": "numero",
                "unit": "°C",
                "widget_type": "gauge",
                "minimum_value": -10,
                "maximum_value": 80,
            },
            {
                "key": "led",
                "name": "LED",
                "category": "actuador",
                "data_type": "booleano",
                "unit": None,
                "widget_type": "switch",
            },
        ],
    },
    "environmental": {
        "name": "Monitoreo ambiental",
        "description": "Temperatura, humedad, iluminación, ventilación y LED.",
        "channels": [
            {
                "key": "temperatura",
                "name": "Temperatura ambiental",
                "category": "sensor",
                "data_type": "numero",
                "unit": "°C",
                "widget_type": "gauge",
                "minimum_value": -10,
                "maximum_value": 80,
            },
            {
                "key": "humedad",
                "name": "Humedad del aire",
                "category": "sensor",
                "data_type": "numero",
                "unit": "%",
                "widget_type": "gauge",
                "minimum_value": 0,
                "maximum_value": 100,
            },
            {
                "key": "luz",
                "name": "Iluminación",
                "category": "sensor",
                "data_type": "numero",
                "unit": "lx",
                "widget_type": "gauge",
                "minimum_value": 0,
                "maximum_value": 1200,
            },
            {
                "key": "ventilador",
                "name": "Ventilador",
                "category": "actuador",
                "data_type": "booleano",
                "unit": None,
                "widget_type": "switch",
            },
            {
                "key": "led",
                "name": "LED de estado",
                "category": "actuador",
                "data_type": "booleano",
                "unit": None,
                "widget_type": "switch",
            },
        ],
    },
    "greenhouse": {
        "name": "Invernadero inteligente",
        "description": "Ambiente, suelo, luz, ventilación y riego automático.",
        "channels": [
            {
                "key": "temperatura",
                "name": "Temperatura ambiental",
                "category": "sensor",
                "data_type": "numero",
                "unit": "°C",
                "widget_type": "gauge",
                "minimum_value": -10,
                "maximum_value": 80,
            },
            {
                "key": "humedad",
                "name": "Humedad del aire",
                "category": "sensor",
                "data_type": "numero",
                "unit": "%",
                "widget_type": "gauge",
                "minimum_value": 0,
                "maximum_value": 100,
            },
            {
                "key": "humedad_suelo",
                "name": "Humedad del suelo",
                "category": "sensor",
                "data_type": "numero",
                "unit": "%",
                "widget_type": "gauge",
                "minimum_value": 0,
                "maximum_value": 100,
            },
            {
                "key": "luz",
                "name": "Iluminación",
                "category": "sensor",
                "data_type": "numero",
                "unit": "lx",
                "widget_type": "gauge",
                "minimum_value": 0,
                "maximum_value": 1200,
            },
            {
                "key": "ventilador",
                "name": "Ventilador",
                "category": "actuador",
                "data_type": "booleano",
                "unit": None,
                "widget_type": "switch",
            },
            {
                "key": "bomba_riego",
                "name": "Bomba de riego",
                "category": "actuador",
                "data_type": "booleano",
                "unit": None,
                "widget_type": "switch",
            },
        ],
    },
    "automation": {
        "name": "Automatización y movimiento",
        "description": "Movimiento, distancia y luz con relé, servo y alarma.",
        "channels": [
            {
                "key": "movimiento",
                "name": "Movimiento PIR",
                "category": "sensor",
                "data_type": "booleano",
                "unit": None,
                "widget_type": "status",
            },
            {
                "key": "distancia",
                "name": "Distancia ultrasónica",
                "category": "sensor",
                "data_type": "numero",
                "unit": "cm",
                "widget_type": "gauge",
                "minimum_value": 2,
                "maximum_value": 400,
            },
            {
                "key": "luminosidad",
                "name": "Luminosidad",
                "category": "sensor",
                "data_type": "numero",
                "unit": "%",
                "widget_type": "gauge",
                "minimum_value": 0,
                "maximum_value": 100,
            },
            {
                "key": "rele",
                "name": "Relé",
                "category": "actuador",
                "data_type": "booleano",
                "unit": None,
                "widget_type": "switch",
            },
            {
                "key": "servo",
                "name": "Servo",
                "category": "actuador",
                "data_type": "numero",
                "unit": "°",
                "widget_type": "slider",
                "minimum_value": 0,
                "maximum_value": 180,
            },
            {
                "key": "alarma",
                "name": "Alarma",
                "category": "actuador",
                "data_type": "booleano",
                "unit": None,
                "widget_type": "switch",
            },
        ],
    },
}


def board_profiles() -> list[dict[str, Any]]:
    return [
        {
            "id": profile.id,
            "name": profile.name,
            "family": profile.family,
            "digital_pins": profile.digital_pins,
            "analog_pins": profile.analog_pins,
            "connectivity": list(profile.connectivity),
        }
        for profile in BOARD_PROFILES
    ]


def starter_kits() -> list[dict[str, Any]]:
    return [
        {
            "id": kit_id,
            "name": kit["name"],
            "description": kit["description"],
            "sensor_count": sum(item["category"] == "sensor" for item in kit["channels"]),
            "actuator_count": sum(item["category"] == "actuador" for item in kit["channels"]),
            "component_ids": [item["key"] for item in kit["channels"]],
        }
        for kit_id, kit in STARTER_KITS.items()
    ]


def component_catalog() -> list[dict[str, Any]]:
    components: dict[str, dict[str, Any]] = {}
    for kit in STARTER_KITS.values():
        for channel in kit["channels"]:
            components.setdefault(channel["key"], dict(channel))
    return [dict(component, id=component_id) for component_id, component in components.items()]


def starter_kit_channels(
    kit_id: str, component_ids: list[str] | None = None
) -> list[dict[str, Any]]:
    kit = STARTER_KITS.get(kit_id)
    if kit is None:
        raise ValueError("Kit inicial no soportado")
    available = {component["id"]: component for component in component_catalog()}
    selected_ids = component_ids or [item["key"] for item in kit["channels"]]
    unknown = [component_id for component_id in selected_ids if component_id not in available]
    if unknown:
        raise ValueError(f"Componentes no soportados: {', '.join(unknown)}")
    channels = [available[component_id] for component_id in dict.fromkeys(selected_ids)]
    if not any(channel["category"] == "sensor" for channel in channels):
        raise ValueError("Selecciona al menos un sensor para iniciar la simulación")
    return [dict(channel, gpio=f"V{index + 1}") for index, channel in enumerate(channels)]


def default_signal(channel: dict[str, Any]) -> dict[str, Any]:
    text = f"{channel['key']} {channel['name']} {channel.get('unit') or ''}".lower()
    minimum = channel.get("minimum_value")
    maximum = channel.get("maximum_value")
    if "temp" in text or "°c" in text:
        base, amplitude, period = 24.0, 3.0, 45.0
    elif "hum" in text or channel.get("unit") == "%":
        base, amplitude, period = 62.0, 8.0, 60.0
    elif "luz" in text or "lux" in text:
        base, amplitude, period = 450.0, 250.0, 30.0
    elif "volt" in text:
        base, amplitude, period = 3.3, 0.15, 20.0
    elif minimum is not None and maximum is not None:
        base = (float(minimum) + float(maximum)) / 2
        amplitude = max((float(maximum) - float(minimum)) / 4, 0.1)
        period = 40.0
    else:
        base, amplitude, period = 50.0, 10.0, 40.0
    return {
        "channel_id": str(channel["id"]),
        "key": channel["key"],
        "name": channel["name"],
        "data_type": channel["data_type"],
        "unit": channel.get("unit"),
        "gpio": channel.get("gpio"),
        "base": base,
        "amplitude": amplitude,
        "period_seconds": period,
        "noise": max(amplitude * 0.025, 0.02),
        "minimum": minimum,
        "maximum": maximum,
    }


def calculate_signal(spec: dict[str, Any], elapsed: float, noise: float) -> Any:
    data_type = spec.get("data_type", "numero")
    if data_type == "booleano":
        period = max(float(spec.get("period_seconds", 10)), 1)
        return int(elapsed / period) % 2 == 0
    if data_type == "texto":
        return str(spec.get("value", "simulado"))
    base = float(spec.get("base", 0))
    amplitude = float(spec.get("amplitude", 1))
    period = max(float(spec.get("period_seconds", 30)), 0.1)
    value = base + math.sin(elapsed * math.tau / period) * amplitude + noise
    minimum = spec.get("minimum")
    maximum = spec.get("maximum")
    if minimum is not None:
        value = max(float(minimum), value)
    if maximum is not None:
        value = min(float(maximum), value)
    if data_type == "entero":
        return int(round(value))
    return round(value, 3)


class SimulatedDeviceRuntime:
    def __init__(
        self,
        *,
        session: SimulatorSession,
        device: Device,
        channels: list[dict[str, Any]],
        username: str,
        password: str,
        client_id: str,
    ) -> None:
        self.session_id = session.id
        self.device_id = device.id
        self.topic_base = f"nexiot/devices/{device.id}"
        self.tick_seconds = session.tick_ms / 1000
        self.random = random.Random(session.seed)
        self.sensor_specs = self._build_specs(session.configuration, channels, "sensor")
        self.actuator_specs = {
            item["key"]: item
            for item in channels
            if item["category"] == "actuador" and item["active"]
        }
        self.actuator_keys = set(self.actuator_specs)
        self.scenario_steps = sorted(
            session.scenario.get("steps", []), key=lambda item: float(item.get("at_seconds", 0))
        )
        self.applied_steps: set[int] = set()
        self.manual_values: dict[str, Any] = {}
        self.values: dict[str, Any] = {}
        self.actuator_values: dict[str, Any] = {
            key: False if item["data_type"] == "booleano" else item.get("minimum_value") or 0
            for key, item in self.actuator_specs.items()
        }
        self.faults: dict[str, Any] = {
            "network_disconnected": False,
            "drop_ack": False,
            "latency_ms": 0,
            "noise_multiplier": 1.0,
        }
        self.logs: deque[dict[str, Any]] = deque(maxlen=250)
        self.messages_sent = 0
        self.started_monotonic = time.monotonic()
        self.state = "preparando"
        self.last_error: str | None = None
        self.stop_event = threading.Event()
        self.ready_event = threading.Event()
        self.lock = threading.RLock()
        self.thread = threading.Thread(
            target=self._run, name=f"simulator-{session.id.hex[:8]}", daemon=True
        )
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=client_id,
            protocol=mqtt.MQTTv311,
        )
        self.client.username_pw_set(username, password)
        self.client.will_set(f"{self.topic_base}/status", "offline", qos=1, retain=True)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.reconnect_delay_set(min_delay=1, max_delay=8)

    @staticmethod
    def _build_specs(
        configuration: dict[str, Any], channels: list[dict[str, Any]], category: str
    ) -> list[dict[str, Any]]:
        configured = configuration.get("signals", [])
        by_key = {item.get("key"): item for item in configured if isinstance(item, dict)}
        result = []
        for channel in channels:
            if channel["category"] != category or not channel["active"]:
                continue
            spec = default_signal(channel)
            if channel["key"] in by_key:
                spec.update(by_key[channel["key"]])
            result.append(spec)
        return result

    def start(self) -> None:
        self.thread.start()
        if not self.ready_event.wait(timeout=7):
            self.stop()
            raise RuntimeError("El simulador no pudo conectarse a Mosquitto a tiempo")
        if self.state == "fallida":
            raise RuntimeError(self.last_error or "No fue posible iniciar el simulador")

    def stop(self) -> None:
        self.stop_event.set()
        if self.thread.is_alive() and self.thread is not threading.current_thread():
            self.thread.join(timeout=5)

    def pause(self) -> None:
        with self.lock:
            if self.state != "ejecutando":
                raise RuntimeError("La sesión no está en ejecución")
            self.state = "pausada"
            self._log("info", "Simulación pausada")

    def resume(self) -> None:
        with self.lock:
            if self.state != "pausada":
                raise RuntimeError("La sesión no está pausada")
            self.started_monotonic = time.monotonic()
            self.state = "ejecutando"
            self._log("info", "Simulación reanudada")

    def reset(self) -> None:
        with self.lock:
            self.started_monotonic = time.monotonic()
            self.applied_steps.clear()
            self.manual_values.clear()
            self.values.clear()
            self.actuator_values = {
                key: False if item["data_type"] == "booleano" else item.get("minimum_value") or 0
                for key, item in self.actuator_specs.items()
            }
            self.messages_sent = 0
            self._log("info", "Estado y reloj reiniciados")

    def set_inputs(self, values: dict[str, Any]) -> None:
        allowed = {item["key"] for item in self.sensor_specs}
        unknown = set(values) - allowed
        if unknown:
            raise ValueError(f"Canales no simulables: {', '.join(sorted(unknown))}")
        with self.lock:
            self.manual_values.update(values)
            self._log("input", f"Entradas manuales actualizadas: {', '.join(values)}")

    def set_faults(self, values: dict[str, Any]) -> None:
        with self.lock:
            was_disconnected = bool(self.faults["network_disconnected"])
            self.faults.update({key: value for key, value in values.items() if value is not None})
            disconnected = bool(self.faults["network_disconnected"])
            if disconnected != was_disconnected and self.client.is_connected():
                status = "offline" if disconnected else "online"
                self.client.publish(f"{self.topic_base}/status", status, qos=1, retain=True)
            self._log("fault", "Fallos actualizados", dict(self.faults))

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            elapsed = max(0, time.monotonic() - self.started_monotonic)
            return {
                "session_id": str(self.session_id),
                "device_id": str(self.device_id),
                "state": self.state,
                "connected": self.client.is_connected() and not self.faults["network_disconnected"],
                "elapsed_seconds": round(elapsed, 1),
                "messages_sent": self.messages_sent,
                "values": dict(self.values),
                "actuators": dict(self.actuator_values),
                "faults": dict(self.faults),
                "last_error": self.last_error,
                "logs": list(self.logs)[-30:],
            }

    def _log(self, level: str, message: str, data: dict[str, Any] | None = None) -> None:
        self.logs.append(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "level": level,
                "message": message,
                "data": data or {},
            }
        )

    def _on_connect(self, client, userdata, flags, reason_code, properties) -> None:  # noqa: ANN001
        del userdata, flags, properties
        with self.lock:
            if reason_code.is_failure:
                self.state = "fallida"
                self.last_error = f"Mosquitto rechazó la conexión: {reason_code}"
                self._log("error", self.last_error)
                self.ready_event.set()
                return
            client.subscribe(f"{self.topic_base}/commands/#", qos=1)
            client.publish(f"{self.topic_base}/status", "online", qos=1, retain=True)
            self.state = "ejecutando"
            self._log("info", "Conectado a Mosquitto y escuchando comandos")
            self.ready_event.set()

    def _on_disconnect(self, client, userdata, flags, reason_code, properties) -> None:  # noqa: ANN001
        del client, userdata, flags, properties
        if not self.stop_event.is_set():
            self._log("warning", f"Conexión MQTT interrumpida: {reason_code}")

    def _on_message(self, client, userdata, message) -> None:  # noqa: ANN001
        del userdata
        key = message.topic.rsplit("/", 1)[-1]
        if key not in self.actuator_keys:
            return
        if self.faults["network_disconnected"]:
            self._log("fault", f"Comando descartado por desconexión simulada: {key}")
            return
        try:
            payload = json.loads(message.payload.decode("utf-8"))
            command_id = str(uuid.UUID(str(payload["command_id"])))
            value = payload["value"]
        except (UnicodeDecodeError, json.JSONDecodeError, KeyError, ValueError) as error:
            self._log("error", f"Comando inválido para {key}: {error}")
            return
        with self.lock:
            self.actuator_values[key] = value
            self._log("command", f"Comando recibido: {key} = {value}")
            drop_ack = bool(self.faults["drop_ack"])
            latency = int(self.faults["latency_ms"])
        if drop_ack:
            self._log("fault", f"ACK descartado intencionalmente para {key}")
            return

        def publish_ack() -> None:
            if self.stop_event.is_set() or not client.is_connected():
                return
            ack = {"command_id": command_id, "status": "confirmed", "value": value}
            client.publish(
                f"{self.topic_base}/ack/{key}",
                json.dumps(ack, separators=(",", ":")),
                qos=1,
            )
            self._log("ack", f"ACK confirmado para {key}")

        if latency:
            threading.Timer(latency / 1000, publish_ack).start()
        else:
            publish_ack()

    def _apply_scenario(self, elapsed: float) -> None:
        for index, step in enumerate(self.scenario_steps):
            starts_at = float(step.get("at_seconds", 0))
            if elapsed < starts_at:
                continue
            action = step.get("action", "set")
            allowed = {item["key"] for item in self.sensor_specs}
            if action == "ramp":
                channel = step.get("channel")
                if channel not in allowed:
                    continue
                duration = max(float(step.get("duration_seconds", 1)), 0.1)
                progress = min(max((elapsed - starts_at) / duration, 0), 1)
                start = float(step.get("from", 0))
                end = float(step.get("to", start))
                self.manual_values[channel] = round(start + (end - start) * progress, 3)
                if progress >= 1 and index not in self.applied_steps:
                    self._log("scenario", f"Rampa {index + 1} completada", {channel: end})
                    self.applied_steps.add(index)
                continue
            if action == "sequence":
                channel = step.get("channel")
                values = step.get("values", [])
                if channel not in allowed or not isinstance(values, list) or not values:
                    continue
                interval = max(float(step.get("interval_seconds", 1)), 0.1)
                position = min(int((elapsed - starts_at) / interval), len(values) - 1)
                self.manual_values[channel] = values[position]
                if position == len(values) - 1 and index not in self.applied_steps:
                    self._log("scenario", f"Secuencia {index + 1} completada", {channel: values})
                    self.applied_steps.add(index)
                continue
            if index in self.applied_steps:
                continue
            if action == "fault":
                faults = step.get("faults", {})
                if isinstance(faults, dict):
                    self.set_faults(faults)
                    self._log("scenario", f"Fallo programado {index + 1} aplicado", faults)
            else:
                values = step.get("values", step.get("set", {}))
                if isinstance(values, dict):
                    accepted = {key: value for key, value in values.items() if key in allowed}
                    self.manual_values.update(accepted)
                    self._log("scenario", f"Paso {index + 1} aplicado", accepted)
            self.applied_steps.add(index)

    def _publish_telemetry(self, elapsed: float) -> None:
        if self.faults["network_disconnected"]:
            return
        self._apply_scenario(elapsed)
        timestamp = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        noise_multiplier = float(self.faults["noise_multiplier"])
        for spec in self.sensor_specs:
            key = spec["key"]
            if key in self.manual_values:
                value = self.manual_values[key]
            else:
                noise = self.random.uniform(-float(spec["noise"]), float(spec["noise"]))
                value = calculate_signal(spec, elapsed, noise * noise_multiplier)
            self.values[key] = value
            payload = json.dumps({"value": value, "timestamp": timestamp}, separators=(",", ":"))
            result = self.client.publish(
                f"{self.topic_base}/telemetry/{key}", payload=payload, qos=1
            )
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                self.messages_sent += 1
        self._log("telemetry", f"Publicados {len(self.sensor_specs)} canales", dict(self.values))

    def _run(self) -> None:
        try:
            self.client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=30)
            self.client.loop_start()
            if not self.ready_event.wait(timeout=6):
                raise RuntimeError("Mosquitto no confirmó la conexión")
            while not self.stop_event.wait(self.tick_seconds):
                with self.lock:
                    if self.state != "ejecutando":
                        continue
                    elapsed = time.monotonic() - self.started_monotonic
                    if elapsed >= settings.simulator_max_duration_seconds:
                        self._log("limit", "Tiempo máximo de sesión alcanzado")
                        self.stop_event.set()
                        break
                    self._publish_telemetry(elapsed)
        except (OSError, RuntimeError) as error:
            with self.lock:
                self.state = "fallida"
                self.last_error = str(error)
                self._log("error", self.last_error)
                self.ready_event.set()
        finally:
            try:
                if self.client.is_connected():
                    self.client.publish(
                        f"{self.topic_base}/status", "offline", qos=1, retain=True
                    ).wait_for_publish(timeout=2)
                    self.client.disconnect()
            finally:
                self.client.loop_stop()
                with self.lock:
                    if self.state != "fallida":
                        self.state = "detenida"
                    self._log("info", "Simulación detenida")


class SimulatorManager:
    def __init__(self) -> None:
        self.runtimes: dict[uuid.UUID, SimulatedDeviceRuntime] = {}
        self.security: dict[uuid.UUID, tuple[str, str]] = {}
        self.lock = threading.RLock()

    def start(
        self, session: SimulatorSession, device: Device, channels: list[Channel]
    ) -> dict[str, Any]:
        with self.lock:
            active = [
                runtime
                for runtime in self.runtimes.values()
                if runtime.state in {"preparando", "ejecutando", "pausada"}
            ]
            if len(active) >= settings.simulator_max_active_sessions:
                raise RuntimeError("Se alcanzó el límite global de sesiones simultáneas")
            user_active = [
                runtime
                for runtime in active
                if getattr(runtime, "created_by_id", None) == session.created_by_id
            ]
            if len(user_active) >= settings.simulator_max_sessions_per_user:
                raise RuntimeError("Se alcanzó el límite de sesiones simultáneas por usuario")
            for runtime in self.runtimes.values():
                if runtime.device_id == device.id and runtime.state in {
                    "preparando",
                    "ejecutando",
                    "pausada",
                }:
                    raise RuntimeError("El dispositivo ya tiene una sesión activa")
            existing = self.runtimes.get(session.id)
            if existing and existing.state in {"preparando", "ejecutando", "pausada"}:
                raise RuntimeError("La sesión ya está activa")
            if existing:
                existing.stop()
                self._revoke(session.id)

            username = f"sim-{session.id.hex}"
            role_name = f"nexiot-simulator-{session.id.hex}"
            password = token_urlsafe(32)
            client_id = f"simulator-{session.id.hex}"
            topic_base = f"nexiot/devices/{device.id}"
            mqtt_security.revoke_device_client(username=username, role_name=role_name)
            mqtt_security.create_device_client(
                username=username,
                password=password,
                client_id=client_id,
                role_name=role_name,
                topic_base=topic_base,
            )
            channel_data = [
                {
                    "id": channel.id,
                    "key": channel.key,
                    "name": channel.name,
                    "category": channel.category,
                    "data_type": channel.data_type,
                    "unit": channel.unit,
                    "gpio": channel.gpio,
                    "minimum_value": channel.minimum_value,
                    "maximum_value": channel.maximum_value,
                    "active": channel.active,
                }
                for channel in channels
            ]
            runtime = SimulatedDeviceRuntime(
                session=session,
                device=device,
                channels=channel_data,
                username=username,
                password=password,
                client_id=client_id,
            )
            runtime.created_by_id = session.created_by_id
            self.runtimes[session.id] = runtime
            self.security[session.id] = (username, role_name)
        try:
            runtime.start()
            return runtime.snapshot()
        except Exception:
            self._revoke(session.id)
            with self.lock:
                self.runtimes.pop(session.id, None)
            raise

    def get(self, session_id: uuid.UUID) -> SimulatedDeviceRuntime | None:
        return self.runtimes.get(session_id)

    def temporary_credential_for_device(self, device_id: uuid.UUID) -> dict[str, Any] | None:
        with self.lock:
            for session_id, runtime in self.runtimes.items():
                if runtime.device_id != device_id or runtime.state not in {
                    "preparando",
                    "ejecutando",
                    "pausada",
                }:
                    continue
                credentials = self.security.get(session_id)
                if credentials is None:
                    continue
                username, _ = credentials
                return {
                    "session_id": session_id,
                    "username": username,
                    "client_id": f"simulator-{session_id.hex}",
                    "state": runtime.state,
                }
        return None

    def stop(self, session_id: uuid.UUID) -> dict[str, Any] | None:
        runtime = self.runtimes.get(session_id)
        if runtime is None:
            return None
        runtime.stop()
        self._revoke(session_id)
        return runtime.snapshot()

    def remove(self, session_id: uuid.UUID) -> None:
        self.stop(session_id)
        with self.lock:
            self.runtimes.pop(session_id, None)

    def shutdown_all(self) -> None:
        for session_id in list(self.runtimes):
            try:
                self.stop(session_id)
            except Exception:
                pass

    def _revoke(self, session_id: uuid.UUID) -> None:
        credentials = self.security.pop(session_id, None)
        if credentials is None:
            return
        username, role_name = credentials
        try:
            mqtt_security.revoke_device_client(username=username, role_name=role_name)
        except MqttSecurityError:
            pass


simulator_manager = SimulatorManager()
