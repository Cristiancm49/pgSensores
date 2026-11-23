import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2] / "simulator"))

from serial_mqtt_bridge import parse_serial_line  # noqa: E402


def test_parse_telemetry_line() -> None:
    message = parse_serial_line(b'{"type":"telemetry","channel":"temp","value":23.5}\n')
    assert message.kind == "telemetry"
    assert message.channel == "temp"
    assert message.payload["value"] == 23.5


def test_reject_unknown_serial_type() -> None:
    try:
        parse_serial_line(json.dumps({"type": "shell", "channel": "x"}))
    except ValueError as error:
        assert "no soportado" in str(error)
    else:
        raise AssertionError("Debió rechazar el tipo desconocido")
