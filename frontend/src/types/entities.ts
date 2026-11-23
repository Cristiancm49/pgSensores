export type User = {
  id: string
  username: string
  full_name: string
  email: string | null
  active: boolean
  is_admin: boolean
  last_access: string | null
  created_at: string
}

export type Project = {
  id: string
  owner_id: string
  name: string
  description: string
  summary: string | null
  status: 'borrador' | 'activo' | 'finalizado' | 'archivado'
  cover_image_path: string | null
  created_at: string
  updated_at: string
}

export type ProjectMember = {
  user_id: string
  username: string
  full_name: string
  role_code: 'propietario' | 'editor' | 'visualizador'
  role_name: string
  added_at: string
}

export type Location = {
  id: string
  project_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type Device = {
  id: string
  project_id: string
  location_id: string | null
  name: string
  description: string | null
  board_type: string
  connection_type: 'mqtt_directo' | 'simulador'
  device_identifier: string
  status: 'conectado' | 'desconectado' | 'error' | 'inactivo'
  last_connection: string | null
  firmware_version: string | null
  configuration: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DeviceCredential = {
  id: string
  device_id: string
  username: string
  created_at: string
  revoked_at: string | null
}

export type IssuedDeviceCredential = DeviceCredential & {
  password: string
  client_id: string
  mqtt_host: string
  mqtt_port: number
  topic_base: string
  publish_topics: string[]
  subscribe_topics: string[]
}

export type DeviceMqttConfiguration = {
  client_id: string
  mqtt_host: string
  mqtt_port: number
  mqtt_websocket_port: number
  topic_base: string
  publish_topics: string[]
  subscribe_topics: string[]
  broker_connected: boolean
  temporary_credential: {
    session_id: string
    username: string
    client_id: string
    state: 'preparando' | 'ejecutando' | 'pausada'
  } | null
}

export type Channel = {
  id: string
  device_id: string
  key: string
  name: string
  description: string | null
  category: 'sensor' | 'actuador'
  data_type: 'booleano' | 'numero' | 'texto' | 'entero' | 'json'
  unit: string | null
  gpio: string | null
  writable: boolean
  widget_type: string
  minimum_value: number | null
  maximum_value: number | null
  configuration: Record<string, unknown>
  save_history: boolean
  save_interval_seconds: number
  save_only_if_changed: boolean
  minimum_change: number | null
  retention_days: number
  active: boolean
  created_at: string
  updated_at: string
}

export type ChannelState = {
  channel_id: string
  value: unknown
  received_at: string
  source_timestamp: string | null
}

export type TelemetryPoint = {
  id: number
  channel_id: string
  value: unknown
  recorded_at: string
  source_timestamp: string | null
}

export type DeviceCommand = {
  id: string
  device_id: string
  channel_id: string
  requested_by_id: string
  value: unknown
  status: 'pendiente' | 'enviado' | 'confirmado' | 'fallido' | 'expirado'
  error: string | null
  created_at: string
  sent_at: string | null
  confirmed_at: string | null
  expires_at: string
}

export type RealtimeEvent = {
  type: 'connected' | 'telemetry' | 'device_status' | 'command_status' | 'command_ack' | 'event'
  project_id?: string
  device_id?: string
  channel_id?: string
  command_id?: string
  status?: string
  value?: unknown
  error?: string | null
  event_id?: string
  event_type?: string
  severity?: EventSeverity
  message?: string
}

export type ProjectDocument = {
  id: string
  project_id: string
  title: string
  content: string
  order: number
  updated_by_id: string
  created_at: string
  updated_at: string
}

export type ProjectFile = {
  id: string
  project_id: string
  uploaded_by_id: string
  uploaded_by_name: string
  original_name: string
  mime_type: string
  size_bytes: number
  description: string | null
  created_at: string
}

export type TelemetryPage = {
  items: TelemetryPoint[]
  total: number
  page: number
  page_size: number
}

export type EventSeverity = 'info' | 'advertencia' | 'critica'

export type SystemEvent = {
  id: string
  project_id: string
  device_id: string | null
  channel_id: string | null
  event_type: string
  severity: EventSeverity
  message: string
  details: Record<string, unknown>
  created_at: string
}

export type EventPage = {
  items: SystemEvent[]
  total: number
  page: number
  page_size: number
}

export type SimulatorBoardProfile = {
  id: string
  name: string
  family: string
  digital_pins: number
  analog_pins: number
  connectivity: string[]
}

export type SimulatorStarterKit = {
  id: string
  name: string
  description: string
  sensor_count: number
  actuator_count: number
  component_ids: string[]
}

export type SimulatorComponent = {
  id: string
  key: string
  name: string
  category: 'sensor' | 'actuador'
  data_type: Channel['data_type']
  unit: string | null
  widget_type: string
  minimum_value?: number | null
  maximum_value?: number | null
}

export type SimulatorSession = {
  id: string
  project_id: string
  device_id: string
  created_by_id: string
  name: string
  board_profile: SimulatorBoardProfile['id']
  state: 'creada' | 'preparando' | 'ejecutando' | 'pausada' | 'detenida' | 'fallida'
  tick_ms: number
  seed: number
  configuration: Record<string, unknown>
  scenario: Record<string, unknown>
  last_error: string | null
  started_at: string | null
  stopped_at: string | null
  created_at: string
  updated_at: string
}

export type SimulatorLog = {
  timestamp: string
  level: string
  message: string
  data: Record<string, unknown>
}

export type SimulatorSnapshot = {
  session_id: string
  device_id: string
  state: SimulatorSession['state']
  connected: boolean
  elapsed_seconds: number
  messages_sent: number
  values: Record<string, unknown>
  actuators: Record<string, unknown>
  faults: {
    network_disconnected: boolean
    drop_ack: boolean
    latency_ms: number
    noise_multiplier: number
  }
  last_error: string | null
  logs: SimulatorLog[]
}

export type SimulatorRun = {
  id: string
  session_id: string | null
  project_id: string
  device_id: string
  created_by_id: string
  state: string
  scenario: Record<string, unknown>
  summary: {
    elapsed_seconds?: number
    messages_sent?: number
    last_error?: string | null
  }
  logs: SimulatorLog[]
  started_at: string
  finished_at: string | null
}
