"""Prueba de humo de UDLAIoT usando el simulador administrado.

Esta prueba crea y archiva datos reales. Úsala únicamente en un entorno de desarrollo.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from collections.abc import Callable
from typing import Any


class Api:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None

    def request(self, method: str, path: str, body: dict | str | None = None) -> Any:
        if isinstance(body, str):
            payload = body.encode()
            headers = {"Content-Type": "text/plain"}
        else:
            payload = json.dumps(body).encode() if body is not None else None
            headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = urllib.request.Request(
            f"{self.base_url}{path}", data=payload, headers=headers, method=method
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status == 204:
                    return None
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")
            raise RuntimeError(f"{method} {path} devolvió {error.code}: {detail}") from error


def wait_until(label: str, check: Callable[[], Any], timeout: int = 25) -> Any:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            print(f"[OK] {label}")
            return result
        time.sleep(1)
    raise RuntimeError(f"Timeout esperando: {label}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--confirm-write",
        action="store_true",
        help="Confirma que se pueden crear y archivar datos en el entorno indicado.",
    )
    args = parser.parse_args()
    if not args.confirm_write:
        parser.error(
            "Esta prueba modifica datos; añade --confirm-write en un entorno de desarrollo"
        )

    api = Api(os.getenv("UDLAIOT_API_URL", "http://localhost:18000"))
    username = os.getenv("UDLAIOT_USERNAME", "admin")
    password = os.getenv("UDLAIOT_PASSWORD", "Admin123!")
    suffix = uuid.uuid4().hex[:8]
    project_id = session_id = device_id = None

    try:
        login = api.request("POST", "/api/auth/login", {"username": username, "password": password})
        api.token = login["access_token"]
        print("[OK] Autenticación")

        project = api.request(
            "POST",
            "/api/projects",
            {
                "name": f"E2E Simulador {suffix}",
                "description": "Proyecto temporal creado por simulator/verify_stack.py",
            },
        )
        project_id = project["id"]
        device = api.request(
            "POST",
            f"/api/projects/{project_id}/devices",
            {
                "name": "ESP32 E2E",
                "board_type": "ESP32 DevKit",
                "connection_type": "simulador",
                "device_identifier": f"esp32-e2e-{suffix}",
            },
        )
        device_id = device["id"]
        sensor = api.request(
            "POST",
            f"/api/devices/{device['id']}/channels",
            {
                "key": "temperatura",
                "name": "Temperatura",
                "category": "sensor",
                "data_type": "numero",
                "unit": "°C",
                "gpio": "34",
                "widget_type": "grafico",
                "minimum_value": 0,
                "maximum_value": 80,
            },
        )
        actuator = api.request(
            "POST",
            f"/api/devices/{device['id']}/channels",
            {
                "key": "led",
                "name": "LED",
                "category": "actuador",
                "data_type": "booleano",
                "gpio": "2",
                "writable": True,
                "widget_type": "interruptor",
            },
        )
        print("[OK] Proyecto, dispositivo y canales")

        session = api.request(
            "POST",
            "/api/simulator/sessions",
            {
                "project_id": project_id,
                "device_id": device["id"],
                "name": "Smoke test",
                "board_profile": "esp32_devkit",
                "tick_ms": 500,
                "seed": 42,
            },
        )
        session_id = session["id"]
        scenario_yaml = """name: Ciclo E2E
steps:
  - at_seconds: 0
    action: ramp
    channel: temperatura
    from: 20
    to: 30
    duration_seconds: 2
  - at_seconds: 2
    action: sequence
    channel: temperatura
    values: [30, 28, 26]
    interval_seconds: 0.5
"""
        imported = api.request(
            "POST",
            f"/api/simulator/sessions/{session_id}/scenario/import?format=yaml",
            scenario_yaml,
        )
        assert len(imported["scenario"]["steps"]) == 2
        exported = api.request(
            "GET", f"/api/simulator/sessions/{session_id}/scenario/export?format=json"
        )
        assert exported["name"] == "Ciclo E2E"
        print("[OK] escenario YAML importado y JSON exportado")
        api.request("POST", f"/api/simulator/sessions/{session_id}/start")
        print("[OK] Runtime MQTT iniciado")

        def read_telemetry() -> Any:
            path = f"/api/channels/{sensor['id']}/telemetry?page=1&page_size=5"
            data = api.request("GET", path)
            return data if data["total"] else None

        telemetry = wait_until("telemetría persistida", read_telemetry)
        assert telemetry["items"]

        command = api.request(
            "POST", f"/api/channels/{actuator['id']}/commands", {"value": True}
        )
        confirmed = wait_until(
            "comando confirmado por ACK",
            lambda: (
                item
                if (item := api.request("GET", f"/api/commands/{command['id']}"))["status"]
                == "confirmado"
                else None
            ),
        )
        assert confirmed["value"] is True

        disconnected = api.request(
            "POST",
            f"/api/simulator/sessions/{session_id}/faults",
            {"network_disconnected": True},
        )
        assert disconnected["connected"] is False
        wait_until(
            "desconexión MQTT persistida",
            lambda: (
                current
                if (current := api.request("GET", f"/api/devices/{device_id}"))["status"]
                == "desconectado"
                else None
            ),
        )
        reconnected = api.request(
            "POST",
            f"/api/simulator/sessions/{session_id}/faults",
            {"network_disconnected": False},
        )
        assert reconnected["connected"] is True
        wait_until(
            "reconexión MQTT persistida",
            lambda: (
                current
                if (current := api.request("GET", f"/api/devices/{device_id}"))["status"]
                == "conectado"
                else None
            ),
        )
        stopped = api.request("POST", f"/api/simulator/sessions/{session_id}/stop")
        assert stopped["state"] == "detenida"
        run_history = api.request("GET", f"/api/simulator/runs?session_id={session_id}")
        assert run_history and run_history[0]["finished_at"]
        assert run_history[0]["summary"]["messages_sent"] > 0
        print("[OK] reporte e historial persistidos")
        print(
            "\nPrueba completa: simulador -> MQTT -> backend -> PostgreSQL "
            "-> comando -> ACK -> desconexion -> reconexion"
        )
        return 0
    except (OSError, RuntimeError, KeyError, AssertionError) as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        return 1
    finally:
        if session_id:
            try:
                api.request("POST", f"/api/simulator/sessions/{session_id}/stop")
                api.request("DELETE", f"/api/simulator/sessions/{session_id}")
            except (OSError, RuntimeError, KeyError) as error:
                print(f"[WARN] No se pudo limpiar la sesión: {error}", file=sys.stderr)
        if project_id:
            try:
                api.request("DELETE", f"/api/projects/{project_id}")
            except (OSError, RuntimeError, KeyError) as error:
                print(f"[WARN] No se pudo archivar el proyecto temporal: {error}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
