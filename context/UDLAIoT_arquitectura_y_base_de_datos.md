# UDLAIoT — Arquitectura inicial, base de datos y modelo funcional

## 1. Objetivo del proyecto

UDLAIoT será una plataforma web orientada inicialmente a proyectos universitarios de IoT.

La plataforma permitirá:

- Crear usuarios y autenticar mediante **nombre de usuario / nickname** y contraseña.
- Crear uno o varios proyectos.
- Asociar integrantes y roles a cada proyecto.
- Documentar los proyectos.
- Subir evidencias, fotografías, diagramas, informes y archivos relacionados.
- Conectar uno o varios dispositivos por proyecto.
- Soportar inicialmente:
  - ESP32 con conexión MQTT directa.
  - Arduino o ESP32 por USB/Serial mediante Node-RED.
  - ESP32 simulados mediante Wokwi.
- Crear sensores y actuadores asociados a cada dispositivo.
- Recibir telemetría en tiempo real.
- Visualizar estados de sensores y actuadores.
- Enviar comandos desde la página hacia los dispositivos.
- Encender/apagar LEDs, relés, bombas, motores u otros actuadores.
- Mostrar gráficas e históricos.
- Registrar eventos importantes.
- Añadir automatizaciones posteriormente.

---

# 2. Stack inicial

## Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Recharts
- WebSocket

## Backend

- Python
- FastAPI
- SQLAlchemy
- Paho MQTT
- JWT para autenticación

## Base de datos

- PostgreSQL

## IoT

- Eclipse Mosquitto
- Node-RED
- MQTT
- Serial JSON para dispositivos conectados por USB

## Firmware y simulación

- Arduino Framework
- ESP32
- Arduino
- Wokwi

## Infraestructura inicial

- Docker Compose
- Desarrollo local
- Posteriormente despliegue en VPS Contabo

---

# 3. Arquitectura general

```text
                         NAVEGADOR
                             │
                             ▼
                     React + TypeScript
                             │
                    REST + WebSocket
                             │
                             ▼
                         FastAPI
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
              PostgreSQL          Mosquitto
                                      │
                        ┌─────────────┴─────────────┐
                        │                           │
                        ▼                           ▼
                 ESP32 con WiFi                  Node-RED
                 MQTT directo                      │
                                                   │ USB / Serial
                                                   ▼
                                           Arduino / ESP32
```

---

# 4. Organización funcional

La jerarquía principal será:

```text
Usuario
  │
  ├── Proyectos propios
  │
  └── Proyectos compartidos
          │
          ├── Documentación
          ├── Evidencias
          ├── Integrantes
          ├── Dispositivos
          │      │
          │      └── Canales
          │             ├── Sensores
          │             └── Actuadores
          │
          ├── Telemetría
          ├── Comandos
          ├── Eventos
          └── Automatizaciones
```

---

# 5. Regla importante sobre archivos

Los archivos **NO se guardarán como BLOB dentro de PostgreSQL**.

PostgreSQL únicamente guardará:

- nombre del archivo;
- tipo;
- tamaño;
- ruta relativa;
- usuario que lo subió;
- proyecto al que pertenece;
- fecha de creación;
- descripción opcional.

Los archivos reales se almacenarán directamente en rutas del servidor.

Ejemplo:

```text
/var/nexiot/storage/
├── usuarios/
├── proyectos/
│   ├── proyecto_7b9c/
│   │   ├── evidencias/
│   │   ├── documentos/
│   │   ├── imagenes/
│   │   ├── diagramas/
│   │   └── otros/
│   └── proyecto_f21a/
└── temporales/
```

En desarrollo local:

```text
nexiot/
└── storage/
    └── proyectos/
```

Ejemplo de archivo físico:

```text
storage/proyectos/proyecto_7b9c/evidencias/prototipo_final.jpg
```

En PostgreSQL se guarda:

```text
proyectos/proyecto_7b9c/evidencias/prototipo_final.jpg
```

Nunca se debe guardar una ruta absoluta dependiente de una máquina específica.

---

# 6. Usuarios y autenticación

El inicio de sesión será con:

```text
usuario / nickname
contraseña
```

El correo electrónico puede existir, pero inicialmente no será obligatorio para iniciar sesión.

## Tabla: usuarios

```text
usuarios
────────────────────────────────
id                  UUID PK
nombre_usuario      VARCHAR UNIQUE NOT NULL
nombre_completo     VARCHAR
correo              VARCHAR UNIQUE NULL
contrasena_hash     VARCHAR NOT NULL
avatar_ruta         VARCHAR NULL
activo              BOOLEAN DEFAULT TRUE
es_administrador    BOOLEAN DEFAULT FALSE
ultimo_acceso       TIMESTAMPTZ NULL
creado_en           TIMESTAMPTZ
actualizado_en      TIMESTAMPTZ
```

Ejemplo:

```text
nombre_usuario: jperez23
nombre_completo: Juan Pérez
correo: juan@universidad.edu
```

## Reglas

- `nombre_usuario` debe ser único.
- La contraseña nunca se guarda en texto plano.
- Se guarda únicamente un hash seguro.
- El usuario puede tener proyectos propios y participar en proyectos de otros usuarios.

---

# 7. Roles

Los roles se manejarán por proyecto.

Inicialmente:

```text
propietario
editor
visualizador
```

Posteriormente se pueden agregar:

```text
docente
evaluador
administrador_proyecto
```

## Tabla: roles_proyecto

```text
roles_proyecto
────────────────────────────────
id              SMALLINT PK
codigo          VARCHAR UNIQUE
nombre          VARCHAR
descripcion     TEXT
```

Ejemplos:

```text
propietario
editor
visualizador
```

---

# 8. Proyectos

## Tabla: proyectos

```text
proyectos
────────────────────────────────
id                  UUID PK
propietario_id      UUID FK -> usuarios
nombre              VARCHAR NOT NULL
descripcion         TEXT
resumen             TEXT NULL
estado              VARCHAR DEFAULT 'activo'
imagen_portada_ruta VARCHAR NULL
codigo_publico      VARCHAR UNIQUE NULL
creado_en           TIMESTAMPTZ
actualizado_en      TIMESTAMPTZ
```

Estados sugeridos:

```text
borrador
activo
finalizado
archivado
```

Ejemplo:

```text
Proyecto:
Invernadero Inteligente

Descripción:
Sistema de monitoreo y control de humedad, temperatura y riego.
```

---

# 9. Integrantes de proyecto

## Tabla: miembros_proyecto

```text
miembros_proyecto
────────────────────────────────
id              UUID PK
proyecto_id     UUID FK -> proyectos
usuario_id      UUID FK -> usuarios
rol_id          SMALLINT FK -> roles_proyecto
agregado_en     TIMESTAMPTZ
```

Restricción:

```text
UNIQUE(proyecto_id, usuario_id)
```

---

# 10. Documentación del proyecto

La documentación no debe depender únicamente de archivos PDF o Word.

La plataforma también podrá tener entradas de documentación directamente editables.

## Tabla: documentos_proyecto

```text
documentos_proyecto
────────────────────────────────
id              UUID PK
proyecto_id     UUID FK -> proyectos
titulo          VARCHAR NOT NULL
contenido       TEXT
tipo            VARCHAR
orden           INTEGER DEFAULT 0
creado_por      UUID FK -> usuarios
creado_en       TIMESTAMPTZ
actualizado_en  TIMESTAMPTZ
```

Tipos sugeridos:

```text
descripcion
objetivos
metodologia
materiales
resultados
conclusiones
notas
otro
```

Esto permite crear una documentación tipo wiki dentro de cada proyecto.

---

# 11. Evidencias y archivos

## Tabla: archivos_proyecto

```text
archivos_proyecto
────────────────────────────────
id                  UUID PK
proyecto_id         UUID FK -> proyectos
subido_por          UUID FK -> usuarios
nombre_original     VARCHAR
nombre_guardado     VARCHAR
ruta_relativa       VARCHAR NOT NULL
tipo_mime           VARCHAR
categoria           VARCHAR
tamano_bytes        BIGINT
descripcion         TEXT NULL
creado_en           TIMESTAMPTZ
```

Categorías:

```text
evidencia
documento
imagen
diagrama
codigo
video
dataset
otro
```

Los archivos se almacenan físicamente en el servidor.

---

# 12. Dispositivos

Cada proyecto puede tener uno o muchos dispositivos.

Ejemplos:

```text
ESP32 Principal
ESP32 Riego
Arduino Uno Sensores
Arduino Mega Control
ESP32 Wokwi
```

## Tabla: dispositivos

```text
dispositivos
────────────────────────────────
id                      UUID PK
proyecto_id             UUID FK -> proyectos
nombre                  VARCHAR NOT NULL
descripcion             TEXT NULL
tipo_placa              VARCHAR
tipo_conexion           VARCHAR
identificador_dispositivo VARCHAR UNIQUE
clave_dispositivo_hash  VARCHAR
estado                  VARCHAR DEFAULT 'desconectado'
ultima_conexion         TIMESTAMPTZ NULL
version_firmware        VARCHAR NULL
imagen_ruta             VARCHAR NULL
configuracion           JSONB DEFAULT '{}'
creado_en               TIMESTAMPTZ
actualizado_en          TIMESTAMPTZ
```

Valores sugeridos para `tipo_conexion`:

```text
mqtt_directo
serial_node_red
simulador
```

Valores sugeridos para `estado`:

```text
conectado
desconectado
error
inactivo
```

---

# 13. Canales

Un canal representa un elemento lógico conectado a un dispositivo.

Ejemplos:

```text
Temperatura
Humedad
LED rojo
Relé bomba
Servo compuerta
Sensor de movimiento
Nivel de agua
```

No se crearán tablas separadas para LEDs, sensores, relés, servos, etc.

Todo será un **canal** configurable.

## Tabla: canales

```text
canales
────────────────────────────────
id                  UUID PK
dispositivo_id      UUID FK -> dispositivos
clave               VARCHAR NOT NULL
nombre              VARCHAR NOT NULL
descripcion         TEXT NULL
categoria           VARCHAR
tipo_dato           VARCHAR
unidad              VARCHAR NULL
gpio                VARCHAR NULL
es_escribible       BOOLEAN DEFAULT FALSE
tipo_widget         VARCHAR
valor_minimo        DOUBLE PRECISION NULL
valor_maximo        DOUBLE PRECISION NULL
imagen_ruta         VARCHAR NULL
configuracion       JSONB DEFAULT '{}'
activo              BOOLEAN DEFAULT TRUE
creado_en           TIMESTAMPTZ
actualizado_en      TIMESTAMPTZ
```

Restricción:

```text
UNIQUE(dispositivo_id, clave)
```

## Categorías

```text
sensor
actuador
entrada
salida
virtual
```

## Tipos de datos

```text
booleano
numero
texto
entero
json
```

## Widgets sugeridos

```text
interruptor
indicador
temperatura
humedad
grafica
medidor
slider
servo
boton
texto
porcentaje
```

---

# 14. Estado actual de los canales

La plataforma debe poder obtener rápidamente el estado actual sin recorrer todos los históricos.

## Tabla: estado_canales

```text
estado_canales
────────────────────────────────
canal_id            UUID PK FK -> canales
valor_numero        DOUBLE PRECISION NULL
valor_booleano      BOOLEAN NULL
valor_texto         TEXT NULL
valor_json          JSONB NULL
estado              VARCHAR DEFAULT 'valido'
actualizado_en      TIMESTAMPTZ
```

Estados posibles:

```text
valido
desactualizado
error
sin_datos
```

---

# 15. Telemetría

La telemetría almacena históricos de sensores y estados cuando corresponda.

## Tabla: telemetria

```text
telemetria
────────────────────────────────
id                  BIGSERIAL PK
canal_id            UUID FK -> canales
valor_numero        DOUBLE PRECISION NULL
valor_booleano      BOOLEAN NULL
valor_texto         TEXT NULL
valor_json          JSONB NULL
registrado_en       TIMESTAMPTZ NOT NULL
```

Índice importante:

```sql
CREATE INDEX idx_telemetria_canal_fecha
ON telemetria (canal_id, registrado_en DESC);
```

Ejemplo:

```text
Temperatura

14:00 -> 24.3 °C
14:05 -> 24.5 °C
14:10 -> 24.7 °C
14:15 -> 24.8 °C
```

---

# 16. Comandos

Cuando el usuario pulse un botón en la interfaz:

```text
Encender LED
Apagar bomba
Mover servo a 90°
Abrir relé
```

se crea un comando.

## Tabla: comandos

```text
comandos
────────────────────────────────
id                  UUID PK
dispositivo_id      UUID FK -> dispositivos
canal_id            UUID FK -> canales
solicitado_por      UUID FK -> usuarios
valor               JSONB NOT NULL
estado              VARCHAR
creado_en           TIMESTAMPTZ
enviado_en          TIMESTAMPTZ NULL
confirmado_en       TIMESTAMPTZ NULL
expira_en           TIMESTAMPTZ NULL
mensaje_error       TEXT NULL
```

Estados:

```text
pendiente
enviado
confirmado
fallido
expirado
```

Flujo:

```text
Usuario
   │
   ▼
Frontend
   │
   ▼
FastAPI
   │
   ▼
Comando en BD
   │
   ▼
MQTT
   │
   ▼
ESP32 / Node-RED
   │
   ▼
Arduino
   │
   ▼
ACK
   │
   ▼
Backend
   │
   ▼
Frontend
```

---

# 17. Eventos

## Tabla: eventos

```text
eventos
────────────────────────────────
id                  BIGSERIAL PK
proyecto_id         UUID FK -> proyectos
dispositivo_id      UUID FK -> dispositivos NULL
canal_id            UUID FK -> canales NULL
tipo                VARCHAR
severidad           VARCHAR
mensaje             TEXT
datos               JSONB DEFAULT '{}'
creado_en           TIMESTAMPTZ
```

Severidad:

```text
informacion
advertencia
critico
```

Ejemplos:

```text
ESP32 conectado
ESP32 desconectado
Sensor sin datos
Temperatura superior a 35 °C
LED activado
Comando fallido
```

---

# 18. Automatizaciones

Las automatizaciones pueden incorporarse después del MVP, pero dejamos la estructura preparada.

## Tabla: automatizaciones

```text
automatizaciones
────────────────────────────────
id                  UUID PK
proyecto_id         UUID FK -> proyectos
nombre              VARCHAR
descripcion         TEXT NULL
habilitada          BOOLEAN DEFAULT TRUE
disparador           JSONB
condiciones          JSONB
acciones             JSONB
creado_por           UUID FK -> usuarios
creado_en            TIMESTAMPTZ
actualizado_en       TIMESTAMPTZ
```

Ejemplo:

```json
{
  "canal": "temperatura",
  "operador": ">",
  "valor": 30
}
```

Acciones:

```json
[
  {
    "canal": "ventilador",
    "valor": true
  }
]
```

---

# 19. Credenciales de dispositivo

Para no exponer claves directamente, las credenciales se deben separar de la configuración visual.

## Tabla: credenciales_dispositivo

```text
credenciales_dispositivo
────────────────────────────────
id                  UUID PK
dispositivo_id      UUID FK -> dispositivos
usuario_mqtt        VARCHAR UNIQUE NULL
clave_hash          VARCHAR NOT NULL
activa              BOOLEAN DEFAULT TRUE
creada_en           TIMESTAMPTZ
revocada_en         TIMESTAMPTZ NULL
```

Para el MVP puede existir una sola credencial activa por dispositivo.

---

# 20. Sesiones de usuario

Opcional en el MVP si se usa JWT simple.

Si queremos permitir cerrar sesiones individualmente:

## Tabla: sesiones_usuario

```text
sesiones_usuario
────────────────────────────────
id                  UUID PK
usuario_id          UUID FK -> usuarios
refresh_token_hash  VARCHAR
ip                  VARCHAR NULL
agente_usuario      TEXT NULL
expira_en           TIMESTAMPTZ
creado_en           TIMESTAMPTZ
revocada_en         TIMESTAMPTZ NULL
```

---

# 21. Auditoría

Muy útil para proyectos compartidos.

## Tabla: auditoria

```text
auditoria
────────────────────────────────
id                  BIGSERIAL PK
usuario_id          UUID FK -> usuarios NULL
proyecto_id         UUID FK -> proyectos NULL
accion              VARCHAR
entidad             VARCHAR
entidad_id          UUID NULL
datos               JSONB
creado_en           TIMESTAMPTZ
```

Ejemplos:

```text
usuario_creado
proyecto_editado
archivo_subido
dispositivo_creado
canal_modificado
comando_enviado
miembro_agregado
```

---

# 22. Relaciones principales

```text
usuarios
   │
   ├── proyectos
   │      │
   │      ├── miembros_proyecto
   │      ├── documentos_proyecto
   │      ├── archivos_proyecto
   │      ├── dispositivos
   │      │      │
   │      │      ├── credenciales_dispositivo
   │      │      └── canales
   │      │             │
   │      │             ├── estado_canales
   │      │             ├── telemetria
   │      │             └── comandos
   │      │
   │      ├── eventos
   │      └── automatizaciones
   │
   ├── sesiones_usuario
   └── auditoria
```

---

# 23. Tablas iniciales recomendadas

Para la primera versión se implementarán:

1. `usuarios`
2. `roles_proyecto`
3. `proyectos`
4. `miembros_proyecto`
5. `documentos_proyecto`
6. `archivos_proyecto`
7. `dispositivos`
8. `credenciales_dispositivo`
9. `canales`
10. `estado_canales`
11. `telemetria`
12. `comandos`
13. `eventos`
14. `automatizaciones`
15. `auditoria`

`sesiones_usuario` puede añadirse después si se necesita revocación granular de sesiones.

---

# 24. Estructura de almacenamiento en disco

```text
storage/
├── usuarios/
│   └── {usuario_id}/
│       └── avatar/
│
├── proyectos/
│   └── {proyecto_id}/
│       ├── portada/
│       ├── documentos/
│       ├── evidencias/
│       ├── imagenes/
│       ├── diagramas/
│       ├── codigo/
│       └── otros/
│
└── temporales/
```

Ejemplo:

```text
storage/
└── proyectos/
    └── 1b70a8d2.../
        ├── evidencias/
        │   └── prototipo_01.jpg
        ├── documentos/
        │   └── informe_final.pdf
        └── diagramas/
            └── circuito.png
```

---

# 25. Reglas de almacenamiento

- No guardar archivos en PostgreSQL.
- No guardar rutas absolutas.
- Generar nombres físicos únicos.
- Conservar el nombre original en base de datos.
- Validar extensiones y tipos MIME.
- Aplicar límites de tamaño.
- Separar archivos por proyecto.
- No permitir `../` ni rutas arbitrarias.
- El backend controla todas las descargas.
- No exponer directamente todo el directorio `storage`.
- Eliminar archivos físicos cuando se elimine definitivamente su registro, mediante servicio controlado.
- En producción realizar copias de seguridad tanto de PostgreSQL como del directorio `storage`.

---

# 26. Protocolo MQTT inicial

Topics:

```text
nexiot/{proyecto_id}/{dispositivo_id}/telemetria
nexiot/{proyecto_id}/{dispositivo_id}/estado
nexiot/{proyecto_id}/{dispositivo_id}/comandos
nexiot/{proyecto_id}/{dispositivo_id}/ack
nexiot/{proyecto_id}/{dispositivo_id}/estado_conexion
```

Ejemplo de telemetría:

```json
{
  "canal": "temperatura",
  "valor": 24.8
}
```

Ejemplo de comando:

```json
{
  "comando_id": "a3e4...",
  "canal": "led_rojo",
  "valor": true
}
```

ACK:

```json
{
  "comando_id": "a3e4...",
  "correcto": true,
  "valor": true
}
```

---

# 27. Protocolo Serial para Node-RED

Formato:

```text
UTF-8
JSON
115200 baud por defecto
1 mensaje por línea
terminador \n
```

Arduino hacia Node-RED:

```json
{"tipo":"telemetria","canal":"temperatura","valor":24.8}
```

```json
{"tipo":"estado","canal":"led","valor":true}
```

Node-RED hacia Arduino:

```json
{"tipo":"comando","comando_id":"a3e4","canal":"led","valor":true}
```

Arduino responde:

```json
{"tipo":"ack","comando_id":"a3e4","correcto":true,"valor":true}
```

---

# 28. Flujo para encender un LED

```text
Usuario pulsa "Encender"
        │
        ▼
React
        │
        ▼
FastAPI
        │
        ├── crea registro en comandos
        │
        ▼
Mosquitto MQTT
        │
        ▼
ESP32 o Node-RED
        │
        ▼
Arduino / ESP32
        │
        ▼
GPIO = HIGH
        │
        ▼
ACK
        │
        ▼
Mosquitto
        │
        ▼
FastAPI
        │
        ├── comando = confirmado
        ├── actualiza estado_canales
        │
        ▼
WebSocket
        │
        ▼
React muestra "Encendido"
```

---

# 29. API inicial sugerida

## Autenticación

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Usuarios

```text
GET   /api/usuarios/me
PATCH /api/usuarios/me
```

## Proyectos

```text
GET    /api/proyectos
POST   /api/proyectos
GET    /api/proyectos/{id}
PATCH  /api/proyectos/{id}
DELETE /api/proyectos/{id}
```

## Miembros

```text
GET    /api/proyectos/{id}/miembros
POST   /api/proyectos/{id}/miembros
PATCH  /api/proyectos/{id}/miembros/{usuario_id}
DELETE /api/proyectos/{id}/miembros/{usuario_id}
```

## Documentación

```text
GET    /api/proyectos/{id}/documentos
POST   /api/proyectos/{id}/documentos
PATCH  /api/documentos/{id}
DELETE /api/documentos/{id}
```

## Archivos

```text
GET    /api/proyectos/{id}/archivos
POST   /api/proyectos/{id}/archivos
GET    /api/archivos/{id}/descargar
DELETE /api/archivos/{id}
```

## Dispositivos

```text
GET    /api/proyectos/{id}/dispositivos
POST   /api/proyectos/{id}/dispositivos
GET    /api/dispositivos/{id}
PATCH  /api/dispositivos/{id}
DELETE /api/dispositivos/{id}
```

## Canales

```text
GET    /api/dispositivos/{id}/canales
POST   /api/dispositivos/{id}/canales
PATCH  /api/canales/{id}
DELETE /api/canales/{id}
```

## Telemetría

```text
GET /api/canales/{id}/telemetria
GET /api/canales/{id}/estado
```

## Comandos

```text
POST /api/canales/{id}/comandos
GET  /api/comandos/{id}
```

## Eventos

```text
GET /api/proyectos/{id}/eventos
```

---

# 30. Estructura inicial del repositorio

```text
nexiot/
│
├── frontend/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── modelos/
│   │   ├── esquemas/
│   │   ├── servicios/
│   │   ├── repositorios/
│   │   ├── mqtt/
│   │   ├── websocket/
│   │   ├── seguridad/
│   │   └── almacenamiento/
│   │
│   └── tests/
│
├── mqtt/
│   └── mosquitto.conf
│
├── node-red/
│   └── nexiot-flow.json
│
├── firmware/
│   ├── esp32/
│   └── arduino/
│
├── storage/
│   └── proyectos/
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 31. Principios del MVP

- Primero local.
- Contabo después.
- Una sola aplicación backend.
- Una sola base PostgreSQL.
- Archivos físicos en filesystem.
- MQTT para dispositivos.
- WebSocket para navegador.
- Node-RED para Serial.
- No microservicios.
- No Kubernetes.
- No Kafka.
- No MongoDB.
- No almacenamiento BLOB.
- No complejidad innecesaria.

---

# 32. Primera meta técnica

La primera prueba completa será:

```text
Arduino / ESP32
      │
      ▼
Node-RED o MQTT directo
      │
      ▼
Mosquitto
      │
      ▼
FastAPI
      │
      ├── PostgreSQL
      │
      ▼
WebSocket
      │
      ▼
React
```

Y en sentido contrario:

```text
React
   │
   ▼
FastAPI
   │
   ▼
MQTT
   │
   ▼
Node-RED / ESP32
   │
   ▼
LED
```

Cuando ese flujo funcione de extremo a extremo tendremos la base sólida de UDLAIoT.

---

# 33. Política de telemetría, persistencia y retención de datos

La plataforma puede recibir información de Arduino, ESP32, simuladores o gateways con una frecuencia alta, incluso una o varias veces por segundo.

**No se debe guardar automáticamente cada mensaje recibido como histórico permanente.**

La plataforma separará cuatro conceptos:

```text
1. Estado actual
2. Telemetría histórica
3. Comandos enviados
4. Eventos
```

---

## 33.1 Estado actual

Cada canal tendrá siempre su último valor conocido en:

```text
estado_canales
```

Ejemplo:

```text
Temperatura: 24.8 °C
Humedad: 67 %
LED: ON
Bomba: OFF
```

Cada mensaje válido recibido puede actualizar este estado inmediatamente.

La lógica será:

```text
ESP32 / Arduino
      │
      ▼
MQTT / Node-RED
      │
      ▼
Backend
      │
      ├── actualiza estado_canales
      │
      ├── envía el dato por WebSocket
      │
      └── evalúa si debe guardar histórico
```

Esto permite que el dashboard sea realmente en tiempo real aunque no se almacene cada lectura en `telemetria`.

---

## 33.2 Telemetría histórica

La tabla:

```text
telemetria
```

se utilizará para gráficas, análisis y consultas históricas.

No necesariamente contendrá todos los mensajes recibidos.

La plataforma decidirá si una lectura debe persistirse según la configuración del canal.

Ejemplo:

```text
ESP32 envía temperatura cada 1 segundo

24.8
24.8
24.8
24.9
24.9
25.0
```

La página puede mostrar todos esos cambios en tiempo real, pero el histórico puede guardar solamente:

```text
10:00:00 -> 24.8
10:00:10 -> 24.9
10:00:20 -> 25.0
```

---

## 33.3 Política por tipo de canal

Política inicial recomendada:

| Tipo de información | Estado actual | Histórico |
|---|---|---|
| Temperatura | Cada lectura | Cada 10 segundos |
| Humedad | Cada lectura | Cada 10 segundos |
| Voltaje | Cada lectura | Cada 5 segundos |
| Corriente | Cada lectura | Cada 5 segundos |
| Nivel | Cada lectura | Cada 5-10 segundos |
| GPS | Cada lectura | Cada 2-5 segundos |
| LED | Cada lectura | Solo cuando cambia |
| Relé | Cada lectura | Solo cuando cambia |
| Puerta | Cada lectura | Solo cuando cambia |
| Movimiento | Estado + evento | Solo evento/cambio |
| Botón | Estado opcional | Evento |
| Error | Inmediato | Siempre |
| Conexión/desconexión | Inmediato | Siempre como evento |

Estos valores serán configurables.

---

## 33.4 Configuración de persistencia por canal

Cada canal podrá definir su política dentro de:

```text
canales.configuracion
```

Ejemplo para temperatura:

```json
{
  "guardar_historico": true,
  "intervalo_guardado_segundos": 10,
  "guardar_solo_si_cambia": false,
  "cambio_minimo": 0.2,
  "retencion_dias": 30
}
```

Ejemplo para un LED:

```json
{
  "guardar_historico": true,
  "guardar_solo_si_cambia": true,
  "retencion_dias": 180
}
```

Ejemplo para un canal que solo interesa en tiempo real:

```json
{
  "guardar_historico": false
}
```

---

## 33.5 Estrategias de guardado

El backend podrá aplicar una o varias reglas.

### Por intervalo

Guardar máximo una muestra cada cierto número de segundos.

```text
intervalo_guardado_segundos = 10
```

---

### Solo cuando cambia

Útil para estados discretos.

Ejemplo:

```text
LED:

10:00 OFF
10:15 ON
10:47 OFF
```

No se almacenan cientos de mensajes repetidos con el mismo valor.

---

### Por cambio mínimo

Útil para sensores analógicos.

Ejemplo:

```text
cambio_minimo = 0.2
```

Si el valor anterior almacenado fue:

```text
24.8
```

y llega:

```text
24.81
```

no es necesario persistirlo.

Si llega:

```text
25.1
```

sí puede guardarse.

---

### Por evento importante

Aunque todavía no se cumpla el intervalo normal, ciertos valores deben persistirse inmediatamente.

Ejemplos:

```text
temperatura supera límite
nivel llega a crítico
sensor genera error
puerta cambia de estado
movimiento detectado
```

---

## 33.6 Comandos enviados desde la página

Los comandos sí deben conservarse.

Ejemplo:

```text
Usuario: jperez23
Proyecto: Invernadero
Dispositivo: ESP32 Principal
Canal: bomba_agua
Acción: ON
Fecha: 22:10:03
Estado: confirmado
```

La tabla:

```text
comandos
```

permitirá saber:

- quién envió el comando;
- qué dispositivo recibió la orden;
- qué canal se modificó;
- qué valor fue solicitado;
- cuándo fue enviado;
- si el dispositivo confirmó;
- si expiró;
- si ocurrió un error.

Esto sirve para auditoría y diagnóstico.

---

## 33.7 Estados de un comando

```text
pendiente
enviado
confirmado
fallido
expirado
```

Flujo típico:

```text
Usuario pulsa ON
      │
      ▼
pendiente
      │
      ▼
MQTT publicado
      │
      ▼
enviado
      │
      ▼
dispositivo responde ACK
      │
      ▼
confirmado
```

Si no existe confirmación:

```text
enviado
   │
   ▼
timeout
   │
   ▼
fallido / expirado
```

---

## 33.8 Eventos

Los eventos importantes deben persistirse aunque no sean telemetría.

Ejemplos:

```text
ESP32 conectado
ESP32 desconectado
Node-RED perdió el puerto serial
Sensor dejó de responder
Temperatura crítica
Comando rechazado
Automatización ejecutada
Usuario modificó un canal
```

Se almacenan en:

```text
eventos
```

---

## 33.9 Retención de datos

Los históricos no necesitan conservarse para siempre con máxima resolución.

Política inicial sugerida:

```text
Telemetría detallada:
30 días

Telemetría resumida:
hasta 1 año o según proyecto

Eventos:
1 año

Comandos:
1 año

Estado actual:
sin histórico propio; siempre representa el último estado
```

Estos valores podrán ajustarse más adelante.

---

## 33.10 Resúmenes históricos

En una versión posterior, los datos antiguos podrán resumirse.

Ejemplo:

```text
Datos originales:
1 muestra cada 10 segundos
```

Después de cierto tiempo pueden transformarse en:

```text
1 resumen por minuto
```

Guardando:

```text
mínimo
máximo
promedio
cantidad de muestras
```

Ejemplo:

```text
10:00

mínimo:   24.7
máximo:   25.2
promedio: 24.9
muestras: 6
```

Esto permite conservar información útil durante mucho tiempo sin mantener todas las muestras originales.

---

## 33.11 Tabla futura para resúmenes

No es obligatoria en el MVP, pero se deja contemplada.

```text
resumenes_telemetria
────────────────────────────────
id                  BIGSERIAL PK
canal_id            UUID FK -> canales
periodo             VARCHAR
inicio_periodo      TIMESTAMPTZ
fin_periodo         TIMESTAMPTZ
valor_minimo        DOUBLE PRECISION NULL
valor_maximo        DOUBLE PRECISION NULL
valor_promedio      DOUBLE PRECISION NULL
cantidad_muestras   INTEGER
creado_en           TIMESTAMPTZ
```

Valores de `periodo`:

```text
minuto
hora
dia
```

---

## 33.12 Datos que NO deben almacenarse indiscriminadamente

No persistir automáticamente:

```text
miles de valores idénticos
mensajes duplicados
lecturas inválidas
JSON mal formado
mensajes sin dispositivo reconocido
datos fuera de formato
debug serial sin importancia
```

Estos mensajes pueden registrarse temporalmente en logs técnicos si es necesario.

---

## 33.13 Validación de telemetría

Antes de almacenar una lectura se validará:

```text
dispositivo válido
canal existente
tipo de dato correcto
valor permitido
timestamp válido
mensaje bien formado
```

Ejemplo:

Un canal definido como:

```text
tipo_dato = numero
valor_minimo = 0
valor_maximo = 100
```

no debería aceptar directamente:

```text
"hola"
```

como valor.

Dependiendo del canal, un valor fuera del rango puede:

```text
rechazarse
marcarse como inválido
generar un evento
```

---

## 33.14 Timestamps

El servidor será la referencia principal de tiempo para persistencia.

Cada registro tendrá:

```text
registrado_en
```

El dispositivo también podrá enviar su propio timestamp cuando sea necesario.

Ejemplo futuro:

```json
{
  "canal": "temperatura",
  "valor": 24.8,
  "timestamp_dispositivo": "2026-09-22T22:35:12Z"
}
```

Pero el backend también guardará la hora real en que recibió el mensaje.

---

## 33.15 Dato recibido vs dato almacenado

Es importante distinguirlos:

```text
RECIBIDO
→ cualquier dato válido que llega al backend

ESTADO ACTUAL
→ último valor conocido

HISTÓRICO
→ muestra seleccionada para persistencia

EVENTO
→ acontecimiento relevante

COMANDO
→ acción solicitada desde UDLAIoT
```

Un mismo mensaje puede:

```text
actualizar estado actual
+
enviarse por WebSocket
```

sin necesariamente convertirse en una fila nueva en `telemetria`.

---

## 33.16 Política inicial del MVP

Para la primera versión de UDLAIoT:

```text
1. Recibir telemetría con la frecuencia que envíe el dispositivo.

2. Validar cada mensaje.

3. Actualizar estado_canales inmediatamente.

4. Enviar cambios al navegador por WebSocket.

5. Sensores numéricos:
   guardar histórico cada 5-10 segundos por defecto.

6. Estados booleanos:
   guardar solo cuando cambien.

7. Errores y eventos relevantes:
   guardar siempre.

8. Comandos enviados desde la web:
   guardar siempre.

9. Permitir configurar la política por canal.

10. Implementar limpieza de históricos según retención.
```

---

## 33.17 Responsabilidad del backend

La decisión de qué se guarda pertenece al backend.

No se debe confiar en que cada Arduino o ESP32 aplique correctamente la política de persistencia.

El dispositivo puede enviar datos frecuentemente.

UDLAIoT decide:

```text
qué mostrar
qué guardar
qué ignorar
qué convertir en evento
qué considerar error
```

De esta manera todos los dispositivos siguen las mismas reglas aunque hayan sido programados por estudiantes diferentes.

