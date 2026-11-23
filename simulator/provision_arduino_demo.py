"""Crea y valida un laboratorio Arduino Uno con sensores y actuadores."""

from __future__ import annotations

import json
import os
import sys
import time

from provision_esp32_demo import Api, confirmed_command, find, wait_for

PROJECT_NAME = "Laboratorio Arduino"
LOCATION_NAME = "Banco de electrónica"
DEVICE_NAME = "Arduino Uno · Aula IoT"
DEVICE_IDENTIFIER = "arduino-uno-aula-01"
SESSION_NAME = "Arduino Uno · Práctica multisensor"

CHANNELS = (
    {"key": "temperatura_ambiente", "name": "Temperatura DHT22", "description": "Temperatura ambiental simulada con DHT22.", "category": "sensor", "data_type": "numero", "unit": "°C", "gpio": "7", "writable": False, "widget_type": "grafico", "minimum_value": -10, "maximum_value": 60, "save_interval_seconds": 5, "minimum_change": 0.1},
    {"key": "humedad_aire", "name": "Humedad DHT22", "description": "Humedad relativa simulada con DHT22.", "category": "sensor", "data_type": "numero", "unit": "%", "gpio": "7", "writable": False, "widget_type": "grafico", "minimum_value": 0, "maximum_value": 100, "save_interval_seconds": 5, "minimum_change": 0.5},
    {"key": "distancia_hc_sr04", "name": "Distancia HC-SR04", "description": "Distancia ultrasónica para prácticas de proximidad.", "category": "sensor", "data_type": "numero", "unit": "cm", "gpio": "TRIG 9 / ECHO 10", "writable": False, "widget_type": "grafico", "minimum_value": 2, "maximum_value": 400, "save_interval_seconds": 3, "minimum_change": 1},
    {"key": "movimiento_pir", "name": "Movimiento PIR HC-SR501", "description": "Detección virtual de presencia.", "category": "sensor", "data_type": "booleano", "unit": None, "gpio": "8", "writable": False, "widget_type": "indicador", "save_interval_seconds": 2},
    {"key": "luminosidad_ldr", "name": "Luminosidad LDR", "description": "Lectura analógica de luz.", "category": "sensor", "data_type": "numero", "unit": "%", "gpio": "A0", "writable": False, "widget_type": "grafico", "minimum_value": 0, "maximum_value": 100, "save_interval_seconds": 4, "minimum_change": 1},
    {"key": "led_principal", "name": "LED principal", "description": "LED controlado desde la plataforma.", "category": "actuador", "data_type": "booleano", "gpio": "13", "writable": True, "widget_type": "interruptor", "save_history": False},
    {"key": "rele_ventilador", "name": "Relé de ventilador", "description": "Relé virtual de un canal.", "category": "actuador", "data_type": "booleano", "gpio": "6", "writable": True, "widget_type": "interruptor", "save_history": False},
)

SIGNALS = (
    {"key": "temperatura_ambiente", "base": 23, "amplitude": 4, "period_seconds": 80, "noise": 0.12},
    {"key": "humedad_aire", "base": 58, "amplitude": 12, "period_seconds": 100, "noise": 0.35},
    {"key": "distancia_hc_sr04", "base": 120, "amplitude": 55, "period_seconds": 45, "noise": 1.2},
    {"key": "movimiento_pir", "period_seconds": 14},
    {"key": "luminosidad_ldr", "base": 55, "amplitude": 35, "period_seconds": 60, "noise": 0.8},
)

SCENARIO = {
    "name": "Práctica Arduino multisensor",
    "steps": [
        {"at_seconds": 25, "action": "ramp", "channel": "temperatura_ambiente", "from": 23, "to": 31, "duration_seconds": 50},
        {"at_seconds": 70, "action": "sequence", "channel": "distancia_hc_sr04", "values": [160, 90, 45, 18, 110], "interval_seconds": 12},
        {"at_seconds": 140, "action": "fault", "faults": {"latency_ms": 350}},
        {"at_seconds": 170, "action": "fault", "faults": {"latency_ms": 0}},
    ],
}


def main() -> int:
    api = Api(os.getenv("UDLAIOT_API_URL", "http://localhost:18000"))
    login = api.request("POST", "/api/auth/login", {"username": os.getenv("UDLAIOT_USERNAME", "admin"), "password": os.getenv("UDLAIOT_PASSWORD", "Admin123!")})
    api.token = login["access_token"]
    print("[OK] Autenticación")

    project = find(api.request("GET", "/api/projects"), "name", PROJECT_NAME)
    if project is None:
        project = api.request("POST", "/api/projects", {"name": PROJECT_NAME, "description": "Laboratorio virtual Arduino Uno con sensores y actuadores conectados mediante puente Serial JSON y MQTT.", "summary": "Arduino Uno con DHT22, HC-SR04, PIR, LDR, LED y relé."})
        print("[OK] Proyecto Arduino creado")
    else:
        print("[OK] Proyecto Arduino reutilizado")

    location = find(api.request("GET", f"/api/projects/{project['id']}/locations"), "name", LOCATION_NAME)
    if location is None:
        location = api.request("POST", f"/api/projects/{project['id']}/locations", {"name": LOCATION_NAME, "description": "Mesa virtual para prácticas con Arduino Uno."})

    device = find(api.request("GET", f"/api/projects/{project['id']}/devices"), "device_identifier", DEVICE_IDENTIFIER)
    if device is None:
        device = api.request("POST", f"/api/projects/{project['id']}/devices", {"name": DEVICE_NAME, "description": "Arduino Uno virtual conectado por puente Serial JSON a Mosquitto, FastAPI, PostgreSQL y WebSocket.", "board_type": "Arduino Uno R3", "connection_type": "simulador", "device_identifier": DEVICE_IDENTIFIER, "location_id": location["id"], "firmware_version": "udlaiot-arduino-demo-1.0.0", "configuration": {"serial_json": True, "mqtt_bridge": True, "baud_rate": 115200, "sensors": ["DHT22", "HC-SR04", "PIR HC-SR501", "LDR"], "actuators": ["LED", "Relé 1 canal"]}})
        print("[OK] Arduino Uno creado")
    else:
        print("[OK] Arduino Uno reutilizado")

    existing = api.request("GET", f"/api/devices/{device['id']}/channels")
    by_key = {channel["key"]: channel for channel in existing}
    for definition in CHANNELS:
        if definition["key"] not in by_key:
            channel = api.request("POST", f"/api/devices/{device['id']}/channels", definition)
            by_key[channel["key"]] = channel
    print(f"[OK] {len(CHANNELS)} canales Arduino disponibles")

    sessions = api.request("GET", f"/api/simulator/sessions?project_id={project['id']}")
    session = next((item for item in sessions if item["device_id"] == device["id"] and item["name"] == SESSION_NAME), None)
    if session is None:
        session = api.request("POST", "/api/simulator/sessions", {"project_id": project["id"], "device_id": device["id"], "name": SESSION_NAME, "board_profile": "arduino_uno", "tick_ms": 2000, "seed": 328, "configuration": {"signals": list(SIGNALS)}, "scenario": SCENARIO})
        print("[OK] Sesión Arduino creada")

    status = api.request("GET", f"/api/simulator/sessions/{session['id']}/status")
    if status["state"] not in {"ejecutando", "pausada"}:
        api.request("PATCH", f"/api/simulator/sessions/{session['id']}", {"tick_ms": 2000, "configuration": {"signals": list(SIGNALS)}, "scenario": SCENARIO})
        status = api.request("POST", f"/api/simulator/sessions/{session['id']}/start")
    elif status["state"] == "pausada":
        status = api.request("POST", f"/api/simulator/sessions/{session['id']}/resume")
    print("[OK] Arduino Uno conectado al puente MQTT")

    for channel in (item for item in by_key.values() if item["category"] == "sensor"):
        wait_for(f"telemetría de {channel['name']}", lambda channel_id=channel["id"]: (page if (page := api.request("GET", f"/api/channels/{channel_id}/telemetry?page=1&page_size=1"))["total"] else None))

    # El puente Serial procesa una orden por ciclo; el margen evita encadenar
    # una publicación nueva dentro del callback que acaba de confirmar la anterior.
    for channel_key, value in (
        ("led_principal", True),
        ("led_principal", False),
        ("rele_ventilador", True),
        ("rele_ventilador", False),
    ):
        confirmed_command(api, by_key[channel_key]["id"], value)
        time.sleep(2)

    status = api.request("GET", f"/api/simulator/sessions/{session['id']}/status")
    print(json.dumps({"project_id": project["id"], "device_id": device["id"], "session_id": session["id"], "state": status["state"], "connected": status["connected"], "messages_sent": status["messages_sent"], "sensor_values": status["values"], "actuators": status["actuators"], "web": f"http://localhost:15173/app/dispositivos/{device['id']}"}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, KeyError, ValueError) as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        raise SystemExit(1) from error
