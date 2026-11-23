# UDLAIoT

Plataforma web para proyectos universitarios de IoT.

## Estado actual

La aplicación incluye:

- React, Vite, TypeScript y Tailwind CSS;
- FastAPI y SQLAlchemy;
- PostgreSQL;
- Eclipse Mosquitto;
- Docker Compose;
- inicio de sesión con access token y refresh token revocable;
- administración de usuarios desde el panel;
- CRUD de proyectos y asignación de integrantes por nombre de usuario;
- CRUD de ubicaciones y dispositivos;
- CRUD de sensores y actuadores por dispositivo;
- generación, rotación y revocación de credenciales MQTT por dispositivo;
- autenticación de Mosquitto y permisos aislados por topics;
- recepción y persistencia de telemetría MQTT;
- actualización en tiempo real mediante WebSocket;
- gráfica histórica por sensor;
- comandos de actuadores con confirmación por ACK y timeout;
- simulador administrado de Arduino, ESP32 y dispositivos MQTT con escenarios avanzados, historial, comparación, importación JSON/YAML y ejecución simultánea;
- puente USB Serial JSON y runner aislado de firmware `.ino` con Arduino CLI, simavr y Renode;
- documentación editable y ordenada por proyecto;
- archivos privados con carga, descarga autenticada y eliminación definitiva;
- permisos de propietario, editor y visualizador;
- archivado de proyectos y desactivación de dispositivos y canales.

La interfaz no contiene datos simulados: los totales y listados se consultan desde la API.

Los datos generados desde la sección **Simulador** sí se identifican por la sesión que los produce, pero recorren MQTT, validación, persistencia y WebSocket igual que un dispositivo real.

## Arranque con Docker

```powershell
docker compose up -d --build
```

Servicios locales:

- Frontend: <http://localhost:15173>
- API: <http://localhost:18000>
- Documentación OpenAPI: <http://localhost:18000/docs>
- PostgreSQL: `localhost:55478`
- MQTT: `localhost:11883`
- MQTT WebSocket: `localhost:19001`

Acceso inicial de desarrollo:

- Usuario: `admin`
- Contraseña: `Admin123!`

Estas credenciales se configuran con `ADMIN_USERNAME` y `ADMIN_PASSWORD`. Deben cambiarse fuera del entorno local.

## Credenciales MQTT de dispositivos

Las credenciales se administran desde el detalle de cada dispositivo, en la pestaña **Credenciales MQTT**. La contraseña se entrega una sola vez; PostgreSQL conserva únicamente su hash y Mosquitto mantiene su propio hash de autenticación.

Cada dispositivo utiliza esta jerarquía:

```text
nexiot/devices/{dispositivo_id}/telemetry/#  publicar
nexiot/devices/{dispositivo_id}/state/#      publicar
nexiot/devices/{dispositivo_id}/ack/#        publicar
nexiot/devices/{dispositivo_id}/status       publicar
nexiot/devices/{dispositivo_id}/commands/#   suscribir
```

Mosquitto rechaza conexiones anónimas y bloquea publicaciones o suscripciones fuera del espacio asignado al dispositivo.

## Mensajes MQTT

Una lectura puede enviarse como un valor simple o como JSON. El nombre final del topic debe coincidir con la clave del canal:

```text
Topic: nexiot/devices/{dispositivo_id}/telemetry/temperatura
Payload: {"value":24.8,"timestamp":"2026-09-24T11:30:00-05:00"}
```

El estado de conexión se publica en `nexiot/devices/{dispositivo_id}/status` con `online` u `offline`. El dispositivo debe configurar `offline` como Last Will para que Mosquitto lo publique al detectar una desconexión inesperada.

Los comandos llegan a `nexiot/devices/{dispositivo_id}/commands/{clave_canal}`:

```json
{"command_id":"uuid","channel":"led","value":true,"timestamp":"2026-09-24T16:30:00Z"}
```

Después de aplicar el cambio, el dispositivo confirma en `nexiot/devices/{dispositivo_id}/ack/{clave_canal}`:

```json
{"command_id":"uuid","status":"confirmed","value":true}
```

También puede responder con `status: "failed"` y un campo `error`. Si no llega un ACK dentro del tiempo configurado, el comando queda `expirado`. La interfaz conserva el estado anterior mientras el comando está pendiente y solo muestra confirmación al recibir el ACK.

La API expone el estado actual, el histórico y los comandos en:

```text
GET  /api/channels/{canal_id}/state
GET  /api/channels/{canal_id}/telemetry
POST /api/channels/{canal_id}/commands
GET  /api/commands/{comando_id}
WS   /api/ws?token={access_token}
```

## Documentación y archivos

Cada proyecto incluye las pestañas **Documentación** y **Archivos**. Las secciones de documentación se pueden crear, editar, ordenar y eliminar. Los archivos se almacenan bajo una carpeta interna por proyecto usando un nombre físico aleatorio; el nombre original se conserva únicamente como metadato y para la descarga.

El directorio `storage` no se publica como contenido estático. Toda descarga pasa por la API y requiere acceso al proyecto. La eliminación definitiva exige confirmación y elimina el registro de PostgreSQL junto con el archivo físico.

Formatos admitidos:

```text
PDF, PNG, JPG, GIF, WebP, SVG
TXT, Markdown, CSV, JSON, YAML
DOC, DOCX, XLS, XLSX, PPT, PPTX
ZIP, INO, C, C++, Python
MP4 y WebM
```

El límite general es de 25 MB. Los videos MP4 y WebM admiten hasta 100 MB. El servidor valida nombre, extensión, MIME y tamaño, y rechaza nombres que contengan rutas.

Endpoints principales:

```text
GET    /api/projects/{proyecto_id}/documents
POST   /api/projects/{proyecto_id}/documents
PATCH  /api/documents/{seccion_id}
PUT    /api/projects/{proyecto_id}/documents/order
DELETE /api/documents/{seccion_id}

GET    /api/projects/{proyecto_id}/files
POST   /api/projects/{proyecto_id}/files
GET    /api/files/{archivo_id}/download
DELETE /api/files/{archivo_id}?confirm=true
```

Ver estado:

```powershell
docker compose ps
```

Antes de abrir el simulador por primera vez, actualiza la base de datos si el backend no se inició mediante Docker:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Detener servicios:

```powershell
docker compose down
```

Los puertos externos no son los habituales porque en la máquina de desarrollo ya existen servicios usando `5432`, `5433`, `8000` y `9001`.

## Desarrollo local

Backend:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 18000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Comprobaciones

```powershell
cd backend
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend
npm run build
```

Prueba real MQTT/PostgreSQL y firmware aislado:

```powershell
py -3.12 simulator\verify_stack.py --confirm-write
docker build -t udlaiot-firmware-runner:local firmware-runner
py -3.12 simulator\run_firmware.py simulator\examples\Blink.ino --engine simavr --timeout 20
```

GitHub Actions repite calidad, build web, MQTT E2E con PostgreSQL/Mosquitto reales y el runner de firmware en `.github/workflows/ci.yml`.

Las decisiones funcionales del MVP están en [`context/UDLAIoT_decisiones_MVP.md`](context/UDLAIoT_decisiones_MVP.md).

El plan por fases para construir el simulador propio de Arduino, ESP32 y otros dispositivos está en [`PLAN_TRABAJO_SIMULADOR_IOT.md`](PLAN_TRABAJO_SIMULADOR_IOT.md).
