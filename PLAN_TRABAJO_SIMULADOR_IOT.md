# Plan de trabajo — Simulador propio de Arduino, ESP32 y dispositivos IoT

## Estado de implementación — 11 de noviembre de 2026

Ya están implementados el recorrido funcional, la automatización y el piloto AVR:

- sesiones persistentes y migración de base de datos;
- perfiles Arduino Uno, Arduino Mega, ESP32 DevKit y MQTT genérico;
- runtime administrado con telemetría determinista por semilla;
- detección automática de sensores y actuadores activos;
- MQTT real, Last Will, comandos y ACK;
- credenciales temporales y revocación al detener;
- inicio, pausa, reanudación, reinicio y detención;
- entradas manuales, desconexión, pérdida de ACK y latencia;
- pantalla web con laboratorio, métricas y consola;
- prueba de humo completa en `simulator/verify_stack.py`;
- rampas, secuencias, valores y fallos programados;
- importación/exportación JSON/YAML, reportes persistentes, historial y comparación;
- sesiones simultáneas con cuotas globales, por usuario y tiempo máximo;
- puente Serial JSON para Arduino USB;
- CI con PostgreSQL/Mosquitto reales y firmware aislado;
- compilación `.ino` con Arduino CLI y ejecución AVR con simavr;
- Renode 1.17 instalado en el runner y habilitado mediante un script de plataforma explícito;
- pruebas unitarias del generador, perfiles y protocolo serial.

Queda como evolución de hardware, no como fallo de software: validar el puente con una placa USB física y definir la primera placa ARM/RISC-V y su archivo de plataforma Renode. ESP32 continúa en el motor funcional porque emular CPU, Wi-Fi y todos sus periféricos requiere un piloto específico.

## 1. Decisión de alcance

El producto se construirá en dos niveles para obtener valor temprano sin intentar emular un microcontrolador completo desde el primer día.

### Nivel 1 — Simulador funcional de dispositivos (MVP)

Simula el comportamiento observable de Arduino, ESP32 y otros equipos:

- pines digitales y analógicos;
- sensores y actuadores configurables;
- conexión, desconexión y reconexión;
- MQTT y Serial JSON;
- telemetría, estado, comandos y ACK;
- latencia, ruido, pérdida de mensajes y fallos;
- escenarios reproducibles para probar frontend, backend, Mosquitto, WebSocket y persistencia.

Este nivel prueba los servicios de UDLAIoT de extremo a extremo usando exactamente los mismos contratos que un dispositivo real; el runner de firmware se ofrece como motor aislado adicional.

### Nivel 2 — Ejecución de firmware compilado (fase avanzada)

Compila sketches con Arduino CLI y ejecuta binarios en un motor compatible según la arquitectura:

- Arduino Uno/Nano/Mega (AVR): evaluar integración con `simavr`;
- placas ARM o RISC-V compatibles: evaluar Renode;
- ESP32: mantener inicialmente el simulador funcional y abrir una prueba técnica separada, porque emular CPU, Wi-Fi y periféricos de ESP32 con fidelidad es un proyecto mayor.

La interfaz será la misma para ambos niveles. El usuario elegirá el motor `funcional` o `firmware` sin cambiar el modelo de proyecto, dispositivo, canal o escenario.

## 2. Objetivo del MVP

Desde UDLAIoT, un usuario debe poder:

1. crear una simulación a partir de un dispositivo existente;
2. elegir una plantilla de placa y periféricos;
3. asociar cada sensor o actuador virtual con un canal real de UDLAIoT;
4. iniciar, pausar, reiniciar y detener la simulación;
5. modificar valores manualmente o mediante un escenario;
6. observar logs, telemetría, comandos y ACK en tiempo real;
7. inyectar fallos de red o dispositivo;
8. ejecutar una prueba y obtener un resultado aprobada/fallida con evidencias.

## 3. Arquitectura propuesta

```text
React — Estudio de simulación
  │ REST: configuración y control
  │ WebSocket: estado, consola y métricas
  ▼
FastAPI — Control plane
  ├── sesiones, plantillas y escenarios
  ├── autorización por proyecto
  ├── emisión de credenciales temporales
  └── resultados de pruebas
        │
        ▼
Runtime de simulación aislado
  ├── Device Core (reloj, estado y ciclo de ejecución)
  ├── perfiles de placa
  ├── periféricos virtuales
  ├── motor de escenarios y fallos
  └── adaptadores de transporte
        ├── MQTT ──► Mosquitto ──► FastAPI ──► PostgreSQL/WebSocket
        └── Serial JSON ──► puente ──► MQTT
```

### Componentes

| Componente | Responsabilidad |
|---|---|
| Estudio de simulación | Configurar, controlar y observar una sesión desde la web. |
| Control plane | Validar permisos, administrar sesiones y entregar eventos al navegador. |
| Device Core | Mantener reloj, valores, pines, conexión y ciclo de vida del dispositivo virtual. |
| Catálogo de placas | Declarar capacidades de Arduino Uno, Mega, ESP32 y dispositivos genéricos. |
| Periféricos | Modelar temperatura, humedad, luz, potenciómetro, botón, LED, relé, servo y motores básicos. |
| Motor de escenarios | Ejecutar pasos deterministas y aserciones con semilla reproducible. |
| Adaptadores | Hablar MQTT, Serial JSON y, posteriormente, HTTP/webhooks. |
| Runner de pruebas | Ejecutar escenarios sin interfaz para CI y guardar resultados. |
| Motor de firmware | Compilar y, cuando exista soporte, ejecutar el binario real de la placa. |

## 4. Modelo funcional

### Estados de una sesión

```text
creada → preparando → ejecutando ⇄ pausada → detenida
                         │
                         └──────────────→ fallida
```

No se permitirán dos runtimes activos para la misma sesión. Reiniciar restablecerá reloj, semilla, valores y contadores.

### Plantilla de dispositivo

Una plantilla versionada debe contener:

```json
{
  "schema_version": 1,
  "name": "Invernadero Arduino Uno",
  "board": "arduino_uno",
  "transport": "serial_json",
  "tick_ms": 100,
  "peripherals": [
    {"id": "temp", "type": "temperature", "pin": "A0", "channel": "temperatura"},
    {"id": "led", "type": "led", "pin": "D13", "channel": "led"}
  ]
}
```

### Escenario de prueba

Los escenarios serán declarativos, versionados y repetibles:

```yaml
name: temperatura_alta_activa_ventilador
seed: 42
steps:
  - at: 0s
    set: { temperatura: 24 }
  - at: 10s
    ramp: { channel: temperatura, to: 36, duration: 20s }
  - at: 15s
    fault: { type: network_latency, value: 800ms }
assertions:
  - within: 5s
    expect: { channel: ventilador, equals: true }
  - expect_event: temperatura_critica
```

## 5. Contratos que deben conservarse

El simulador utilizará los contratos actuales de producción; no tendrá rutas especiales que oculten fallos reales.

### MQTT

```text
nexiot/devices/{device_id}/telemetry/{channel_key}
nexiot/devices/{device_id}/state/{channel_key}
nexiot/devices/{device_id}/commands/{channel_key}
nexiot/devices/{device_id}/ack/{channel_key}
nexiot/devices/{device_id}/status
```

Reglas mínimas:

- MQTT 3.1.1, QoS 1 para comandos, ACK y estado;
- Last Will `offline` y estado retenido;
- `command_id` obligatorio e idempotencia de ACK;
- timestamps ISO 8601 en UTC;
- validación de tipo, rango y tamaño de payload;
- el simulador no puede publicar fuera del espacio del dispositivo asignado.

### Serial JSON

- UTF-8, 115200 baud por defecto, un JSON por línea y terminador `\n`;
- mensajes `telemetry`, `state`, `command`, `ack`, `status` y `error`;
- límite de longitud por línea y rechazo explícito de JSON inválido;
- el puente Serial ↔ MQTT debe ser un adaptador independiente, no lógica embebida en el simulador.

## 6. API mínima del simulador

```text
GET    /api/simulator/templates
POST   /api/simulator/sessions
GET    /api/simulator/sessions/{id}
PATCH  /api/simulator/sessions/{id}
POST   /api/simulator/sessions/{id}/start
POST   /api/simulator/sessions/{id}/pause
POST   /api/simulator/sessions/{id}/reset
POST   /api/simulator/sessions/{id}/stop
POST   /api/simulator/sessions/{id}/inputs
POST   /api/simulator/sessions/{id}/faults
GET    /api/simulator/sessions/{id}/logs
POST   /api/simulator/scenarios/{id}/run
GET    /api/simulator/runs/{id}
WS     /api/simulator/sessions/{id}/stream
```

Todas las operaciones deberán verificar acceso al proyecto y capacidad de escritura. Las sesiones de solo observación podrán compartirse con visualizadores.

## 7. Persistencia propuesta

Tablas nuevas:

- `simulator_templates`: plantilla, versión de esquema, propietario y visibilidad;
- `simulator_sessions`: proyecto, dispositivo, motor, estado, semilla y timestamps;
- `simulator_scenarios`: pasos, aserciones y versión;
- `simulator_runs`: resultado, duración, versión usada y resumen;
- `simulator_assertions`: resultado y evidencia de cada aserción.

Los logs de alto volumen no deben guardarse fila por fila indefinidamente. Se conservará un buffer durante la ejecución y un artefacto comprimido por corrida; PostgreSQL guardará solo metadatos y resumen.

## 8. Experiencia web

Nueva sección **Simulador** con cuatro áreas:

1. **Sesiones**: tarjetas compactas con placa, dispositivo, estado y última ejecución.
2. **Editor**: placa, periféricos, mapeo canal ↔ pin y transporte.
3. **Laboratorio**: controles de ejecución, valores manuales, representación de pines y consola.
4. **Escenarios y resultados**: pasos, aserciones, duración, evidencias y comparación de corridas.

El MVP no necesita un diagrama eléctrico libre tipo CAD. Usará componentes predefinidos y un mapeo claro de pines. El lienzo de cableado se evaluará después de validar el flujo de pruebas.

## 9. Fases, entregables y criterios de aceptación

### Fase 0 — Contratos y prueba base (2–3 días)

- congelar esquema MQTT y Serial v1;
- convertir `simulator/esp32_virtual.py` en prueba de referencia;
- documentar casos de conexión, telemetría, comando, ACK y desconexión;
- agregar pruebas automáticas del recorrido actual.

**Aceptación:** el simulador actual supera una prueba repetible de extremo a extremo sin pasos manuales ocultos.

### Fase 1 — Núcleo extensible (4–5 días)

- separar Device Core, periféricos, transportes y configuración;
- agregar perfiles `generic_mqtt`, `arduino_uno`, `arduino_mega` y `esp32_devkit`;
- implementar reloj virtual, semilla, pausa, reinicio y apagado limpio;
- incluir sensores y actuadores base.

**Aceptación:** una misma configuración puede ejecutar al menos Arduino Uno y ESP32 funcionales sin duplicar lógica.

### Fase 2 — Control plane y persistencia (5–6 días)

- migraciones y modelos;
- API de plantillas, sesiones y ciclo de vida;
- autorización por proyecto;
- supervisor de procesos/contenedores y límites de recursos;
- stream de logs y estado por WebSocket.

**Aceptación:** iniciar y detener una sesión desde API no deja procesos huérfanos y solo usa credenciales temporales del dispositivo asignado.

### Fase 3 — Estudio web (5–7 días)

- navegación y listado de sesiones;
- asistente para placa, transporte, periféricos y canales;
- laboratorio con valores, pines, consola y estado de conexión;
- controles accesibles y responsive;
- errores accionables para credenciales, broker y configuración inválida.

**Aceptación:** un usuario crea y ejecuta una simulación completa sin editar archivos `.env` ni usar terminal.

### Fase 4 — Escenarios, fallos y aserciones (5–6 días)

- DSL YAML/JSON con versión de esquema;
- rampas, ondas, valores aleatorios con semilla y secuencias;
- fallos de latencia, pérdida, desconexión, payload inválido, sensor bloqueado y ACK tardío/ausente;
- aserciones sobre canal, evento, comando, persistencia y tiempo máximo;
- reporte de corrida.

**Aceptación:** dos ejecuciones con la misma semilla producen el mismo resultado y un fallo esperado queda demostrado en el reporte.

### Fase 5 — Automatización y CI (4–5 días)

- runner headless;
- fixtures para crear proyecto, dispositivo, canales y credenciales efímeras;
- pruebas de contrato, integración, carga moderada y recuperación;
- artefactos de logs y resultado JUnit/JSON;
- limpieza automática de datos de prueba.

**Aceptación:** CI levanta PostgreSQL, Mosquitto, backend y simulador, ejecuta escenarios y falla el pipeline si una aserción no se cumple.

### Fase 6 — Piloto de firmware real (2–3 semanas, después del MVP)

- servicio de compilación aislado con Arduino CLI;
- lista cerrada de placas y librerías permitidas;
- límites de CPU, memoria, tiempo y disco;
- prueba AVR con `simavr` para Uno/Nano/Mega;
- prueba Renode para una placa ARM o RISC-V compatible;
- decisión técnica separada para ESP32 basada en una prueba de concepto.

**Aceptación:** un sketch de Arduino Uno se compila, ejecuta, expone Serial/pines y supera el mismo escenario que el motor funcional.

## 10. Backlog inicial priorizado

### P0 — obligatorio para MVP

- contratos MQTT/Serial v1;
- Device Core y configuración versionada;
- plantillas de placas y periféricos;
- sesiones y supervisor;
- UI de creación, ejecución y consola;
- escenarios deterministas;
- comandos/ACK y fallos de conexión;
- runner headless y pruebas end-to-end;
- autorización, credenciales temporales y límites de recursos.

### P1 — siguiente incremento

- gráficas comparativas entre valor generado, recibido y persistido;
- exportar/importar plantillas y escenarios;
- múltiples dispositivos en una misma corrida;
- Serial virtual y puente administrado desde la web;
- biblioteca compartida de escenarios;
- métricas de latencia extremo a extremo.

### P2 — evolución

- ejecución de firmware AVR;
- soporte de placas Renode;
- editor visual de conexiones;
- colaboración en tiempo real;
- banco de pruebas con hardware físico;
- pruebas de carga con decenas o cientos de dispositivos virtuales.

## 11. Estrategia de pruebas

| Nivel | Qué valida |
|---|---|
| Unitarias | funciones de onda, límites, reloj, parser, idempotencia y máquinas de estado. |
| Contrato | formatos MQTT/Serial, topics, tipos, timestamps y errores. |
| Integración | simulador ↔ Mosquitto ↔ backend ↔ PostgreSQL. |
| End-to-end | creación web, telemetría visible, comando, ACK y reporte. |
| Resiliencia | broker reiniciado, red lenta, duplicados, orden incorrecto y pérdida de ACK. |
| Seguridad | ACL por dispositivo, acceso entre proyectos, secretos y entradas maliciosas. |
| Rendimiento | frecuencia sostenible, latencia p95, uso de CPU/memoria y limpieza. |

Casos de aceptación obligatorios:

1. conexión y Last Will;
2. telemetría numérica válida;
3. valor fuera de rango;
4. payload inválido;
5. comando confirmado;
6. comando fallido;
7. ACK duplicado;
8. timeout de ACK;
9. reconexión sin duplicar la sesión;
10. aislamiento: un dispositivo no publica ni se suscribe a topics de otro;
11. persistencia conforme al intervalo y `save_only_if_changed`;
12. actualización del navegador por WebSocket.

## 12. Seguridad y operación

- ejecutar cada runtime sin privilegios y con límites de CPU, memoria, procesos y tiempo;
- no aceptar comandos de shell ni imágenes de contenedor proporcionadas por usuarios en el MVP;
- usar credenciales MQTT efímeras o rotadas y nunca mostrarlas en logs;
- filtrar secretos de consola y reportes;
- validar plantillas y escenarios contra JSON Schema;
- limitar frecuencia de publicación y tamaño de mensajes;
- registrar auditoría de inicio, parada, fallos inyectados y ejecución de pruebas;
- aplicar TTL a sesiones, artefactos y credenciales;
- detener y limpiar runtimes al reiniciar el backend mediante reconciliación de estado.

## 13. Métricas de éxito

- una primera sesión configurada en menos de 5 minutos;
- inicio del runtime en menos de 5 segundos en entorno local;
- latencia p95 simulador → UI menor a 1 segundo a frecuencia normal;
- 100 % de corridas reproducibles con la misma semilla;
- cero procesos huérfanos después de detener o expirar sesiones;
- cero acceso MQTT entre dispositivos o proyectos;
- escenarios críticos ejecutados automáticamente en cada cambio del backend IoT.

## 14. Riesgos y decisiones pendientes

| Riesgo | Tratamiento |
|---|---|
| Intentar emular ESP32 completo demasiado pronto | Mantener ESP32 funcional en MVP y exigir prueba de concepto antes de prometer firmware real. |
| Diferencias entre simulación y hardware | Reutilizar contratos, agregar perfiles de limitaciones y mantener una pequeña suite con placas físicas. |
| Ejecución de código no confiable | Posponerla al Nivel 2 y aislarla con contenedores, límites y lista cerrada de toolchains. |
| Logs y telemetría excesivos | Backpressure, cuotas, muestreo y artefactos con retención. |
| Dependencia del broker | Reintentos acotados, Last Will, idempotencia y pruebas de recuperación. |
| Escenarios incompatibles tras cambios | `schema_version`, migraciones y validación previa. |

Decisiones que deben cerrarse al iniciar Fase 2:

1. ¿una sesión por usuario o se permiten sesiones compartidas por proyecto?;
2. ¿tiempo máximo y cantidad máxima de dispositivos concurrentes?;
3. ¿los artefactos de corrida se guardan en filesystem actual o en almacenamiento de objetos?;
4. ¿Serial virtual se soporta en Windows desde el MVP o el runtime oficial será Linux/Docker?;
5. ¿qué placa ARM/RISC-V será el primer piloto de firmware después de AVR?

## 15. Definición de terminado del MVP

El MVP estará terminado cuando un usuario, exclusivamente desde la web, pueda crear una sesión para un dispositivo de UDLAIoT, mapear sensores y actuadores, ejecutar un escenario determinista, observar telemetría y comandos en tiempo real, inyectar una desconexión y descargar un reporte con todas las aserciones; la misma prueba debe poder correr sin interfaz en CI y respetar permisos, ACL MQTT y limpieza de recursos.

## 16. Referencias técnicas verificadas

- Arduino CLI permite compilar sketches por placa/FQBN y exponer el proceso mediante CLI o gRPC: <https://docs.arduino.cc/arduino-cli/>.
- Referencia oficial de `arduino-cli compile`: <https://docs.arduino.cc/arduino-cli/commands-reference/arduino-cli_compile/>.
- `simavr` es un simulador AVR integrable, apropiado para evaluar Uno/Nano/Mega: <https://github.com/buserror/simavr>.
- Renode ofrece simulación de sistemas embebidos, periféricos y automatización de pruebas para arquitecturas soportadas: <https://renode.readthedocs.io/>.

