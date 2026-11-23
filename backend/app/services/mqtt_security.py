import json
import threading
import uuid
from typing import Any

import paho.mqtt.client as mqtt

from app.core.config import settings

control_topic = "$CONTROL/dynamic-security/v1"
response_topic = f"{control_topic}/response"


class MqttSecurityError(RuntimeError):
    pass


class MqttSecurityService:
    def _request(self, commands: list[dict[str, Any]]) -> list[dict[str, Any]]:
        completed = threading.Event()
        connected = threading.Event()
        result: dict[str, Any] = {}
        command_payloads: list[dict[str, Any]] = []
        correlations: set[str] = set()

        for command in commands:
            correlation = uuid.uuid4().hex
            correlations.add(correlation)
            command_payloads.append({**command, "correlationData": correlation})

        payload = json.dumps({"commands": command_payloads}, separators=(",", ":"))
        client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"nexiot-security-{uuid.uuid4().hex[:12]}",
            protocol=mqtt.MQTTv311,
        )
        client.username_pw_set(settings.mqtt_admin_username, settings.mqtt_admin_password)

        def on_connect(client, userdata, flags, reason_code, properties):  # noqa: ANN001
            if reason_code != 0:
                result["error"] = f"Mosquitto rechazó la conexión: {reason_code}"
                completed.set()
                return
            client.subscribe(response_topic, qos=1)

        def on_subscribe(client, userdata, mid, reason_codes, properties):  # noqa: ANN001
            if not connected.is_set():
                connected.set()
                client.publish(control_topic, payload=payload, qos=1)

        def on_message(client, userdata, message):  # noqa: ANN001
            try:
                body = json.loads(message.payload.decode("utf-8"))
                responses = body.get("responses", [])
                response_correlations = {
                    item.get("correlationData") for item in responses if isinstance(item, dict)
                }
                if response_correlations & correlations:
                    result["responses"] = responses
                    completed.set()
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                result["error"] = f"Respuesta inválida de Mosquitto: {error}"
                completed.set()

        client.on_connect = on_connect
        client.on_subscribe = on_subscribe
        client.on_message = on_message

        try:
            client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=10)
            client.loop_start()
            if not completed.wait(timeout=6):
                raise MqttSecurityError("Mosquitto no respondió a la operación de seguridad")
            if "error" in result:
                raise MqttSecurityError(result["error"])
            responses = result.get("responses", [])
            for response in responses:
                if response.get("correlationData") in correlations and response.get("error"):
                    raise MqttSecurityError(response["error"])
            return responses
        except OSError as error:
            raise MqttSecurityError(f"No fue posible conectar con Mosquitto: {error}") from error
        finally:
            try:
                client.disconnect()
            finally:
                client.loop_stop()

    def create_device_client(
        self,
        *,
        username: str,
        password: str,
        client_id: str,
        role_name: str,
        topic_base: str,
    ) -> None:
        acls = [
            {
                "acltype": "publishClientSend",
                "topic": f"{topic_base}/telemetry/#",
                "priority": 10,
                "allow": True,
            },
            {
                "acltype": "publishClientSend",
                "topic": f"{topic_base}/state/#",
                "priority": 10,
                "allow": True,
            },
            {
                "acltype": "publishClientSend",
                "topic": f"{topic_base}/ack/#",
                "priority": 10,
                "allow": True,
            },
            {
                "acltype": "publishClientSend",
                "topic": f"{topic_base}/status",
                "priority": 10,
                "allow": True,
            },
            {
                "acltype": "subscribePattern",
                "topic": f"{topic_base}/commands/#",
                "priority": 10,
                "allow": True,
            },
            {
                "acltype": "publishClientReceive",
                "topic": f"{topic_base}/commands/#",
                "priority": 10,
                "allow": True,
            },
        ]
        self._request(
            [
                {
                    "command": "createRole",
                    "rolename": role_name,
                    "textname": f"Acceso de {client_id}",
                    "acls": acls,
                },
                {
                    "command": "createClient",
                    "username": username,
                    "password": password,
                    "clientid": client_id,
                    "roles": [{"rolename": role_name, "priority": 10}],
                },
            ]
        )

    def revoke_device_client(self, *, username: str, role_name: str) -> None:
        for command in (
            {"command": "deleteClient", "username": username},
            {"command": "deleteRole", "rolename": role_name},
        ):
            try:
                self._request([command])
            except MqttSecurityError as error:
                if "not found" not in str(error).lower():
                    raise

    def provision_backend_client(self) -> None:
        username = settings.mqtt_backend_username
        role_name = "nexiot-backend-role"
        self.revoke_device_client(username=username, role_name=role_name)
        self._request(
            [
                {
                    "command": "createRole",
                    "rolename": role_name,
                    "textname": "Servicio FastAPI UDLAIoT",
                    "acls": [
                        {
                            "acltype": "subscribePattern",
                            "topic": "nexiot/devices/#",
                            "priority": 20,
                            "allow": True,
                        },
                        {
                            "acltype": "publishClientReceive",
                            "topic": "nexiot/devices/#",
                            "priority": 20,
                            "allow": True,
                        },
                        {
                            "acltype": "publishClientSend",
                            "topic": "nexiot/devices/+/commands/#",
                            "priority": 20,
                            "allow": True,
                        },
                    ],
                },
                {
                    "command": "createClient",
                    "username": username,
                    "password": settings.mqtt_backend_password,
                    "clientid": "nexiot-backend-service",
                    "roles": [{"rolename": role_name, "priority": 20}],
                },
            ]
        )


mqtt_security = MqttSecurityService()
