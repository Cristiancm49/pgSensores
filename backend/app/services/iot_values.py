import json
from datetime import datetime
from typing import Any

from app.models import Channel


def parse_source_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def coerce_channel_value(channel: Channel, value: Any) -> Any:
    try:
        if channel.data_type == "booleano":
            if isinstance(value, bool):
                result = value
            elif isinstance(value, (int, float)) and value in {0, 1}:
                result = bool(value)
            elif isinstance(value, str) and value.lower() in {"true", "1", "on", "encendido"}:
                result = True
            elif isinstance(value, str) and value.lower() in {"false", "0", "off", "apagado"}:
                result = False
            else:
                raise ValueError("Se esperaba un valor booleano")
        elif channel.data_type == "numero":
            if isinstance(value, bool):
                raise ValueError
            result = float(value)
        elif channel.data_type == "entero":
            if isinstance(value, bool):
                raise ValueError
            result = int(value)
        elif channel.data_type == "texto":
            result = str(value)
        elif channel.data_type == "json":
            if not isinstance(value, (dict, list)):
                raise ValueError
            result = value
        else:
            raise ValueError
    except (TypeError, ValueError) as error:
        raise ValueError(f"Valor inválido para el canal {channel.key}") from error

    if isinstance(result, (int, float)) and not isinstance(result, bool):
        if channel.minimum_value is not None and result < channel.minimum_value:
            raise ValueError(f"El valor está por debajo del mínimo de {channel.minimum_value}")
        if channel.maximum_value is not None and result > channel.maximum_value:
            raise ValueError(f"El valor supera el máximo de {channel.maximum_value}")
    return result


def decode_mqtt_payload(channel: Channel, payload: bytes) -> tuple[Any, datetime | None]:
    text = payload.decode("utf-8")
    try:
        body = json.loads(text)
    except json.JSONDecodeError:
        body = text
    source_timestamp = None
    value = body
    if isinstance(body, dict) and "value" in body:
        value = body["value"]
        source_timestamp = parse_source_timestamp(body.get("timestamp"))
        if body.get("timestamp") and source_timestamp is None:
            raise ValueError("La marca de tiempo no es válida")
    return coerce_channel_value(channel, value), source_timestamp
