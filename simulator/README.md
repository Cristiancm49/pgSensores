# Simulación de dispositivos en UDLAIoT

## Simulador administrado

La opción principal está integrada en la plataforma web, en **Simulador**. Permite crear sesiones para dispositivos ya registrados y ofrece:

- perfiles `Arduino Uno`, `Arduino Mega`, `ESP32 DevKit` y MQTT genérico;
- detección automática de sensores y actuadores activos;
- señales numéricas reproducibles mediante semilla;
- entradas manuales por canal;
- pausa, reinicio y detención;
- desconexión de red, pérdida de ACK y latencia de ACK;
- consola de telemetría, comandos y confirmaciones;
- credenciales MQTT temporales revocadas al detener la sesión.
- rampas, secuencias, valores y fallos programados por tiempo;
- reportes persistentes e historial de ejecuciones;
- importación y exportación de escenarios JSON/YAML;
- varias sesiones simultáneas en dispositivos distintos, con cuotas por usuario;
- límite global de sesiones y detención automática por tiempo máximo.

El runtime vive dentro del backend y publica usando los mismos topics y ACL que el hardware. No inserta telemetría directamente en PostgreSQL.

Endpoints principales:

```text
GET    /api/simulator/profiles
GET    /api/simulator/sessions
POST   /api/simulator/sessions
POST   /api/simulator/sessions/{id}/start
POST   /api/simulator/sessions/{id}/pause
POST   /api/simulator/sessions/{id}/resume
POST   /api/simulator/sessions/{id}/reset
POST   /api/simulator/sessions/{id}/stop
POST   /api/simulator/sessions/{id}/inputs
POST   /api/simulator/sessions/{id}/faults
GET    /api/simulator/sessions/{id}/status
GET    /api/simulator/sessions/{id}/scenario/export?format=json|yaml
POST   /api/simulator/sessions/{id}/scenario/import?format=json|yaml
GET    /api/simulator/runs
GET    /api/simulator/runs/compare?ids={id}&ids={id}
```

Prueba de humo completa contra un stack de desarrollo en ejecución:

```powershell
py -3.12 simulator\verify_stack.py --confirm-write
```

La prueba crea un proyecto temporal, un ESP32, canales, una sesión y un comando. Verifica telemetría persistida, ACK, desconexión y reconexión reales; elimina la sesión, conserva su reporte y archiva el proyecto al terminar. Se pueden definir `UDLAIOT_API_URL`, `UDLAIOT_USERNAME` y `UDLAIOT_PASSWORD`.

## Formato de escenarios

```json
{
  "name": "Ciclo térmico con pérdida de red",
  "steps": [
    {"at_seconds": 0, "action": "set", "values": {"temperatura": 20}},
    {"at_seconds": 5, "action": "ramp", "channel": "temperatura", "from": 20, "to": 60, "duration_seconds": 30},
    {"at_seconds": 40, "action": "sequence", "channel": "temperatura", "values": [60, 50, 35], "interval_seconds": 5},
    {"at_seconds": 55, "action": "fault", "faults": {"network_disconnected": true}},
    {"at_seconds": 65, "action": "fault", "faults": {"network_disconnected": false}}
  ]
}
```

## Puente USB Serial JSON

Instala `simulator/requirements.txt` y ejecuta:

```powershell
py -3.12 simulator\serial_mqtt_bridge.py --port COM4 --device-id UUID --username USUARIO --password SECRETO
```

El Arduino envía JSON Lines con `type: telemetry`, `ack` o `status`. El puente entrega los comandos MQTT al puerto serial con `type: command` y nunca expone una consola de comandos del sistema.

## Firmware `.ino` aislado

El runner compila con Arduino CLI y puede ejecutar AVR con simavr o una plataforma explícita con Renode. El contenedor se ejecuta sin red, sin capabilities, sin privilegios nuevos, con filesystem de solo lectura, un CPU, 256 MiB, 64 procesos y timeout.

```powershell
docker build -t udlaiot-firmware-runner:local firmware-runner
py -3.12 simulator\run_firmware.py simulator\examples\Blink.ino --engine simavr --timeout 20
```

Renode requiere un script de plataforma controlado:

```powershell
py -3.12 simulator\run_firmware.py firmware.ino --engine renode --renode-script plataforma.resc
```

## Simulador independiente heredado

Simula un ESP32 con dos sensores (`temperatura` y `humedad`) y un actuador booleano (`led`). Se conecta al Mosquitto local, publica telemetría y confirma los comandos mediante ACK.

## Configuración

1. Copiar `.env.example` como `.env`.
2. Completar `.env` con la credencial MQTT generada por UDLAIoT.
3. No subir `.env` al repositorio.

## Ejecución

Desde la raíz del proyecto:

```powershell
py -3.12 -m venv simulator\.venv
simulator\.venv\Scripts\python.exe -m pip install -r simulator\requirements.txt
simulator\.venv\Scripts\python.exe simulator\esp32_virtual.py
```

Mientras el proceso esté activo, el dispositivo publica lecturas cada dos segundos. El interruptor del canal `led` cambia el estado virtual y recibe confirmación solo después del ACK.
