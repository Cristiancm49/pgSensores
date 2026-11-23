# UDLAIoT — Lista de tareas

Backlog derivado de los documentos de arquitectura, base de datos, estilos y componentes. La prioridad propuesta busca entregar primero un flujo IoT completo y comprobable, y luego ampliar las funciones de colaboración y documentación.

## Criterio de prioridad

- **P0 — Fundacional:** bloquea el resto del proyecto.
- **P1 — MVP esencial:** necesario para la primera versión utilizable.
- **P2 — MVP ampliado:** completa la experiencia definida para proyectos universitarios.
- **P3 — Endurecimiento:** seguridad, operación y calidad antes de producción.
- **P4 — Posterior al MVP:** funcionalidad prevista, pero no necesaria para validar la base.

## 0. Decisiones de arquitectura — P0

- [x] Definir cómo se crean los primeros usuarios: administrador semilla y altas desde el panel, sin registro público.
- [x] Definir la estrategia JWT: access token de 15 minutos y refresh token revocable respaldado por `sesiones_usuario`.
- [x] Eliminar la duplicación de secretos: `credenciales_dispositivo` será la única fuente de verdad.
- [x] Definir los roles iniciales: `propietario`, `editor` y `visualizador`.
- [x] Definir la convención de nombres: interfaz y base de datos en español; código en inglés técnico.
- [x] Documentar los contratos MQTT utilizados por telemetría, estado, comandos y ACK.
- [x] Definir límites iniciales: 25 MB en general y 100 MB para video; faltan extensiones y MIME permitidos.
- [ ] Definir valores por defecto de persistencia y retención por tipo de canal.

## 1. Base del repositorio y entorno local — P0

- [ ] Crear la estructura raíz: `frontend`, `backend`, `mqtt`, `node-red`, `firmware`, `storage` y documentación.
- [x] Crear `.gitignore` para secretos, dependencias, compilados, almacenamiento local y archivos temporales.
- [x] Crear `.env.example` con variables de frontend, backend, PostgreSQL, MQTT, JWT y almacenamiento.
- [x] Crear `docker-compose.yml` con PostgreSQL, Mosquitto, backend y frontend.
- [x] Configurar volúmenes persistentes para PostgreSQL, Mosquitto y `storage`.
- [x] Añadir comprobaciones de salud y orden de arranque de servicios.
- [x] Crear un `README.md` con requisitos, instalación, ejecución y pruebas.
- [x] Incorporar linting y validación de tipos para Python y TypeScript.
- [ ] Configurar ejecución automatizada de pruebas de backend y frontend.

## 2. Backend y base de datos — P0

- [x] Inicializar FastAPI con configuración por entorno y estructura base por capas.
- [x] Configurar SQLAlchemy, PostgreSQL y un sistema de migraciones.
- [x] Crear modelos y migraciones para `usuarios`, `sesiones_usuario`, `roles_proyecto`, `proyectos` y `miembros_proyecto`.
- [x] Crear modelos y migraciones para `dispositivos`, `credenciales_dispositivo` y `canales`.
- [x] Crear el modelo y la migración para `estado_canales`.
- [ ] Crear modelos y migraciones para `telemetria`, `comandos` y `eventos`.
- [ ] Crear modelos y migraciones para `documentos_proyecto`, `archivos_proyecto` y `auditoria`.
- [ ] Preparar la tabla `automatizaciones`, sin implementar todavía su motor de ejecución.
- [ ] Añadir restricciones únicas, claves foráneas, cascadas controladas e índices, incluido `telemetria(canal_id, registrado_en DESC)`.
- [x] Crear datos semilla mínimos para roles y un usuario inicial según la decisión de autenticación.
- [ ] Implementar manejo uniforme de errores y respuestas HTTP.
- [ ] Añadir logs estructurados sin contraseñas, tokens ni credenciales de dispositivos.

## 3. Autenticación y autorización — P0

- [x] Implementar hash seguro y verificación de contraseñas.
- [x] Implementar `POST /api/auth/login`, renovación de tokens, `POST /api/auth/logout`, cierre de todas las sesiones y `GET /api/auth/me`.
- [ ] Implementar `GET /api/usuarios/me` y `PATCH /api/usuarios/me`.
- [x] Crear el administrador semilla durante la instalación e implementar la administración de usuarios sin registro público.
- [x] Crear dependencias de autenticación y autorización reutilizables en FastAPI.
- [x] Aplicar permisos por proyecto para propietario, editor y visualizador.
- [x] Validar autorización en backend para proyectos, miembros, dispositivos y canales.
- [ ] Registrar en auditoría las operaciones sensibles.
- [ ] Probar accesos permitidos, denegados y aislamiento entre proyectos.

## 4. Proyectos, miembros y navegación base — P1

- [x] Implementar CRUD REST de proyectos.
- [x] Implementar listado y administración de miembros y roles.
- [x] Inicializar React, Vite y TypeScript.
- [x] Configurar Tailwind CSS, Lucide, React Router y TanStack Query.
- [x] Definir tokens del tema claro con la paleta, tipografía, radios y sombras de la guía.
- [x] Crear `AppShell`, sidebar, topbar y navegación responsive.
- [x] Crear rutas de login, inicio, proyectos y detalle de proyecto.
- [ ] Crear componentes base: `Button`, `Card`, `Badge`, `Dialog`, `Input`, `Select`, `Tabs` y `DataTable`.
- [ ] Crear componentes comunes: `PageHeader`, `StatusBadge`, `EmptyState`, `ErrorState`, `LoadingState`, `ConfirmDialog` y skeletons.
- [x] Crear cliente API centralizado mediante `VITE_API_URL`; no hacer `fetch` desde componentes visuales.
- [x] Crear providers de autenticación, consultas y enrutamiento protegido.
- [x] Implementar pantallas de inicio de sesión, lista de proyectos, creación y detalle.
- [x] Implementar tarjetas de proyecto, resumen del proyecto y administración de miembros.
- [ ] Contemplar en cada pantalla los estados loading, success, empty y error.

## 5. Dispositivos y canales — P1

- [x] Implementar CRUD REST de dispositivos.
- [x] Implementar alta, rotación y revocación de credenciales MQTT de dispositivo.
- [x] Aplicar autenticación y ACL de Mosquitto para aislar los topics de cada dispositivo.
- [x] Implementar CRUD REST de canales con validación por `tipo_dato`, rango y capacidad de escritura.
- [x] Implementar endpoints de estado actual e histórico de canal.
- [x] Crear pantallas de dispositivos, alta de dispositivo y detalle.
- [x] Crear pantallas de canales y creación/edición de canal.
- [x] Implementar la tarjeta de canal con estado actual, edición, histórico y control de actuadores.
- [ ] Crear un registro de widgets por `tipo_widget` en vez de pantallas específicas por sensor.
- [ ] Implementar `SensorValue`, `Indicator`, `SwitchControl`, `SliderControl` y `TelemetryChart`.
- [ ] Añadir formularios con React Hook Form y Zod.
- [ ] Añadir imágenes opcionales para dispositivos y canales sin inferir ubicación física.
- [ ] Implementar permisos de interfaz reutilizables (`canManageDevices`, `canSendCommands`, etc.) como apoyo visual, sin sustituir la validación del backend.

## 6. Primer flujo IoT de extremo a extremo — P1

- [x] Configurar Mosquitto para desarrollo local y documentar autenticación y ACL.
- [x] Implementar cliente MQTT del backend con reconexión, suscripciones y cierre ordenado.
- [x] Procesar los topics de telemetría, estado, ACK y conexión definidos por el proyecto.
- [x] Validar dispositivo, canal, tipo de dato, rango, formato y timestamp de cada mensaje.
- [x] Actualizar `estado_canales` con cada lectura válida.
- [x] Emitir estado, telemetría, conexión y ACK por WebSocket.
- [x] Configurar `VITE_WS_URL` y crear el cliente WebSocket del frontend con reconexión.
- [x] Implementar creación y publicación de comandos desde REST hacia MQTT.
- [x] Implementar estados `pendiente`, `enviado`, `confirmado`, `fallido` y `expirado` con timeout.
- [x] Mostrar el estado de cada comando sin asumir éxito antes del ACK.
- [ ] Crear firmware ESP32 de referencia para telemetría y control de un LED mediante MQTT.
- [ ] Probar el flujo completo Wokwi/ESP32 → MQTT → FastAPI → PostgreSQL/WebSocket → React.
- [x] Probar el flujo inverso React → FastAPI → MQTT → dispositivo → ACK → React.
- [ ] Documentar una demostración reproducible con Wokwi o hardware físico.

### Definición de terminado del primer hito

- [x] Un usuario autenticado puede abrir un proyecto y ver un dispositivo.
- [x] Una lectura válida actualiza la interfaz en tiempo real y `estado_canales`.
- [x] Una lectura numérica aparece en una gráfica histórica.
- [x] Un comando de encendido no muestra éxito hasta recibir el ACK correspondiente.
- [ ] Una desconexión o un comando fallido genera un evento visible.

## 7. Persistencia, históricos y eventos — P1

- [ ] Implementar políticas por intervalo, solo al cambiar y cambio mínimo.
- [ ] Permitir `guardar_historico`, `intervalo_guardado_segundos`, `guardar_solo_si_cambia`, `cambio_minimo` y `retencion_dias` por canal.
- [ ] Evitar persistir duplicados, lecturas inválidas, JSON incorrecto y datos de dispositivos desconocidos.
- [ ] Persistir siempre comandos, errores y eventos importantes.
- [ ] Implementar consulta histórica con rango temporal, paginación y límites seguros.
- [ ] Implementar filtros de eventos por proyecto, dispositivo, canal, severidad y fecha.
- [ ] Crear `EventList`, `EventItem`, `EventSeverityBadge` y `EventFilters`.
- [ ] Crear una tarea programada de limpieza según la retención configurada.
- [ ] Probar que la alta frecuencia actualiza tiempo real sin insertar cada mensaje en `telemetria`.

## 8. Documentación y archivos — P2

- [x] Implementar CRUD de secciones editables de documentación con orden estable.
- [x] Crear navegación y editor de secciones de documentación.
- [x] Implementar servicio de almacenamiento con rutas relativas, nombres físicos únicos y separación por proyecto.
- [x] Implementar subida, listado, descarga y eliminación controlada de archivos.
- [x] Validar MIME, extensión, tamaño y nombre; impedir traversal (`../`) y rutas arbitrarias.
- [x] Evitar exposición directa del directorio `storage`.
- [x] Eliminar el archivo físico únicamente mediante el servicio asociado a la eliminación definitiva del registro.
- [x] Crear cargador, zona de arrastre, tarjetas, cuadrícula, lista, vista de tipo y diálogo de eliminación.
- [x] Mostrar nombre, tipo, tamaño, autor, fecha y descripción de cada archivo.
- [x] Añadir progreso y resultado visible para cargas.

## 9. Calidad de experiencia y accesibilidad — P2

- [ ] Verificar layouts de una, dos y tres/cuatro columnas en móvil, tablet y escritorio.
- [ ] Añadir navegación de teclado, foco visible, labels y `aria-label` donde corresponda.
- [ ] Verificar contraste y representar estados con icono y texto, no solo color.
- [ ] Centralizar formatos de fecha, hora relativa, bytes, números y unidades.
- [ ] Unificar variantes de botones y estados de badges; eliminar estilos manuales por pantalla.
- [ ] Preferir skeletons a spinners grandes y crear empty states con una siguiente acción útil.
- [ ] Mantener las páginas como orquestadores y dividir componentes monolíticos.
- [ ] Verificar que el frontend no use `any` salvo integraciones justificadas.
- [ ] Añadir notificaciones para guardar, crear, eliminar, subir y enviar comandos.

## 10. Pruebas y observabilidad — P2

- [ ] Añadir pruebas unitarias de servicios, permisos, validación de telemetría y políticas de persistencia.
- [ ] Añadir pruebas de integración para PostgreSQL, MQTT, almacenamiento y WebSocket.
- [ ] Añadir pruebas de API para autenticación, CRUD, permisos y aislamiento entre proyectos.
- [ ] Añadir pruebas de componentes para widgets, formularios y estados de comandos.
- [ ] Añadir pruebas end-to-end del flujo principal del usuario y del flujo IoT completo.
- [ ] Probar reconexiones de MQTT y WebSocket, ACK tardíos, timeouts y mensajes duplicados.
- [ ] Probar cargas inválidas, archivos grandes y nombres maliciosos.
- [ ] Crear métricas y alertas básicas para conexiones, mensajes inválidos, comandos fallidos y errores del backend.

## 11. Seguridad, respaldo y preparación para producción — P3

- [ ] Revisar CORS, cabeceras de seguridad, rate limiting y protección de endpoints sensibles.
- [ ] Aplicar mínimos privilegios a PostgreSQL, Mosquitto y filesystem.
- [ ] Impedir que secretos y hashes aparezcan en respuestas, logs o eventos WebSocket.
- [ ] Añadir límites de conexiones WebSocket y tamaño/frecuencia de mensajes MQTT.
- [ ] Definir copias de seguridad coordinadas de PostgreSQL y `storage` y probar su restauración.
- [ ] Definir migración de almacenamiento local y datos al VPS Contabo.
- [ ] Preparar configuración de producción, TLS, proxy inverso y gestión segura de secretos.
- [ ] Realizar pruebas de carga con telemetría concurrente y consultas históricas.
- [ ] Documentar operación, actualización, recuperación y rotación de credenciales.

## 12. Posterior al MVP — P4

- [ ] Implementar el motor de automatizaciones con disparadores, condiciones y acciones.
- [ ] Implementar resúmenes de telemetría por minuto, hora y día.
- [ ] Conservar históricos resumidos y depurar muestras detalladas antiguas.
- [ ] Crear un flujo Node-RED de referencia para puente Serial JSON ↔ MQTT.
- [ ] Crear firmware Arduino de referencia con JSON UTF-8, 115200 baudios y un mensaje por línea.
- [ ] Definir y aplicar cuotas totales de almacenamiento por proyecto.
- [ ] Añadir tema oscuro después de estabilizar el tema claro.
- [ ] Evaluar roles adicionales: docente, evaluador y administrador de proyecto.
- [ ] Evaluar almacenamiento de objetos si el filesystem local deja de ser suficiente.
