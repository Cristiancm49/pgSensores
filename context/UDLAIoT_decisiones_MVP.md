# UDLAIoT — Decisiones cerradas para el MVP

Este documento registra las decisiones que delimitan el primer desarrollo de UDLAIoT. Ante una diferencia con una propuesta anterior, estas decisiones tienen prioridad para el MVP.

## 1. Usuarios y administración

- No habrá registro público.
- La instalación creará un administrador semilla.
- El administrador podrá crear y administrar usuarios desde el panel.
- El inicio de sesión utilizará nombre de usuario o nickname y contraseña.
- El correo será opcional.
- La recuperación por correo se pospone.

## 2. Autenticación y sesiones

- Se utilizará un access token de corta duración; inicialmente, 15 minutos.
- Se utilizará un refresh token de varios días, con duración configurable por entorno.
- Los refresh tokens se almacenarán como hash, nunca en texto plano.
- Las sesiones se registrarán en `sesiones_usuario`.
- Se podrá revocar una sesión específica o todas las sesiones de un usuario.
- El cierre de sesión revocará la sesión correspondiente.

## 3. Credenciales de dispositivos

- `dispositivos` contendrá únicamente información y configuración del equipo.
- `credenciales_dispositivo` será la única fuente de autenticación del dispositivo.
- Se elimina `clave_dispositivo_hash` de `dispositivos`.
- Las credenciales almacenadas serán hashes o secretos protegidos según el mecanismo de autenticación; no se expondrán después de su creación.

## 4. Primera integración IoT

El primer camino soportado será:

```text
ESP32 simulado en Wokwi
        ↓
       MQTT
        ↓
     Mosquitto
        ↓
      FastAPI
        ├── PostgreSQL
        ↓
    WebSocket
        ↓
       React
```

También se implementará el camino inverso para controlar un LED virtual y recibir su ACK.

Arduino por Serial, Node-RED y el puente Serial ↔ MQTT se posponen hasta que este flujo sea estable.

## 5. Integrantes de proyectos

- Solo se podrán agregar usuarios ya existentes.
- La búsqueda y asignación se realizará mediante nombre de usuario o nickname.
- No se enviarán correos de invitación en el MVP.
- Los roles iniciales serán `propietario`, `editor` y `visualizador`.

## 6. Archivado, desactivación y eliminación

- Un proyecto se archivará mediante su estado `archivado`.
- Un dispositivo se desactivará mediante su estado `inactivo`.
- Archivar o desactivar no eliminará históricos, comandos, eventos, documentación ni evidencias.
- La eliminación definitiva será una operación separada y exigirá confirmación explícita.
- Al eliminar definitivamente un archivo se eliminarán de forma coordinada el registro de PostgreSQL y el archivo físico.

## 7. Límites de archivos

- Límite general inicial: 25 MB por archivo.
- Límite inicial para video: 100 MB por archivo.
- Los límites serán configurables mediante variables de entorno.
- Las cuotas totales por proyecto quedan previstas para una etapa posterior.

## 8. Primer hito funcional

El primer hito se considera completo cuando funciona este recorrido:

```text
Login
  ↓
Proyectos
  ↓
Proyecto
  ↓
Dispositivo
  ↓
Canales
  ├── sensor de temperatura en tiempo real
  └── LED controlable
        ↓
      MQTT
        ↓
  ESP32 simulado
        ↓
       ACK
        ↓
 interfaz actualizada
```

La interfaz no mostrará el comando como confirmado hasta recibir el ACK correspondiente.

## 9. Fuera del primer hito

- Registro público.
- Recuperación de contraseña por correo.
- Arduino por Serial y Node-RED.
- Automatizaciones avanzadas.
- Archivos de video superiores a 100 MB.
- Actualizaciones OTA.
- Roles adicionales o permisos complejos.
- Cuotas de almacenamiento por proyecto.

