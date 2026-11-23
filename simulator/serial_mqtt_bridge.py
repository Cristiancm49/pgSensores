"""Puente JSON Lines entre un Arduino por USB y los contratos MQTT de UDLAIoT."""

from __future__ import annotations

import argparse
import json
import queue
import signal
import threading
import time
from dataclasses import dataclass
from typing import Any

import paho.mqtt.client as mqtt


@dataclass(frozen=True)
class SerialMessage:
    kind: str
    channel: str
    payload: dict[str, Any]


def parse_serial_line(line: bytes | str) -> SerialMessage:
    text = line.decode("utf-8") if isinstance(line, bytes) else line
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("La línea serial debe ser un objeto JSON")
    kind = str(value.get("type", "telemetry"))
    if kind not in {"telemetry", "ack", "status"}:
        raise ValueError(f"Tipo serial no soportado: {kind}")
    channel = str(value.get("channel", "status" if kind == "status" else ""))
    if not channel:
        raise ValueError("Falta channel")
    return SerialMessage(kind=kind, channel=channel, payload=value)


class SerialMqttBridge:
    def __init__(self, args: argparse.Namespace) -> None:
        import serial

        self.args = args
        self.serial = serial.Serial(args.port, args.baud, timeout=0.5, write_timeout=2)
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=args.client_id,
            protocol=mqtt.MQTTv311,
        )
        self.client.username_pw_set(args.username, args.password)
        self.topic = f"nexiot/devices/{args.device_id}"
        self.client.will_set(f"{self.topic}/status", "offline", qos=1, retain=True)
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.outgoing: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=100)
        self.stop = threading.Event()

    def _on_connect(self, client, userdata, flags, reason_code, properties) -> None:  # noqa: ANN001
        del userdata, flags, properties
        if reason_code.is_failure:
            raise RuntimeError(f"Mosquitto rechazó el puente: {reason_code}")
        client.subscribe(f"{self.topic}/commands/+", qos=1)
        client.publish(f"{self.topic}/status", "online", qos=1, retain=True)

    def _on_message(self, client, userdata, message) -> None:  # noqa: ANN001
        del client, userdata
        payload = json.loads(message.payload.decode("utf-8"))
        payload.update({"type": "command", "channel": message.topic.rsplit("/", 1)[-1]})
        try:
            self.outgoing.put_nowait(payload)
        except queue.Full:
            raise RuntimeError("Arduino no consume comandos; cola serial llena") from None

    def run(self) -> None:
        self.client.connect(self.args.host, self.args.mqtt_port, keepalive=30)
        self.client.loop_start()
        try:
            while not self.stop.is_set():
                try:
                    command = self.outgoing.get_nowait()
                    self.serial.write((json.dumps(command, separators=(",", ":")) + "\n").encode())
                except queue.Empty:
                    pass
                line = self.serial.readline()
                if not line:
                    continue
                message = parse_serial_line(line)
                if message.kind == "telemetry":
                    body = {
                        "value": message.payload.get("value"),
                        "timestamp": message.payload.get("timestamp"),
                    }
                    self.client.publish(
                        f"{self.topic}/telemetry/{message.channel}",
                        json.dumps(body, separators=(",", ":")),
                        qos=1,
                    )
                elif message.kind == "ack":
                    body = {
                        "command_id": message.payload["command_id"],
                        "status": message.payload.get("status", "confirmed"),
                        "value": message.payload.get("value"),
                    }
                    self.client.publish(
                        f"{self.topic}/ack/{message.channel}",
                        json.dumps(body, separators=(",", ":")),
                        qos=1,
                    )
                else:
                    self.client.publish(
                        f"{self.topic}/status",
                        str(message.payload.get("value", "online")),
                        qos=1,
                        retain=True,
                    )
        finally:
            self.client.publish(f"{self.topic}/status", "offline", qos=1, retain=True)
            self.client.disconnect()
            self.client.loop_stop()
            self.serial.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", required=True, help="Puerto USB, por ejemplo COM4 o /dev/ttyACM0")
    parser.add_argument("--device-id", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--mqtt-port", type=int, default=11883)
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--client-id", default=f"serial-bridge-{int(time.time())}")
    args = parser.parse_args()
    bridge = SerialMqttBridge(args)
    signal.signal(signal.SIGINT, lambda *_: bridge.stop.set())
    signal.signal(signal.SIGTERM, lambda *_: bridge.stop.set())
    bridge.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
