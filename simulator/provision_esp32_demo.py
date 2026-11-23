"""Aprovisiona y valida una demo persistente de ESP32 para UDLAIoT.

El script es idempotente: reutiliza proyecto, ubicación, dispositivo, canales y
sesión cuando ya existen. Deja el simulador ejecutándose al finalizar.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any

PROJECT_NAME = "Laboratorio ESP32"
LOCATION_NAME = "Invernadero didáctico"
DEVICE_NAME = "ESP32 Invernadero"
DEVICE_IDENTIFIER = "esp32-invernadero-01"
SESSION_NAME = "ESP32 · Ciclo de invernadero"

CHANNELS = (
    {
        "key": "temperatura",
        "name": "Temperatura ambiental",
        "description": "Lectura simulada del sensor DHT22.",
        "category": "sensor",
        "data_type": "numero",
        "unit": "°C",
        "gpio": "4",
        "writable": False,
        "widget_type": "grafico",
        "minimum_value": -10,
        "maximum_value": 60,
        "save_interval_seconds": 5,
        "minimum_change": 0.1,
    },
    {
        "key": "humedad_aire",
        "name": "Humedad del aire",
        "description": "Lectura simulada del sensor DHT22.",
        "category": "sensor",
        "data_type": "numero",
        "unit": "%",
        "gpio": "4",
        "writable": False,
        "widget_type": "grafico",
        "minimum_value": 0,
        "maximum_value": 100,
        "save_interval_seconds": 5,
        "minimum_change": 0.5,
    },
    {
        "key": "luz",
        "name": "Iluminación",
        "description": "Lectura simulada del sensor BH1750 por I²C.",
        "category": "sensor",
        "data_type": "numero",
        "unit": "lx",
        "gpio": "I2C 21/22",
        "writable": False,
        "widget_type": "grafico",
        "minimum_value": 0,
        "maximum_value": 65535,
        "save_interval_seconds": 5,
        "minimum_change": 5,
    },
    {
        "key": "humedad_suelo",
        "name": "Humedad del suelo",
        "description": "Lectura simulada de una sonda capacitiva analógica.",
        "category": "sensor",
        "data_type": "numero",
        "unit": "%",
        "gpio": "34",
        "writable": False,
        "widget_type": "grafico",
        "minimum_value": 0,
        "maximum_value": 100,
        "save_interval_seconds": 5,
        "minimum_change": 0.5,
    },
    {
        "key": "presion",
        "name": "Presión atmosférica",
        "description": "Lectura simulada del sensor BMP280 por I²C.",
        "category": "sensor",
        "data_type": "numero",
        "unit": "hPa",
        "gpio": "I2C 21/22",
        "writable": False,
        "widget_type": "grafico",
        "minimum_value": 300,
        "maximum_value": 1100,
        "save_interval_seconds": 5,
        "minimum_change": 0.2,
    },
    {
        "key": "led_estado",
        "name": "LED de estado",
        "description": "LED integrado de la placa ESP32.",
        "category": "actuador",
        "data_type": "booleano",
        "gpio": "2",
        "writable": True,
        "widget_type": "interruptor",
        "save_history": False,
    },
    {
        "key": "bomba_riego",
        "name": "Bomba de riego",
        "description": "Relé virtual de la bomba de agua.",
        "category": "actuador",
        "data_type": "booleano",
        "gpio": "26",
        "writable": True,
        "widget_type": "interruptor",
        "save_history": False,
    },
    {
        "key": "ventilacion",
        "name": "Apertura de ventilación",
        "description": "Servo virtual para ventilación del invernadero.",
        "category": "actuador",
        "data_type": "numero",
        "unit": "%",
        "gpio": "27",
        "writable": True,
        "widget_type": "deslizador",
        "minimum_value": 0,
        "maximum_value": 100,
        "save_history": False,
    },
)

SIGNALS = (
    {"key": "temperatura", "base": 24, "amplitude": 3.5, "period_seconds": 90, "noise": 0.15},
    {"key": "humedad_aire", "base": 64, "amplitude": 10, "period_seconds": 110, "noise": 0.4},
    {"key": "luz", "base": 650, "amplitude": 450, "period_seconds": 60, "noise": 8},
    {"key": "humedad_suelo", "base": 58, "amplitude": 14, "period_seconds": 150, "noise": 0.35},
    {"key": "presion", "base": 1012, "amplitude": 6, "period_seconds": 120, "noise": 0.15},
)

SCENARIO = {
    "name": "Ciclo automático de invernadero ESP32",
    "steps": [
        {
            "at_seconds": 30,
            "action": "ramp",
            "channel": "temperatura",
            "from": 24,
            "to": 32,
            "duration_seconds": 60,
        },
        {
            "at_seconds": 45,
            "action": "ramp",
            "channel": "humedad_suelo",
            "from": 65,
            "to": 30,
            "duration_seconds": 90,
        },
        {"at_seconds": 75, "action": "fault", "faults": {"latency_ms": 600}},
        {"at_seconds": 105, "action": "fault", "faults": {"latency_ms": 0}},
        {
            "at_seconds": 120,
            "action": "sequence",
            "channel": "humedad_aire",
            "values": [62, 58, 54, 66],
            "interval_seconds": 20,
        },
        {
            "at_seconds": 210,
            "action": "set",
            "values": {"temperatura": 25, "humedad_aire": 66, "humedad_suelo": 72},
        },
    ],
}


class Api:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None

    def request(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        payload = json.dumps(body).encode() if body is not None else None
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = urllib.request.Request(
            f"{self.base_url}{path}", data=payload, headers=headers, method=method
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                if response.status == 204:
                    return None
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")
            raise RuntimeError(f"{method} {path} devolvió {error.code}: {detail}") from error


def find(items: list[dict[str, Any]], field: str, value: str) -> dict[str, Any] | None:
    return next((item for item in items if item.get(field) == value), None)


def wait_for(label: str, callback, timeout: int = 30) -> Any:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = callback()
        if result:
            print(f"[OK] {label}")
            return result
        time.sleep(1)
    raise RuntimeError(f"Timeout esperando: {label}")


def confirmed_command(api: Api, channel_id: str, value: Any) -> dict[str, Any]:
    command = api.request(
        "POST", f"/api/channels/{channel_id}/commands", {"value": value, "timeout_seconds": 12}
    )
    return wait_for(
        f"ACK de comando {value!r}",
        lambda: (
            current
            if (current := api.request("GET", f"/api/commands/{command['id']}"))["status"]
            == "confirmado"
            else None
        ),
    )


def main() -> int:
    api = Api(os.getenv("UDLAIOT_API_URL", "http://localhost:18000"))
    username = os.getenv("UDLAIOT_USERNAME", "admin")
    password = os.getenv("UDLAIOT_PASSWORD", "Admin123!")

    login = api.request("POST", "/api/auth/login", {"username": username, "password": password})
    api.token = login["access_token"]
    print("[OK] Autenticación")

    projects = api.request("GET", "/api/projects")
    project = find(projects, "name", PROJECT_NAME)
    if project is None:
        project = api.request(
            "POST",
            "/api/projects",
            {
                "name": PROJECT_NAME,
                "description": "Laboratorio virtual con un ESP32 y sensores de invernadero conectados por MQTT.",
                "summary": "ESP32 DevKit con telemetría ambiental y control de riego, iluminación y ventilación.",
            },
        )
        print("[OK] Proyecto creado")
    else:
        print("[OK] Proyecto reutilizado")

    members = api.request("GET", f"/api/projects/{project['id']}/members")
    member_names = {member["username"] for member in members}
    for student in ("est1", "est2", "est3"):
        if student not in member_names:
            api.request(
                "POST",
                f"/api/projects/{project['id']}/members",
                {"username": student, "role_code": "editor"},
            )
    print("[OK] Estudiantes vinculados como editores")

    locations = api.request("GET", f"/api/projects/{project['id']}/locations")
    location = find(locations, "name", LOCATION_NAME)
    if location is None:
        location = api.request(
            "POST",
            f"/api/projects/{project['id']}/locations",
            {
                "name": LOCATION_NAME,
                "description": "Zona virtual para prácticas de agricultura inteligente.",
            },
        )

    devices = api.request("GET", f"/api/projects/{project['id']}/devices")
    device = find(devices, "device_identifier", DEVICE_IDENTIFIER)
    if device is None:
        device = api.request(
            "POST",
            f"/api/projects/{project['id']}/devices",
            {
                "name": DEVICE_NAME,
                "description": "ESP32 virtual conectado a Mosquitto, FastAPI, PostgreSQL y WebSocket.",
                "board_type": "ESP32 DevKit V1",
                "connection_type": "simulador",
                "device_identifier": DEVICE_IDENTIFIER,
                "location_id": location["id"],
                "firmware_version": "udlaiot-demo-1.0.0",
                "configuration": {
                    "wifi": True,
                    "mqtt": True,
                    "purpose": "invernadero",
                    "sensors": ["DHT22", "BH1750", "Sensor capacitivo", "BMP280"],
                },
            },
        )
        print("[OK] ESP32 creado")
    else:
        print("[OK] ESP32 reutilizado")

    existing_channels = api.request("GET", f"/api/devices/{device['id']}/channels")
    by_key = {channel["key"]: channel for channel in existing_channels}
    for definition in CHANNELS:
        if definition["key"] not in by_key:
            created = api.request("POST", f"/api/devices/{device['id']}/channels", definition)
            by_key[created["key"]] = created
    print(f"[OK] {len(CHANNELS)} canales disponibles")

    sessions = api.request("GET", f"/api/simulator/sessions?project_id={project['id']}")
    session = next(
        (item for item in sessions if item["device_id"] == device["id"] and item["name"] == SESSION_NAME),
        None,
    )
    if session is None:
        session = api.request(
            "POST",
            "/api/simulator/sessions",
            {
                "project_id": project["id"],
                "device_id": device["id"],
                "name": SESSION_NAME,
                "board_profile": "esp32_devkit",
                "tick_ms": 2000,
                "seed": 2026,
                "configuration": {"signals": list(SIGNALS)},
                "scenario": SCENARIO,
            },
        )
        print("[OK] Sesión de simulación creada")

    status = api.request("GET", f"/api/simulator/sessions/{session['id']}/status")
    if status["state"] not in {"ejecutando", "pausada"}:
        api.request("PATCH", f"/api/simulator/sessions/{session['id']}", {
            "tick_ms": 2000,
            "configuration": {"signals": list(SIGNALS)},
            "scenario": SCENARIO,
        })
        status = api.request("POST", f"/api/simulator/sessions/{session['id']}/start")
    elif status["state"] == "pausada":
        status = api.request("POST", f"/api/simulator/sessions/{session['id']}/resume")
    print("[OK] Simulador MQTT ejecutándose")

    sensors = [channel for channel in by_key.values() if channel["category"] == "sensor"]
    for sensor in sensors:
        wait_for(
            f"telemetría de {sensor['name']}",
            lambda sensor_id=sensor["id"]: (
                page
                if (page := api.request(
                    "GET", f"/api/channels/{sensor_id}/telemetry?page=1&page_size=1"
                ))["total"]
                else None
            ),
        )

    confirmed_command(api, by_key["led_estado"]["id"], True)
    confirmed_command(api, by_key["bomba_riego"]["id"], True)
    confirmed_command(api, by_key["bomba_riego"]["id"], False)
    confirmed_command(api, by_key["ventilacion"]["id"], 35)

    status = api.request("GET", f"/api/simulator/sessions/{session['id']}/status")
    summary = {
        "project_id": project["id"],
        "device_id": device["id"],
        "session_id": session["id"],
        "state": status["state"],
        "connected": status["connected"],
        "messages_sent": status["messages_sent"],
        "sensor_values": status["values"],
        "actuators": status["actuators"],
        "web": "http://localhost:15173/app/simulador",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, KeyError, ValueError) as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        raise SystemExit(1) from error
