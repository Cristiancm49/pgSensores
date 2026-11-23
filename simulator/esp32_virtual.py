from __future__ import annotations

import json
import math
import random
import signal
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from threading import Event

import paho.mqtt.client as mqtt

ENV_PATH = Path(__file__).with_name(".env")
STOP = Event()


def load_environment(path: Path) -> dict[str, str]:
    if not path.exists():
        raise RuntimeError(f"No existe el archivo de configuración: {path}")

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def required(config: dict[str, str], key: str) -> str:
    value = config.get(key, "").strip()
    if not value:
        raise RuntimeError(f"Falta {key} en {ENV_PATH}")
    return value


class VirtualEsp32:
    def __init__(self, config: dict[str, str]) -> None:
        self.host = required(config, "MQTT_HOST")
        self.port = int(required(config, "MQTT_PORT"))
        self.client_id = required(config, "MQTT_CLIENT_ID")
        self.username = required(config, "MQTT_USERNAME")
        self.password = required(config, "MQTT_PASSWORD")
        self.topic_base = required(config, "MQTT_TOPIC_BASE").rstrip("/")
        self.interval = max(1.0, float(config.get("TELEMETRY_INTERVAL_SECONDS", "2")))
        self.led_on = False
        self.started_at = time.monotonic()

        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=self.client_id,
            protocol=mqtt.MQTTv311,
        )
        self.client.username_pw_set(self.username, self.password)
        self.client.will_set(
            f"{self.topic_base}/status",
            payload="offline",
            qos=1,
            retain=True,
        )
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message
        self.client.reconnect_delay_set(min_delay=1, max_delay=10)

    def on_connect(
        self,
        client: mqtt.Client,
        userdata: object,
        connect_flags: mqtt.ConnectFlags,
        reason_code: mqtt.ReasonCode,
        properties: mqtt.Properties | None,
    ) -> None:
        del userdata, connect_flags, properties
        if reason_code.is_failure:
            print(f"[MQTT] Conexión rechazada: {reason_code}", flush=True)
            return

        commands_topic = f"{self.topic_base}/commands/#"
        client.subscribe(commands_topic, qos=1)
        client.publish(f"{self.topic_base}/status", "online", qos=1, retain=True)
        print(f"[MQTT] Conectado a {self.host}:{self.port}", flush=True)
        print(f"[MQTT] Escuchando {commands_topic}", flush=True)

    def on_disconnect(
        self,
        client: mqtt.Client,
        userdata: object,
        disconnect_flags: mqtt.DisconnectFlags,
        reason_code: mqtt.ReasonCode,
        properties: mqtt.Properties | None,
    ) -> None:
        del client, userdata, disconnect_flags, properties
        if not STOP.is_set():
            print(f"[MQTT] Conexión perdida: {reason_code}. Reintentando…", flush=True)

    def on_message(
        self,
        client: mqtt.Client,
        userdata: object,
        message: mqtt.MQTTMessage,
    ) -> None:
        del userdata
        channel_key = message.topic.rsplit("/", 1)[-1]
        if channel_key != "led":
            return

        try:
            command = json.loads(message.payload.decode("utf-8"))
            command_id = str(command["command_id"])
            requested_value = command["value"]
            if not isinstance(requested_value, bool):
                raise TypeError("El valor del LED debe ser booleano")
        except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as error:
            print(f"[LED] Comando inválido: {error}", flush=True)
            return

        self.led_on = requested_value
        ack = {
            "command_id": command_id,
            "status": "confirmed",
            "value": self.led_on,
        }
        client.publish(
            f"{self.topic_base}/ack/led",
            json.dumps(ack, separators=(",", ":")),
            qos=1,
        )
        state = "ENCENDIDO" if self.led_on else "APAGADO"
        print(f"[LED] {state} · ACK {command_id}", flush=True)

    def publish_telemetry(self) -> None:
        elapsed = time.monotonic() - self.started_at
        temperature = round(
            24.5 + math.sin(elapsed / 12) * 1.8 + random.uniform(-0.15, 0.15), 2
        )
        humidity = round(67 + math.sin(elapsed / 17) * 5 + random.uniform(-0.4, 0.4), 2)
        timestamp = datetime.now(UTC).isoformat().replace("+00:00", "Z")

        values = {"temperatura": temperature, "humedad": humidity}
        for channel, value in values.items():
            payload = json.dumps(
                {"value": value, "timestamp": timestamp},
                separators=(",", ":"),
            )
            self.client.publish(
                f"{self.topic_base}/telemetry/{channel}",
                payload,
                qos=1,
            )

        print(
            f"[SENSORES] Temperatura {temperature:.2f} °C · Humedad {humidity:.2f} %",
            flush=True,
        )

    def run(self) -> None:
        print("UDLAIoT ESP32 virtual", flush=True)
        print(f"Dispositivo: {self.client_id}", flush=True)
        self.client.connect(self.host, self.port, keepalive=30)
        self.client.loop_start()
        try:
            while not STOP.wait(self.interval):
                if self.client.is_connected():
                    self.publish_telemetry()
        finally:
            if self.client.is_connected():
                self.client.publish(
                    f"{self.topic_base}/status",
                    "offline",
                    qos=1,
                    retain=True,
                ).wait_for_publish(timeout=2)
                self.client.disconnect()
            self.client.loop_stop()
            print("ESP32 virtual detenido", flush=True)


def stop_handler(signum: int, frame: object) -> None:
    del signum, frame
    STOP.set()


def main() -> int:
    signal.signal(signal.SIGINT, stop_handler)
    signal.signal(signal.SIGTERM, stop_handler)
    try:
        VirtualEsp32(load_environment(ENV_PATH)).run()
    except (OSError, RuntimeError, ValueError) as error:
        print(f"No se pudo iniciar el simulador: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
