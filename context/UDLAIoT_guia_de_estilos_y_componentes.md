# UDLAIoT — Guía de estilos, componentes y arquitectura frontend

## 1. Objetivo

Este documento define las reglas visuales y de desarrollo frontend de UDLAIoT.

El objetivo es conseguir:

- interfaz consistente;
- código limpio;
- componentes reutilizables;
- diseño responsive;
- facilidad de mantenimiento;
- evitar duplicación;
- separar lógica, datos y presentación;
- permitir que nuevas pantallas reutilicen el sistema existente.

---

# 2. Stack frontend

```text
React
Vite
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
Recharts
React Router
WebSocket
Lucide Icons
```

---

# 3. Principios visuales

UDLAIoT debe verse como una plataforma técnica moderna y realista.

Evitar:

- exceso de neón;
- apariencia "sci-fi";
- interfaces demasiado generadas por IA;
- mapas 3D ficticios de casas;
- cables flotantes irreales;
- saturación de colores;
- sombras excesivas;
- tarjetas innecesariamente grandes.

Priorizar:

- fotografías reales de dispositivos;
- tarjetas limpias;
- fondos neutros;
- azul como color principal de interacción;
- verde reservado para estados correctos o conectados;
- jerarquía visual clara;
- gráficos simples;
- densidad compacta, con espacio suficiente para separar grupos;
- bordes suaves;
- estados muy claros;
- información técnica legible.

---

# 4. Paleta inicial

## Tema claro

```text
Fondo principal:       #F6F8FB
Superficie:            #FFFFFF
Superficie secundaria: #F2F4F7
Borde:                 #E5E7EB

Texto principal:       #111827
Texto secundario:      #667085
Texto tenue:           #98A2B3

Primario:              #1677FF
Primario hover:        #0F63D8
Primario suave:        #EAF3FF
Sidebar:               #0B2239
Sidebar profundo:      #0B1928

Éxito:                 #16A34A
Advertencia:           #F59E0B
Error:                 #EF4444
Información:           #1677FF
```

## Tema oscuro posterior

Se podrá añadir cuando el tema claro esté estable.

---

# 5. Tipografía

Fuente recomendada:

```text
Inter
```

Alternativas:

```text
Geist
Manrope
```

Escala:

```text
xs   12px
sm   14px
base 16px
lg   18px
xl   20px
2xl  24px
3xl  28px
```

Pesos principales:

```text
400 normal
500 medium
600 semibold
700 bold
```

---

# 6. Espaciado

Usar el sistema de Tailwind.

Base visual:

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
```

No crear medidas arbitrarias salvo necesidad real.

---

# 7. Bordes

```text
Tarjetas:           rounded-xl (10px a 14px)
Controles:          rounded-lg
Botones:            rounded-lg
Modales:            rounded-xl
Avatares:           rounded-full
```

---

# 8. Sombras

Mantenerlas discretas.

```text
shadow-sm
```

como valor por defecto.

Evitar:

```text
shadow-2xl
```

en tarjetas normales.

---

# 9. Layout general

Desktop:

```text
┌──────────────────────────────────────────────────┐
│ Sidebar │ Header                                │
│         ├───────────────────────────────────────┤
│         │                                       │
│         │ Contenido                             │
│         │                                       │
└──────────────────────────────────────────────────┘
```

Mobile:

```text
┌──────────────────────────┐
│ Header + botón menú      │
├──────────────────────────┤
│                          │
│ Contenido                │
│                          │
└──────────────────────────┘
```

---

# 10. Sidebar

Secciones iniciales:

```text
Inicio
Proyectos
Dispositivos
Sensores
Automatizaciones
Documentación
Archivos
Eventos
Configuración
```

No todas deben aparecer globalmente.

Algunas pertenecen al contexto de un proyecto.

---

# 11. Estructura de rutas

```text
/login

/app
/app/inicio

/app/proyectos
/app/proyectos/:proyectoId

/app/proyectos/:proyectoId/resumen
/app/proyectos/:proyectoId/documentacion
/app/proyectos/:proyectoId/archivos
/app/proyectos/:proyectoId/dispositivos
/app/proyectos/:proyectoId/eventos
/app/proyectos/:proyectoId/automatizaciones

/app/dispositivos/:dispositivoId
/app/dispositivos/:dispositivoId/canales
/app/dispositivos/:dispositivoId/configuracion
```

---

# 12. Organización de carpetas frontend

```text
frontend/
└── src/
    ├── app/
    │   ├── router/
    │   └── providers/
    │
    ├── components/
    │   ├── ui/
    │   ├── common/
    │   ├── layout/
    │   ├── project/
    │   ├── device/
    │   ├── channel/
    │   ├── telemetry/
    │   ├── files/
    │   └── automation/
    │
    ├── features/
    │   ├── auth/
    │   ├── projects/
    │   ├── devices/
    │   ├── channels/
    │   ├── telemetry/
    │   ├── commands/
    │   ├── files/
    │   └── automations/
    │
    ├── hooks/
    ├── services/
    ├── lib/
    ├── types/
    ├── utils/
    └── styles/
```

---

# 13. Regla de separación

## `components/ui`

Componentes básicos sin conocimiento de negocio.

Ejemplos:

```text
Button
Input
Select
Dialog
Badge
Card
Tabs
Tooltip
Table
Dropdown
Skeleton
Switch
Slider
```

## `components/common`

Componentes genéricos de UDLAIoT.

Ejemplos:

```text
PageHeader
EmptyState
ErrorState
LoadingState
ConfirmDialog
SearchInput
StatusBadge
DataTable
FileDropzone
```

## `features`

Contiene lógica específica del negocio.

Ejemplo:

```text
features/devices/
├── api.ts
├── hooks.ts
├── types.ts
├── validators.ts
└── components/
```

---

# 14. Componentes principales

## AppShell

Responsable de:

- sidebar;
- header;
- contenido;
- navegación responsive.

No contiene lógica de dispositivos ni proyectos.

---

## PageHeader

Props:

```ts
type PageHeaderProps = {
  title: string
  description?: string
  actions?: React.ReactNode
}
```

Uso:

```tsx
<PageHeader
  title="Dispositivos"
  description="Equipos asociados al proyecto"
  actions={<Button>Agregar dispositivo</Button>}
/>
```

---

## StatusBadge

Estados reutilizables:

```text
Conectado
Desconectado
Advertencia
Error
Pendiente
Activo
Inactivo
```

No crear badges diferentes manualmente en cada pantalla.

---

## ProjectCard

Muestra:

- imagen;
- nombre;
- descripción corta;
- cantidad de dispositivos;
- integrantes;
- estado;
- última modificación.

---

## DeviceCard

Muestra:

- foto real del dispositivo;
- nombre;
- placa;
- conexión;
- estado;
- última conexión;
- cantidad de canales.

Ejemplo:

```text
ESP32 Invernadero
ESP32 DevKit V1

● Conectado
6 canales

[ Abrir dispositivo ]
```

---

## ChannelCard

Componente base para sensores y actuadores.

Información:

```text
nombre
valor
unidad
estado
imagen opcional
última actualización
```

El control concreto depende de `tipo_widget`.

---

# 15. Renderizado de widgets por configuración

No crear una pantalla diferente para cada sensor.

Crear un sistema de widgets.

```ts
const widgets = {
  temperatura: TemperatureWidget,
  humedad: HumidityWidget,
  interruptor: SwitchWidget,
  slider: SliderWidget,
  indicador: IndicatorWidget,
  grafica: ChartWidget,
}
```

La base de datos determina:

```text
tipo_widget = "interruptor"
```

El frontend decide qué componente renderizar.

---

# 16. Componentes de canales

## SensorValue

Para valores numéricos.

```text
24.8 °C
```

## SwitchControl

Para:

```text
LED
Relé
Bomba
Ventilador
```

Estados:

```text
apagado
encendiendo
encendido
apagando
error
sin_conexion
```

## SliderControl

Para:

```text
PWM
intensidad
servo
porcentaje
```

## Indicator

Para:

```text
movimiento detectado
puerta abierta
nivel crítico
```

## TelemetryChart

Props conceptuales:

```ts
type TelemetryChartProps = {
  data: TelemetryPoint[]
  unit?: string
  min?: number
  max?: number
  loading?: boolean
}
```

---

# 17. Estado de comandos

Nunca asumir que un dispositivo ejecutó inmediatamente una orden.

Secuencia visual:

```text
OFF
 ↓
Usuario pulsa
 ↓
ENCENDIENDO...
 ↓
ACK
 ↓
ON
```

Si falla:

```text
ERROR
```

Esto debe ser responsabilidad de un componente reutilizable.

---

# 18. Componentes de documentación

```text
DocumentationSection
DocumentationEditor
DocumentationNavigation
DocumentationViewer
```

Las secciones pueden representar:

```text
Objetivos
Metodología
Materiales
Resultados
Conclusiones
```

---

# 19. Componentes de archivos

```text
FileUploader
FileDropzone
FileCard
FileGrid
FileList
FilePreview
FileDeleteDialog
```

Cada archivo muestra:

```text
nombre
tipo
tamaño
quién lo subió
fecha
descripción
```

---

# 20. Componentes de eventos

```text
EventList
EventItem
EventSeverityBadge
EventFilters
```

Severidades:

```text
informacion
advertencia
critico
```

---

# 21. Componentes para proyectos compartidos

```text
MemberList
MemberAvatar
MemberRoleSelect
InviteMemberDialog
RemoveMemberDialog
```

Los permisos nunca se comprueban únicamente en frontend.

El backend siempre valida autorización.

---

# 22. Componentes de formularios

Crear componentes de formulario reutilizables.

```text
FormField
FormLabel
FormError
TextInput
NumberInput
SelectField
SwitchField
FileField
```

Usar una estrategia consistente de validación.

Recomendación:

```text
React Hook Form
+
Zod
```

---

# 23. API

Nunca hacer:

```tsx
fetch("http://localhost:8000/api/...")
```

directamente dentro de componentes visuales.

Crear servicios:

```text
services/api.ts
features/projects/api.ts
features/devices/api.ts
```

Ejemplo:

```ts
export async function getProjects() {
  return api.get("/proyectos")
}
```

---

# 24. TanStack Query

Usarlo para:

```text
proyectos
dispositivos
canales
documentos
archivos
eventos
históricos
```

Ejemplo conceptual:

```ts
useQuery({
  queryKey: ["projects"],
  queryFn: getProjects,
})
```

No guardar manualmente en `useState` información que realmente pertenece al servidor.

---

# 25. WebSocket

WebSocket se utilizará para:

```text
telemetría en vivo
estado de dispositivos
estado de canales
ACK de comandos
eventos
```

No para operaciones CRUD normales.

CRUD:

```text
REST
```

Tiempo real:

```text
WebSocket
```

---

# 26. Hooks personalizados

Ejemplos:

```text
useAuth()
useCurrentUser()
useProjects()
useProject()
useDevices()
useDevice()
useChannels()
useChannelState()
useTelemetry()
useSendCommand()
useRealtimeDevice()
```

Evitar hooks gigantes.

---

# 27. TypeScript

No usar `any` salvo integración inevitable.

Crear tipos:

```ts
type Usuario = ...
type Proyecto = ...
type Dispositivo = ...
type Canal = ...
type Telemetria = ...
type Comando = ...
type Evento = ...
```

Los nombres del código pueden estar en inglés o español, pero deben seguir una sola convención.

Recomendación:

- interfaz visible al usuario: español;
- código: inglés técnico;
- base de datos: español, por decisión del proyecto.

---

# 28. Manejo de errores

Todas las pantallas deben contemplar:

```text
loading
success
empty
error
```

Ejemplo:

```tsx
if (isLoading) return <DeviceListSkeleton />
if (isError) return <ErrorState />
if (!devices.length) return <EmptyDevices />
```

---

# 29. Skeletons

Preferir skeletons a spinners gigantes.

Ejemplos:

```text
ProjectCardSkeleton
DeviceCardSkeleton
ChartSkeleton
TableSkeleton
```

---

# 30. Empty states

Nunca mostrar simplemente:

```text
"No hay datos"
```

Usar un estado útil.

Ejemplo:

```text
Aún no tienes dispositivos

Conecta un ESP32, Arduino o simulador
para comenzar a recibir información.

[ Agregar dispositivo ]
```

---

# 31. Modales

Usarlos para operaciones pequeñas:

```text
crear canal
editar canal
eliminar dispositivo
agregar integrante
subir archivo
```

Para formularios grandes usar página dedicada.

---

# 32. Tablas

Usar tablas para datos técnicos:

```text
dispositivos
integrantes
archivos
eventos
comandos
```

No usar una tabla cuando tarjetas permitan una lectura más clara.

---

# 33. Fotografías

La interfaz puede usar:

```text
foto de ESP32
foto del Arduino
foto del sensor DHT22
foto de un módulo relé
foto subida por el estudiante
```

No inventar automáticamente la ubicación física.

La plataforma no necesita escanear la casa o laboratorio.

---

# 34. Imágenes de canales

Cada canal puede tener una fotografía opcional.

Ejemplo:

```text
Sensor de nivel
[foto real]

Nivel actual
72 %
```

La imagen es decorativa e identificativa, no representa ubicación.

---

# 35. Responsive

Puntos principales:

```text
mobile
tablet
desktop
wide desktop
```

Desktop:

```text
3-4 tarjetas por fila
```

Tablet:

```text
2 tarjetas
```

Mobile:

```text
1 tarjeta
```

---

# 36. Accesibilidad

- botones con texto o `aria-label`;
- contraste suficiente;
- navegación por teclado;
- labels en inputs;
- no depender únicamente del color;
- estados con icono + texto.

Ejemplo:

```text
● Conectado
```

y no solamente un círculo verde.

---

# 37. Nombres de componentes

PascalCase:

```text
DeviceCard.tsx
ChannelCard.tsx
PageHeader.tsx
```

Hooks:

```text
useDevices.ts
useTelemetry.ts
```

Funciones:

```text
formatDate()
formatFileSize()
getDeviceStatusLabel()
```

---

# 38. Regla de tamaño

Un componente que crece demasiado debe dividirse.

Evitar archivos de:

```text
800 líneas
1000 líneas
```

Una página debe orquestar componentes, no contener toda la implementación.

---

# 39. Funciones utilitarias

Centralizar:

```text
formatDate
formatDateTime
formatRelativeTime
formatBytes
formatNumber
formatUnit
```

No duplicarlas en distintas pantallas.

---

# 40. Permisos

Crear una abstracción:

```ts
canEditProject()
canManageMembers()
canManageDevices()
canSendCommands()
canDeleteProject()
```

No llenar la interfaz de condicionales repetidos.

---

# 41. Diseño de botones

Variantes:

```text
primary
secondary
outline
ghost
danger
```

No crear colores manualmente por pantalla.

---

# 42. Iconos

Usar una sola librería:

```text
Lucide React
```

Ejemplos:

```text
Cpu
Activity
Thermometer
Droplets
Power
Wifi
WifiOff
File
Folder
Users
Settings
Bell
```

---

# 43. No duplicar lógica visual

Incorrecto:

```text
TemperatureCard
HumidityCard
PressureCard
VoltageCard
```

si todos hacen lo mismo.

Preferir:

```tsx
<SensorCard
  icon={Thermometer}
  label="Temperatura"
  value={24.8}
  unit="°C"
/>
```

---

# 44. Variables de entorno frontend

```text
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

Nunca hardcodear URLs.

---

# 45. Variables de entorno backend

Ejemplo:

```text
DATABASE_URL=postgresql+psycopg://...
MQTT_HOST=localhost
MQTT_PORT=1883
JWT_SECRET=...
STORAGE_PATH=./storage
```

---

# 46. Limpieza de código

Reglas:

- no lógica MQTT en componentes React;
- no SQL en rutas FastAPI;
- no rutas de archivos construidas directamente desde entrada del usuario;
- no credenciales hardcodeadas;
- no componentes monolíticos;
- no copiar/pegar tarjetas;
- no mezclar estado remoto y estado visual;
- no usar `any` indiscriminadamente.

---

# 47. Arquitectura backend recomendada

```text
backend/app/
├── api/
├── modelos/
├── esquemas/
├── repositorios/
├── servicios/
├── mqtt/
├── websocket/
├── seguridad/
├── almacenamiento/
└── core/
```

Responsabilidades:

```text
api
→ HTTP

modelos
→ SQLAlchemy

esquemas
→ Pydantic

repositorios
→ consultas BD

servicios
→ reglas de negocio

mqtt
→ mensajes IoT

websocket
→ tiempo real navegador

seguridad
→ JWT, hashing, permisos

almacenamiento
→ archivos físicos
```

---

# 48. Patrón de servicio

Una ruta no debería contener toda la lógica.

Incorrecto:

```text
router
→ valida
→ consulta DB
→ guarda archivo
→ publica MQTT
→ genera respuesta
```

Correcto:

```text
router
   ↓
service
   ├── repository
   ├── storage
   └── mqtt
```

---

# 49. Componentes MVP

Primera versión frontend:

```text
AppShell
Sidebar
Topbar
PageHeader
Button
Card
Badge
Dialog
Input
Select
Tabs
DataTable
EmptyState
ErrorState
Skeleton

ProjectCard
ProjectSummary

DeviceCard
DeviceStatus
DeviceHeader

ChannelCard
SensorValue
SwitchControl
SliderControl
TelemetryChart

DocumentationSection
FileUploader
FileCard

EventList
CommandStatus
```

---

# 50. Pantallas MVP

```text
Login

Inicio

Proyectos
Crear proyecto
Detalle de proyecto

Documentación
Archivos / Evidencias

Dispositivos
Agregar dispositivo
Detalle de dispositivo

Canales
Crear canal

Dashboard de sensores
Históricos

Eventos
```

Automatizaciones pueden aparecer en una segunda etapa.

---

# 51. Estándar de experiencia de usuario

Toda acción importante debe responder visualmente.

Ejemplo:

```text
Crear proyecto
→ guardando
→ creado correctamente

Enviar comando
→ enviando
→ esperando confirmación
→ confirmado / fallido

Subir archivo
→ progreso
→ archivo guardado
```

---

# 52. Objetivo visual final

UDLAIoT debe sentirse como:

```text
plataforma universitaria
+
dashboard IoT profesional
+
herramienta de documentación
+
panel de control técnico
```

No como:

```text
videojuego
casa 3D
dashboard futurista exagerado
demo generada por IA
```

La información real y las fotografías de los equipos deben ser protagonistas.

---

# 54. Densidad compacta adoptada

Estas reglas sustituyen cualquier criterio anterior que produzca pantallas con tarjetas grandes o demasiado espacio vacío.

## Medidas principales

```text
Sidebar:                    220px a 240px
Opción de navegación:       42px a 46px de alto
Barra superior:             60px a 64px
Buscador:                   38px a 42px de alto
Padding general:            16px a 24px
Separación entre tarjetas:  12px a 16px
Separación entre secciones: 18px a 24px
Botón normal:               38px a 42px
Botón compacto:             32px a 36px
```

## Escala de texto de interfaz

```text
Texto pequeño:       12px
Texto secundario:    13px
Texto normal:        14px
Texto destacado:     16px
Título de sección:   18px a 20px
Título de página:    28px a 32px
```

Los números y datos son la información protagonista. Los botones, iconos y fondos de color no deben competir visualmente con ellos. Los iconos normales estarán entre 18px y 22px; los decorativos no superarán 28px salvo en un estado vacío.

## Dashboard operativo

En una pantalla de portátil estándar deben quedar visibles, sin desplazamiento excesivo:

```text
4 indicadores superiores
3 a 5 proyectos
4 a 6 sensores o actuadores destacados
4 a 6 alertas
4 acciones rápidas
```

Cada proyecto se presenta como una fila de entre 95px y 115px con nombre, descripción, estado, dispositivos, sensores, actuadores, integrantes, ubicaciones y actividad reciente. No se utilizará una tarjeta alta por cada proyecto en el dashboard.

Las lecturas destacadas deben provenir de telemetría real. Las minigráficas solo se dibujan cuando existen puntos históricos; no se inventan tendencias para completar el diseño.

## Orden responsive

```text
Escritorio: resumen, proyectos + columna lateral, sensores
Tablet:    resumen, proyectos, sensores, alertas, acciones
Móvil:     resumen, proyectos, sensores, alertas, acciones
```

## Componentes de dashboard

```text
DashboardSection
DashboardStatCard
ProjectSummaryRow
SensorMiniCard
ActuatorMiniCard
AlertList
QuickAction
StatusBadge
MiniTrendChart
DashboardSkeleton
```

El dashboard es un resumen operativo, no una portada comercial. Debe responder rápidamente cuántos recursos existen, cuáles están activos, qué proyecto requiere atención y cuáles son las últimas lecturas y alertas.

---

# 53. Referencia visual operativa

La interfaz seguirá un patrón de dashboard SaaS técnico:

- sidebar azul oscuro permanente en escritorio;
- azul para navegación activa, enlaces y acciones principales;
- verde únicamente para estados correctos, conectados o confirmados;
- fondo gris azulado claro y superficies blancas;
- cabecera con buscador, notificaciones y usuario;
- paneles compactos con bordes sutiles;
- KPIs, lecturas, eventos y controles visibles sin espacios excesivos;
- tablas para inventarios técnicos y pestañas para el detalle de dispositivo;
- navegación inferior o menú compacto en móvil.

## Contenido de producto

La interfaz visible pertenece al usuario final. No debe mostrar lenguaje interno del proceso de desarrollo, por ejemplo:

```text
primer hito
siguiente paso
base del proyecto
pendiente de implementar
próxima tarea técnica
```

Los textos deben describir información, estados o acciones reales del producto.

No se deben presentar servicios como disponibles sin una comprobación real. Los comandos de actuadores conservarán los estados `pendiente`, `enviado`, `confirmado`, `fallido` o `expirado`, y solo mostrarán éxito después del ACK.
