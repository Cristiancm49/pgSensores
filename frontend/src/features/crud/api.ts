import { apiDownload, apiRequest, uploadWithProgress } from '../../services/api'
import type {
  Channel,
  ChannelState,
  Device,
  DeviceCommand,
  DeviceCredential,
  DeviceMqttConfiguration,
  EventPage,
  IssuedDeviceCredential,
  Location,
  Project,
  ProjectDocument,
  ProjectFile,
  ProjectMember,
  TelemetryPage,
  User,
  SimulatorBoardProfile,
  SimulatorComponent,
  SimulatorStarterKit,
  SimulatorSession,
  SimulatorSnapshot,
  SimulatorRun,
} from '../../types/entities'

export const usersApi = {
  me: () => apiRequest<User>('/api/users/me'),
  updateMe: (payload: Record<string, unknown>) =>
    apiRequest<User>('/api/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  list: () => apiRequest<User[]>('/api/users'),
  create: (payload: Record<string, unknown>) =>
    apiRequest<User>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    apiRequest<User>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
}

export const projectsApi = {
  list: () => apiRequest<Project[]>('/api/projects'),
  get: (id: string) => apiRequest<Project>(`/api/projects/${id}`),
  create: (payload: Record<string, unknown>) =>
    apiRequest<Project>('/api/projects', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archive: (id: string) => apiRequest<Project>(`/api/projects/${id}`, { method: 'DELETE' }),
  members: (id: string) => apiRequest<ProjectMember[]>(`/api/projects/${id}/members`),
  addMember: (id: string, payload: Record<string, unknown>) =>
    apiRequest<ProjectMember>(`/api/projects/${id}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMember: (id: string, userId: string, payload: Record<string, unknown>) =>
    apiRequest<ProjectMember>(`/api/projects/${id}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  removeMember: (id: string, userId: string) =>
    apiRequest<void>(`/api/projects/${id}/members/${userId}`, { method: 'DELETE' }),
  documents: (id: string) => apiRequest<ProjectDocument[]>(`/api/projects/${id}/documents`),
  createDocument: (id: string, payload: Record<string, unknown>) =>
    apiRequest<ProjectDocument>(`/api/projects/${id}/documents`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  updateDocument: (id: string, payload: Record<string, unknown>) =>
    apiRequest<ProjectDocument>(`/api/documents/${id}`, {
      method: 'PATCH', body: JSON.stringify(payload),
    }),
  reorderDocuments: (id: string, documentIds: string[]) =>
    apiRequest<ProjectDocument[]>(`/api/projects/${id}/documents/order`, {
      method: 'PUT', body: JSON.stringify({ document_ids: documentIds }),
    }),
  deleteDocument: (id: string) => apiRequest<void>(`/api/documents/${id}`, { method: 'DELETE' }),
  files: (id: string) => apiRequest<ProjectFile[]>(`/api/projects/${id}/files`),
  uploadFile: (id: string, data: FormData, onProgress: (percent: number) => void) =>
    uploadWithProgress<ProjectFile>(`/api/projects/${id}/files`, data, onProgress),
  downloadFile: (id: string) => apiDownload(`/api/files/${id}/download`),
  deleteFile: (id: string) => apiRequest<void>(`/api/files/${id}?confirm=true`, { method: 'DELETE' }),
}

export const locationsApi = {
  list: (projectId: string) =>
    apiRequest<Location[]>(`/api/projects/${projectId}/locations`),
  create: (projectId: string, payload: Record<string, unknown>) =>
    apiRequest<Location>(`/api/projects/${projectId}/locations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Location>(`/api/locations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => apiRequest<void>(`/api/locations/${id}`, { method: 'DELETE' }),
}

export const devicesApi = {
  list: (projectId: string) => apiRequest<Device[]>(`/api/projects/${projectId}/devices`),
  get: (id: string) => apiRequest<Device>(`/api/devices/${id}`),
  create: (projectId: string, payload: Record<string, unknown>) =>
    apiRequest<Device>(`/api/projects/${projectId}/devices`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Device>(`/api/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deactivate: (id: string) => apiRequest<Device>(`/api/devices/${id}`, { method: 'DELETE' }),
  credentials: (id: string) =>
    apiRequest<DeviceCredential[]>(`/api/devices/${id}/credentials`),
  mqttConfiguration: (id: string) =>
    apiRequest<DeviceMqttConfiguration>(`/api/devices/${id}/mqtt-configuration`),
  createCredential: (id: string) =>
    apiRequest<IssuedDeviceCredential>(`/api/devices/${id}/credentials`, { method: 'POST' }),
  rotateCredential: (id: string) =>
    apiRequest<IssuedDeviceCredential>(`/api/devices/${id}/credentials/rotate`, { method: 'POST' }),
  revokeCredential: (id: string) =>
    apiRequest<DeviceCredential>(`/api/device-credentials/${id}`, { method: 'DELETE' }),
  channels: (id: string, category?: 'sensor' | 'actuador') =>
    apiRequest<Channel[]>(`/api/devices/${id}/channels${category ? `?category=${category}` : ''}`),
  createChannel: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Channel>(`/api/devices/${id}/channels`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateChannel: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Channel>(`/api/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deactivateChannel: (id: string) =>
    apiRequest<Channel>(`/api/channels/${id}`, { method: 'DELETE' }),
  // A channel without a first reading is an expected empty state. Its callers
  // already render that state locally, so it must not become a global alert.
  state: (channelId: string) => apiRequest<ChannelState>(`/api/channels/${channelId}/state`, undefined, true, true),
  telemetry: (channelId: string, params: { page?: number; page_size?: number; from_date?: string; to_date?: string } = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value))
    })
    return apiRequest<TelemetryPage>(`/api/channels/${channelId}/telemetry?${query.toString()}`)
  },
  sendCommand: (channelId: string, value: unknown) =>
    apiRequest<DeviceCommand>(`/api/channels/${channelId}/commands`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    }),
  command: (commandId: string) => apiRequest<DeviceCommand>(`/api/commands/${commandId}`),
  commands: (deviceId: string) =>
    apiRequest<DeviceCommand[]>(`/api/devices/${deviceId}/commands`),
  uploadImage: (id: string, data: FormData, onProgress: (percent: number) => void) =>
    uploadWithProgress<{ status: string }>(`/api/devices/${id}/image`, data, onProgress),
  image: (id: string) => apiDownload(`/api/devices/${id}/image`, true, true),
  uploadChannelImage: (id: string, data: FormData, onProgress: (percent: number) => void) =>
    uploadWithProgress<{ status: string }>(`/api/channels/${id}/image`, data, onProgress),
  channelImage: (id: string) => apiDownload(`/api/channels/${id}/image`, true, true),
}

export const eventsApi = {
  list: (params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value))
    })
    return apiRequest<EventPage>(`/api/events?${query.toString()}`)
  },
}

export const simulatorApi = {
  profiles: () => apiRequest<SimulatorBoardProfile[]>('/api/simulator/profiles'),
  kits: () => apiRequest<SimulatorStarterKit[]>('/api/simulator/kits'),
  components: () => apiRequest<SimulatorComponent[]>('/api/simulator/components'),
  sessions: () => apiRequest<SimulatorSession[]>('/api/simulator/sessions'),
  create: (payload: Record<string, unknown>) => apiRequest<SimulatorSession>(
    '/api/simulator/sessions',
    { method: 'POST', body: JSON.stringify(payload) },
  ),
  createLaboratory: (payload: Record<string, unknown>) => apiRequest<SimulatorSession>(
    '/api/simulator/laboratories',
    { method: 'POST', body: JSON.stringify(payload) },
  ),
  update: (id: string, payload: Record<string, unknown>) => apiRequest<SimulatorSession>(
    `/api/simulator/sessions/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  ),
  remove: (id: string) => apiRequest<void>(`/api/simulator/sessions/${id}`, { method: 'DELETE' }),
  status: (id: string) => apiRequest<SimulatorSnapshot>(`/api/simulator/sessions/${id}/status`),
  action: (id: string, action: 'start' | 'pause' | 'resume' | 'reset' | 'stop') => apiRequest<SimulatorSnapshot>(
    `/api/simulator/sessions/${id}/${action}`,
    { method: 'POST' },
  ),
  inputs: (id: string, values: Record<string, unknown>) => apiRequest<SimulatorSnapshot>(
    `/api/simulator/sessions/${id}/inputs`,
    { method: 'POST', body: JSON.stringify({ values }) },
  ),
  faults: (id: string, faults: Record<string, unknown>) => apiRequest<SimulatorSnapshot>(
    `/api/simulator/sessions/${id}/faults`,
    { method: 'POST', body: JSON.stringify(faults) },
  ),
  runs: () => apiRequest<SimulatorRun[]>('/api/simulator/runs'),
  compareRuns: (ids: string[]) => apiRequest<{
    metrics: Record<string, Record<string, number>>
  }>(`/api/simulator/runs/compare?${ids.map((id) => `ids=${encodeURIComponent(id)}`).join('&')}`),
  importScenario: (id: string, content: string, format: 'json' | 'yaml') => apiRequest<SimulatorSession>(
    `/api/simulator/sessions/${id}/scenario/import?format=${format}`,
    { method: 'POST', body: content, headers: { 'Content-Type': 'text/plain' } },
  ),
  exportScenario: (id: string, format: 'json' | 'yaml') => apiDownload(
    `/api/simulator/sessions/${id}/scenario/export?format=${format}`,
  ),
}
