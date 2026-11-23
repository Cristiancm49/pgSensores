import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, AlertTriangle, Bot, Code2, Cpu, FileDown, FlaskConical, History, Pause, Play, Plus,
  RefreshCw, RotateCcw, SlidersHorizontal, Square, Terminal, Trash2, Upload, X,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import { Button } from '../components/common/Button'
import { Dialog } from '../components/common/Dialog'
import { InputField, SelectField } from '../components/common/FormField'
import { AppShell } from '../components/layout/AppShell'
import { simulatorApi } from '../features/crud/api'
import { InventoryEmpty, InventoryHeader, Pagination } from '../features/inventory/InventoryUi'
import { usePortfolioInventory } from '../features/inventory/usePortfolioInventory'
import type { Channel, SimulatorSession, SimulatorSnapshot } from '../types/entities'

const activeStates = new Set(['preparando', 'ejecutando', 'pausada'])
type CreationMode = 'virtual' | 'existing'

export function SimulatorPage() {
  const client = useQueryClient()
  const inventory = usePortfolioInventory()
  const sessions = useQuery({ queryKey: ['simulator', 'sessions'], queryFn: simulatorApi.sessions })
  const profiles = useQuery({ queryKey: ['simulator', 'profiles'], queryFn: simulatorApi.profiles })
  const kits = useQuery({ queryKey: ['simulator', 'kits'], queryFn: simulatorApi.kits })
  const components = useQuery({ queryKey: ['simulator', 'components'], queryFn: simulatorApi.components })
  const runs = useQuery({ queryKey: ['simulator', 'runs'], queryFn: simulatorApi.runs })
  const [createOpen, setCreateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedRuns, setSelectedRuns] = useState<string[]>([])
  const [comparison, setComparison] = useState<Record<string, Record<string, number>> | null>(null)
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedDevice, setSelectedDevice] = useState('')
  const [creationMode, setCreationMode] = useState<CreationMode>('virtual')
  const [selectedProfile, setSelectedProfile] = useState('esp32_devkit')
  const [selectedKit, setSelectedKit] = useState('environmental')
  const [selectedComponents, setSelectedComponents] = useState<string[]>(['temperatura', 'humedad', 'luz', 'ventilador', 'led'])
  const [virtualDeviceName, setVirtualDeviceName] = useState('')
  const [firmwareLanguage, setFirmwareLanguage] = useState('arduino')
  const [firmwareCode, setFirmwareCode] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [error, setError] = useState('')
  const [scenarioText, setScenarioText] = useState('{\n  "name": "Escenario",\n  "steps": []\n}')
  const sessionList = sessions.data ?? []
  const statusQueries = useQueries({
    queries: sessionList.map((session) => ({
      queryKey: ['simulator', 'status', session.id],
      queryFn: () => simulatorApi.status(session.id),
      enabled: activeStates.has(session.state),
      refetchInterval: activeStates.has(session.state) ? 1_000 : false,
    })),
  })
  const snapshots = new Map(
    sessionList.map((session, index) => [session.id, statusQueries[index]?.data]),
  )
  const pageItems = sessionList.slice((page - 1) * pageSize, page * pageSize)
  const projectsWithDevices = inventory.projects.filter((project) => inventory.devices.some((device) => device.project_id === project.id))
  const devicesForProject = inventory.devices.filter((device) => device.project_id === selectedProject)
  const selectedProfileInfo = profiles.data?.find((profile) => profile.id === selectedProfile)
  const selectedKitInfo = kits.data?.find((kit) => kit.id === selectedKit)
  const selectedComponentItems = components.data?.filter((component) => selectedComponents.includes(component.id)) ?? []
  const selectedSensorCount = selectedComponentItems.filter((component) => component.category === 'sensor').length
  const selectedActuatorCount = selectedComponentItems.filter((component) => component.category === 'actuador').length

  const refresh = async () => {
    await Promise.all([sessions.refetch(), inventory.refetch()])
  }
  const invalidate = async (id?: string) => {
    await client.invalidateQueries({ queryKey: ['simulator'] })
    if (id) await client.invalidateQueries({ queryKey: ['simulator', 'status', id] })
  }
  const createSession = useMutation({
    mutationFn: ({ mode, payload }: { mode: CreationMode; payload: Record<string, unknown> }) => mode === 'virtual' ? simulatorApi.createLaboratory(payload) : simulatorApi.create(payload),
    onSuccess: async () => { setCreateOpen(false); setError(''); await Promise.all([invalidate(), inventory.refetch()]) },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'No fue posible crear la sesión'),
  })
  const action = useMutation({
    mutationFn: ({ id, name }: { id: string; name: 'start' | 'pause' | 'resume' | 'reset' | 'stop' }) => simulatorApi.action(id, name),
    onSettled: async (_, __, variables) => invalidate(variables.id),
  })
  const remove = useMutation({
    mutationFn: simulatorApi.remove,
    onSuccess: async () => invalidate(),
  })
  const inputs = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) => simulatorApi.inputs(id, values),
    onSuccess: async (_, variables) => invalidate(variables.id),
  })
  const faults = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) => simulatorApi.faults(id, values),
    onSuccess: async (_, variables) => invalidate(variables.id),
  })
  const importScenario = useMutation({
    mutationFn: ({ id, content, format }: { id: string; content: string; format: 'json' | 'yaml' }) => simulatorApi.importScenario(id, content, format),
    onSuccess: async () => invalidate(),
  })
  const compareRuns = useMutation({
    mutationFn: simulatorApi.compareRuns,
    onSuccess: (result) => setComparison(result.metrics),
  })

  function openCreate() {
    const project = inventory.projects[0]
    setCreationMode('virtual')
    setSelectedProject(project?.id ?? '')
    setSelectedDevice(inventory.devices.find((device) => device.project_id === project?.id)?.id ?? '')
    setSelectedProfile('esp32_devkit')
    setSelectedKit('environmental')
    setSelectedComponents(kits.data?.find((kit) => kit.id === 'environmental')?.component_ids ?? ['temperatura', 'humedad', 'luz', 'ventilador', 'led'])
    setVirtualDeviceName('ESP32 virtual')
    setFirmwareLanguage(languageForProfile('esp32_devkit', profiles.data ?? []))
    setFirmwareCode('')
    setError('')
    setScenarioText('{\n  "name": "Escenario",\n  "steps": []\n}')
    setCreateOpen(true)
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const deviceId = String(data.get('device_id'))
    let scenario: Record<string, unknown>
    try {
      scenario = JSON.parse(scenarioText) as Record<string, unknown>
    } catch {
      setError('El escenario JSON no es válido')
      return
    }
    createSession.mutate({
      mode: creationMode,
      payload: {
        project_id: data.get('project_id'),
        ...(creationMode === 'virtual' ? {
          device_name: data.get('device_name'),
          starter_kit: data.get('starter_kit'),
          components: selectedComponents,
          firmware_language: firmwareLanguage,
          firmware_code: firmwareCode,
        } : { device_id: deviceId }),
        name: data.get('name'),
        board_profile: data.get('board_profile'),
        tick_ms: Number(data.get('tick_seconds')) * 1000,
        seed: Number(data.get('seed')),
        configuration: { firmware_language: firmwareLanguage, firmware_code: firmwareCode },
        scenario,
      },
    })
  }

  return <AppShell><div className="mx-auto max-w-[1460px]">
    <InventoryHeader
      actions={<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Button className="justify-center whitespace-nowrap" onClick={() => setHistoryOpen(true)} variant="secondary"><History size={15} />Historial</Button><Button className="justify-center whitespace-nowrap" onClick={refresh} variant="secondary"><RefreshCw size={15} />Actualizar</Button><Button className="col-span-2 justify-center whitespace-nowrap sm:col-auto" disabled={!inventory.projects.length} onClick={openCreate}><Plus size={16} />Nueva simulación</Button></div>}
      description="Ejecuta dispositivos virtuales, modifica sensores e inyecta fallos usando los mismos contratos MQTT de producción."
      title="Simulador IoT"
    />

    <section className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#e5e7eb] shadow-[0_1px_2px_rgba(16,24,40,.03)] sm:grid-cols-4">
      <Summary icon={Bot} label="Sesiones" value={sessionList.length} />
      <Summary icon={Activity} label="En ejecución" tone="green" value={sessionList.filter((item) => item.state === 'ejecutando').length} />
      <Summary icon={FlaskConical} label="Perfiles disponibles" tone="purple" value={profiles.data?.length ?? 0} />
      <Summary icon={History} label="Ejecuciones guardadas" value={runs.data?.length ?? 0} />
    </section>

    {sessions.isLoading || inventory.loadingChannels ? <div className="mt-4 h-72 animate-pulse rounded-xl border border-[#e5e7eb] bg-white" /> : pageItems.length ? <div className="mt-3 space-y-2">
      {pageItems.map((session) => <SessionCard
        channels={inventory.channels.filter((channel) => channel.device_id === session.device_id)}
        deviceName={inventory.deviceById.get(session.device_id)?.name ?? 'Dispositivo'}
        key={session.id}
        onAction={(name) => action.mutate({ id: session.id, name })}
        onFaults={(values) => faults.mutate({ id: session.id, values })}
        onInputs={(values) => inputs.mutate({ id: session.id, values })}
        onImportScenario={(content, format) => importScenario.mutate({ id: session.id, content, format })}
        onRemove={() => confirm('¿Eliminar esta sesión de simulación?') && remove.mutate(session.id)}
        pending={action.isPending || inputs.isPending || faults.isPending || remove.isPending}
        profileName={profiles.data?.find((profile) => profile.id === session.board_profile)?.name ?? session.board_profile}
        projectName={inventory.projectById.get(session.project_id)?.name ?? 'Proyecto'}
        session={session}
        snapshot={snapshots.get(session.id)}
      />)}
      {sessionList.length > pageSize && <div className="overflow-hidden rounded-xl border border-[#e5e7eb]"><Pagination label="sesiones" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} page={page} pageSize={pageSize} total={sessionList.length} /></div>}
    </div> : <div className="mt-4"><InventoryEmpty><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-[#eaf3ff] text-[#1677ff]"><Bot size={22} /></span><h2 className="mt-3 font-semibold text-[#344054]">Todavía no hay simulaciones</h2><p className="mt-1 text-xs">Crea un equipo virtual o usa un dispositivo que tenga al menos un sensor activo.</p><Button className="mt-4" disabled={!inventory.projects.length} onClick={openCreate}><Plus size={15} />Crear primera simulación</Button></div></InventoryEmpty></div>}

    <Dialog onClose={() => setCreateOpen(false)} open={createOpen} size="xl" title="Nueva simulación">
      <form className="space-y-4" onSubmit={submitCreate}>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#eef3f8] p-1" role="tablist" aria-label="Origen del dispositivo">
          <button aria-selected={creationMode === 'virtual'} className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition ${creationMode === 'virtual' ? 'bg-white text-[#0b6ffb] shadow-sm' : 'text-[#617184] hover:text-[#102033]'}`} onClick={() => setCreationMode('virtual')} role="tab" type="button"><Plus className="mr-1.5 inline" size={14} />Crear equipo virtual</button>
          <button aria-selected={creationMode === 'existing'} className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition ${creationMode === 'existing' ? 'bg-white text-[#0b6ffb] shadow-sm' : 'text-[#617184] hover:text-[#102033]'}`} onClick={() => { const project = projectsWithDevices[0]; setCreationMode('existing'); setSelectedProject(project?.id ?? ''); const device = inventory.devices.find((item) => item.project_id === project?.id); setSelectedDevice(device?.id ?? ''); setSelectedProfile(inferProfileId(device?.board_type, profiles.data?.map((item) => item.id) ?? [])) }} role="tab" type="button"><Cpu className="mr-1.5 inline" size={14} />Usar equipo existente</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Nombre de la sesión" name="name" placeholder="Prueba de invernadero" required />
          <SelectField label="Proyecto" name="project_id" onChange={(event) => { const projectId = event.target.value; setSelectedProject(projectId); const device = inventory.devices.find((item) => item.project_id === projectId); setSelectedDevice(device?.id ?? ''); if (creationMode === 'existing') setSelectedProfile(inferProfileId(device?.board_type, profiles.data?.map((item) => item.id) ?? [])) }} required value={selectedProject}>
            {(creationMode === 'virtual' ? inventory.projects : projectsWithDevices).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </SelectField>
        </div>

        {creationMode === 'virtual' ? <div className="space-y-4 rounded-xl border border-[#cfe1f7] bg-[#f8fbff] p-3.5 sm:p-4">
          <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf3ff] text-[#0b6ffb]"><Bot size={18} /></span><div><h3 className="text-sm font-semibold text-[#102033]">Configura tu equipo virtual</h3><p className="mt-0.5 text-[11px] text-[#617184]">El sistema creará el dispositivo, sus canales y la sesión en un solo paso.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <InputField label="Nombre del equipo" name="device_name" onChange={(event) => setVirtualDeviceName(event.target.value)} placeholder="ESP32 del laboratorio" required value={virtualDeviceName} />
            <SelectField label="Placa o equipo" name="board_profile" onChange={(event) => { const profileId = event.target.value; setSelectedProfile(profileId); setFirmwareLanguage(languageForProfile(profileId, profiles.data ?? [])) }} required value={selectedProfile}>{profiles.data?.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</SelectField>
            <SelectField label="Kit inicial" name="starter_kit" onChange={(event) => { const kitId = event.target.value; setSelectedKit(kitId); setSelectedComponents(kits.data?.find((kit) => kit.id === kitId)?.component_ids ?? []) }} required value={selectedKit}>{kits.data?.map((kit) => <option key={kit.id} value={kit.id}>{kit.name}</option>)}</SelectField>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center rounded-lg border border-[#dce7f3] bg-white px-3 py-2.5">
            <div className="min-w-0"><p className="text-xs font-semibold text-[#34465a]">{selectedProfileInfo?.name ?? 'Selecciona una placa'} · {selectedKitInfo?.name ?? 'Kit inicial'}</p><p className="mt-0.5 text-[10px] text-[#617184]">{selectedKitInfo?.description}</p></div>
            <div className="flex flex-wrap gap-1.5 text-[10px]"><span className="rounded-full bg-[#eaf3ff] px-2 py-1 font-semibold text-[#0b6ffb]">{selectedSensorCount} sensores</span><span className="rounded-full bg-[#f2edff] px-2 py-1 font-semibold text-[#7c3aed]">{selectedActuatorCount} actuadores</span><span className="rounded-full bg-[#e9f8ef] px-2 py-1 font-semibold text-[#15803d]">MQTT listo</span></div>
          </div>
          <div className="rounded-lg border border-[#dce7f3] bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[#34465a]">Sensores y actuadores</p><p className="text-[10px] text-[#617184]">El kit es un preset; puedes personalizarlo antes de crear el equipo.</p></div><span className="shrink-0 text-[10px] font-semibold text-[#0b6ffb]">{selectedComponents.length} seleccionados</span></div>
            <div className="grid max-h-44 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">{components.data?.map((component) => <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition ${selectedComponents.includes(component.id) ? 'border-[#9bc7ff] bg-[#f2f8ff]' : 'border-[#e5eaf0] hover:bg-[#f8fafc]'}`} key={component.id}><input checked={selectedComponents.includes(component.id)} className="size-4 accent-[#0b6ffb]" onChange={(event) => setSelectedComponents((current) => event.target.checked ? [...current, component.id] : current.filter((id) => id !== component.id))} type="checkbox" /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-[#34465a]">{component.name}</span><span className="block text-[9px] capitalize text-[#8795a5]">{component.category}{component.unit ? ` · ${component.unit}` : ''}</span></span></label>)}</div>
            {selectedSensorCount === 0 && <p className="mt-2 text-[10px] font-medium text-[#b45309]">Selecciona al menos un sensor para poder iniciar la simulación.</p>}
          </div>
        </div> : <div className="grid gap-4 rounded-xl border border-[#e1e7ee] bg-[#f8fafc] p-3.5 sm:grid-cols-2 sm:p-4">
          <SelectField label="Dispositivo registrado" name="device_id" onChange={(event) => { const device = inventory.deviceById.get(event.target.value); setSelectedDevice(event.target.value); setSelectedProfile(inferProfileId(device?.board_type, profiles.data?.map((item) => item.id) ?? [])) }} required value={selectedDevice}>{devicesForProject.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</SelectField>
          <SelectField label="Perfil de simulación" name="board_profile" onChange={(event) => setSelectedProfile(event.target.value)} value={selectedProfile}>{profiles.data?.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</SelectField>
          {!devicesForProject.length && <p className="text-xs text-[#b45309] sm:col-span-2">Este proyecto todavía no tiene dispositivos registrados.</p>}
        </div>}

        <details className="rounded-xl border border-[#dce3ea] bg-white">
          <summary className="cursor-pointer px-3.5 py-3 text-xs font-semibold text-[#34465a]">Código, configuración avanzada y escenario</summary>
          <div className="space-y-4 border-t border-[#e8edf2] p-3.5">
            <div className="rounded-lg border border-[#dce3ea] bg-[#f8fafc] p-3"><div className="mb-3 flex items-start gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eaf3ff] text-[#0b6ffb]"><Code2 size={15} /></span><div><p className="text-xs font-semibold text-[#34465a]">Código del dispositivo</p><p className="text-[10px] leading-4 text-[#617184]">Se guarda junto al laboratorio para documentar y preparar el firmware. El simulador MQTT todavía no ejecuta este código.</p></div></div><SelectField label="Lenguaje" onChange={(event) => setFirmwareLanguage(event.target.value)} value={firmwareLanguage}><option value="arduino">Arduino C/C++</option><option value="micropython">MicroPython</option><option value="python">Python</option><option value="cpp">C++</option><option value="none">Sin código</option></SelectField><label className="mt-3 block text-[13px] font-semibold text-[#34465a]">Editor de código<textarea className="mt-1.5 h-40 w-full resize-y rounded-[10px] border border-[#c7d2de] bg-[#071a2b] p-3 font-mono text-[11px] leading-5 text-[#dce8f5] outline-none placeholder:text-[#7f93a8] focus:border-[#0b6ffb]" onChange={(event) => setFirmwareCode(event.target.value)} placeholder={firmwarePlaceholder(firmwareLanguage)} spellCheck={false} value={firmwareCode} /></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><InputField defaultValue="2" label="Intervalo de telemetría (s)" max="60" min="0.25" name="tick_seconds" step="0.25" type="number" required /><InputField defaultValue="42" label="Semilla reproducible" min="0" name="seed" type="number" required /></div>
            <label className="block text-xs font-medium text-[#344054]">Editor de escenario JSON<textarea className="mt-1 h-32 w-full resize-y rounded-lg border border-[#d0d5dd] bg-[#fbfcfe] p-3 font-mono text-[11px] leading-5 outline-none focus:border-[#1677ff]" onChange={(event) => setScenarioText(event.target.value)} spellCheck={false} value={scenarioText} /><span className="mt-1 block font-normal text-[#667085]">Acciones: set, ramp, sequence y fault; cada paso usa at_seconds.</span></label>
          </div>
        </details>

        <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2.5 text-[11px] leading-5 text-[#1d4f91]">Las credenciales MQTT son temporales y se revocan al detener la sesión. Los equipos virtuales quedan guardados en el proyecto para reutilizarlos.</div>
        {error && <p className="text-sm text-[#b42318]">{error}</p>}
        <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t border-[#e5e7eb] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5"><Button onClick={() => setCreateOpen(false)} type="button" variant="secondary">Cancelar</Button><Button disabled={createSession.isPending || !selectedProject || (creationMode === 'existing' ? !selectedDevice : !virtualDeviceName.trim() || selectedSensorCount === 0)} type="submit">{createSession.isPending ? 'Creando laboratorio…' : creationMode === 'virtual' ? 'Crear laboratorio' : 'Crear sesión'}</Button></div>
      </form>
    </Dialog>
    <Dialog onClose={() => setHistoryOpen(false)} open={historyOpen} title="Historial y comparación">
      <div className="mb-3 flex items-center justify-between gap-3"><p className="text-[11px] text-[#667085]">Selecciona entre 2 y 5 ejecuciones.</p><Button className="h-8" disabled={selectedRuns.length < 2 || compareRuns.isPending} onClick={() => compareRuns.mutate(selectedRuns)} variant="secondary">Comparar</Button></div>
      {comparison && <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3 text-xs text-[#1d4f91]"><span>Tiempo: {Object.values(comparison.elapsed_seconds ?? {}).join(' / ')} s</span><span>Mensajes: {Object.values(comparison.messages_sent ?? {}).join(' / ')}</span></div>}
      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">{runs.data?.length ? runs.data.map((run) => <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e5e7eb] p-3" key={run.id}><input checked={selectedRuns.includes(run.id)} className="mt-0.5" onChange={(event) => { setComparison(null); setSelectedRuns((current) => event.target.checked ? [...current, run.id].slice(-5) : current.filter((id) => id !== run.id)) }} type="checkbox" /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[#344054]">{inventory.deviceById.get(run.device_id)?.name ?? String(run.scenario.name ?? 'Dispositivo eliminado')}</span><span className="rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[10px] text-[#667085]">{run.state}</span></span><span className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-[#667085]"><span>{new Date(run.started_at).toLocaleString('es-CO')}</span><span>{Math.round(run.summary.elapsed_seconds ?? 0)} s</span><span>{run.summary.messages_sent ?? 0} mensajes</span></span></span></label>) : <p className="py-8 text-center text-xs text-[#667085]">Aún no hay ejecuciones guardadas.</p>}</div>
    </Dialog>
  </div></AppShell>
}

function Summary({ icon: Icon, label, value, tone = 'blue' }: { icon: typeof Bot; label: string; value: number; tone?: 'blue' | 'green' | 'purple' }) {
  const colors = { blue: 'bg-[#eaf3ff] text-[#1677ff]', green: 'bg-[#e9f8ef] text-[#16a34a]', purple: 'bg-[#f2edff] text-[#7c3aed]' }
  return <article className="flex min-h-12 items-center gap-2.5 bg-white px-3 py-2"><span className={`grid size-7 place-items-center rounded-lg ${colors[tone]}`}><Icon size={14} /></span><p className="text-xs text-[#667085]">{label}</p><p className="ml-auto text-base font-bold tabular-nums text-[#111827]">{value}</p></article>
}

function inferProfileId(boardType: string | undefined, available: string[]) {
  const text = (boardType ?? '').toLowerCase()
  const candidates: Array<[string, string[]]> = [
    ['arduino_mega', ['mega']], ['arduino_nano', ['nano']], ['arduino_leonardo', ['leonardo']],
    ['arduino_uno', ['arduino', 'uno']], ['esp32_s3', ['esp32-s3', 'esp32 s3']],
    ['esp32_c3', ['esp32-c3', 'esp32 c3']], ['esp8266', ['esp8266', 'nodemcu']],
    ['esp32_devkit', ['esp32']], ['raspberry_pico_w', ['pico w']], ['raspberry_pico', ['pico']],
    ['raspberry_pi_zero', ['pi zero']], ['raspberry_pi_4', ['pi 4']], ['raspberry_pi_3', ['pi 3']],
  ]
  return candidates.find(([id, terms]) => available.includes(id) && terms.some((term) => text.includes(term)))?.[0]
    ?? (available.includes('generic_mqtt') ? 'generic_mqtt' : available[0] ?? 'esp32_devkit')
}

function languageForProfile(profileId: string, profiles: Array<{ id: string; family: string }>) {
  const family = profiles.find((profile) => profile.id === profileId)?.family
  if (family === 'avr') return 'arduino'
  if (family === 'esp32' || family === 'esp' || family === 'rp2040') return 'micropython'
  if (family === 'raspberry_linux') return 'python'
  return 'none'
}

function firmwarePlaceholder(language: string) {
  if (language === 'arduino' || language === 'cpp') return '// setup(), loop() y control de tus sensores\n'
  if (language === 'micropython') return '# Código MicroPython del dispositivo\n'
  if (language === 'python') return '# Servicio Python para GPIO y MQTT\n'
  return 'Selecciona un lenguaje para guardar código con el laboratorio.'
}

function SessionCard({ session, snapshot, projectName, deviceName, profileName, channels, pending, onAction, onInputs, onFaults, onImportScenario, onRemove }: { session: SimulatorSession; snapshot?: SimulatorSnapshot; projectName: string; deviceName: string; profileName: string; channels: Channel[]; pending: boolean; onAction: (name: 'start' | 'pause' | 'resume' | 'reset' | 'stop') => void; onInputs: (values: Record<string, unknown>) => void; onFaults: (values: Record<string, unknown>) => void; onImportScenario: (content: string, format: 'json' | 'yaml') => void; onRemove: () => void }) {
  const [labOpen, setLabOpen] = useState(false)
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const state = snapshot?.state ?? session.state
  const stateStyle = state === 'ejecutando' ? 'bg-[#e9f8ef] text-[#15803d]' : state === 'pausada' ? 'bg-[#fff4e5] text-[#9a5b13]' : state === 'preparando' ? 'bg-[#eaf3ff] text-[#0f63d8]' : state === 'fallida' ? 'bg-[#feecec] text-[#b42318]' : 'bg-[#f2f4f7] text-[#667085]'
  const rawError = snapshot?.last_error || session.last_error
  const userFacingError = rawError && /backend/i.test(rawError) ? 'El sistema se reinició y la simulación se detuvo.' : rawError
  const showError = Boolean(userFacingError && rawError !== dismissedError)
  const elapsedSeconds = Math.max(0, Math.round(snapshot?.elapsed_seconds ?? 0))
  const messages = snapshot?.messages_sent ?? 0
  const messageRate = state === 'ejecutando' ? messages / Math.max(snapshot?.elapsed_seconds ?? 0, 1) : undefined
  const connected = snapshot?.connected ?? false

  function requestAction(name: 'start' | 'pause' | 'resume' | 'reset' | 'stop') {
    if (name === 'start' || name === 'resume') setDismissedError(rawError ?? null)
    onAction(name)
  }

  async function downloadScenario() {
    const blob = await simulatorApi.exportScenario(session.id, 'json')
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${session.name.replace(/[^a-z0-9-]+/gi, '-')}.scenario.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!labOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLabOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [labOpen])

  return <>
    <article className="overflow-hidden rounded-xl border border-[#e1e6ec] bg-white shadow-[0_1px_4px_rgba(16,24,40,.05)]">
      {activeStates.has(state) && <div aria-hidden="true" className="simulator-live-bar" data-state={state}><span /></div>}
      <header className="flex flex-col gap-2.5 p-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-[#eaf3ff] text-[#1677ff]"><Cpu size={17} /></span><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><h2 className="truncate text-[15px] font-semibold tracking-[-.01em] text-[#111827]">{session.name}</h2><span aria-live="polite" className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize ${stateStyle}`}><span className="size-1.5 rounded-full bg-current" />{state}</span></div><p className="mt-0.5 truncate text-[10px] text-[#667085]">{projectName} <span aria-hidden="true">›</span> {deviceName} <span aria-hidden="true">›</span> {profileName}</p></div></div>
        <div className={`grid w-full gap-1.5 ${activeStates.has(state) ? 'grid-cols-4' : 'grid-cols-5'} lg:flex lg:w-auto lg:flex-nowrap`}>
          {['creada', 'detenida', 'fallida'].includes(state) && <Button aria-label="Iniciar simulación" className="h-9 min-h-9 px-2.5 text-[11px]" disabled={pending} onClick={() => requestAction('start')} title="Iniciar simulación"><Play size={14} /><span className="hidden sm:inline">Iniciar</span></Button>}
          {state === 'ejecutando' && <Button aria-label="Pausar simulación" className="h-9 min-h-9 px-2.5 text-[11px]" disabled={pending} onClick={() => requestAction('pause')} title="Pausar simulación" variant="secondary"><Pause size={14} /><span className="hidden sm:inline">Pausar</span></Button>}
          {state === 'pausada' && <Button aria-label="Reanudar simulación" className="h-9 min-h-9 px-2.5 text-[11px]" disabled={pending} onClick={() => requestAction('resume')} title="Reanudar simulación"><Play size={14} /><span className="hidden sm:inline">Reanudar</span></Button>}
          {activeStates.has(state) && <><Button aria-label="Reiniciar simulación" className="h-9 min-h-9 px-2.5 text-[11px]" disabled={pending} onClick={() => requestAction('reset')} title="Reinicia los valores y el tiempo de esta sesión" variant="secondary"><RotateCcw size={14} /><span className="hidden sm:inline">Reiniciar</span></Button><Button aria-label="Detener simulación" className="h-9 min-h-9 px-2.5 text-[11px]" disabled={pending} onClick={() => requestAction('stop')} title="Detener simulación" variant="dangerOutline"><Square size={12} /><span className="hidden sm:inline">Detener</span></Button></>}
          <Button aria-label="Abrir laboratorio" className="h-9 min-h-9 px-2.5 text-[11px]" onClick={() => setLabOpen(true)} title="Abrir laboratorio" variant="ghost"><SlidersHorizontal size={14} /><span className="hidden sm:inline">Laboratorio</span></Button>
          {!activeStates.has(state) && <><label aria-label="Importar escenario" className="inline-flex h-9 min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-semibold text-[#475467] transition hover:bg-[#f2f4f7]" title="Importar escenario"><Upload size={14} /><span className="hidden sm:inline">Importar</span><input accept=".json,.yaml,.yml" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; onImportScenario(await file.text(), file.name.endsWith('.json') ? 'json' : 'yaml'); event.target.value = '' }} type="file" /></label><Button aria-label="Exportar escenario" className="size-9 min-h-9 px-0" onClick={downloadScenario} title="Exportar escenario" variant="ghost"><FileDown size={15} /></Button></>}
          {!activeStates.has(state) && <Button aria-label="Eliminar sesión" className="size-9 min-h-9 px-0" disabled={pending} onClick={onRemove} title="Eliminar sesión" variant="ghost"><Trash2 size={15} /></Button>}
        </div>
      </header>
      <div className="grid grid-cols-4 gap-px border-t border-[#e8eaee] bg-[#e8eaee]">
        <SessionMetric label="Conexión"><span className={`size-2 rounded-full ${connected ? 'bg-[#16a34a] shadow-[0_0_0_4px_rgba(22,163,74,.12)]' : 'bg-[#a8b0bb]'}`} />{connected ? 'En línea' : 'Fuera de línea'}</SessionMetric>
        <SessionMetric label="Tiempo"><span className="tabular-nums">{formatDuration(elapsedSeconds)}</span></SessionMetric>
        <SessionMetric label="Mensajes"><span className="tabular-nums">{messages}</span>{messageRate !== undefined && <span className="hidden text-[13px] font-normal text-[#87909d] md:inline">≈ {messageRate.toLocaleString('es-CO', { maximumFractionDigits: 1 })} msg/s</span>}</SessionMetric>
        <SessionMetric label="Intervalo"><span className="tabular-nums">{session.tick_ms / 1000} s</span></SessionMetric>
      </div>
      {showError && <div className="flex flex-col gap-2 border-t border-[#e7b94e] bg-[#fff8e8] px-3 py-2.5 text-xs text-[#714b08] sm:flex-row sm:items-center" role="alert">
        <div className="flex min-w-0 flex-1 items-start gap-2"><AlertTriangle className="mt-0.5 shrink-0 text-[#c98600]" size={15} /><p className="leading-5"><strong className="font-semibold">Sesión interrumpida.</strong> {userFacingError}</p></div>
        <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
          {['detenida', 'fallida'].includes(state) && <button className="min-h-10 rounded-lg px-3 font-semibold text-[#0b6ffb] transition hover:bg-[#0b6ffb]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b6ffb]/35" disabled={pending} onClick={() => requestAction('start')} type="button">{pending ? 'Reanudando…' : 'Reanudar'}</button>}
          <button aria-label="Cerrar aviso" className="grid size-9 place-items-center rounded-lg text-[#8a6b2d] transition hover:bg-[#714b08]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c98600]/35" onClick={() => rawError && setDismissedError(rawError)} type="button"><X size={14} /></button>
        </div>
      </div>}
    </article>
    {labOpen && <SimulatorLab channels={channels.filter((channel) => channel.active)} deviceName={deviceName} onClose={() => setLabOpen(false)} onFaults={onFaults} onInputs={onInputs} pending={pending} sessionName={session.name} snapshot={snapshot} state={state} />}
  </>
}

function SimulatorLab({ sessionName, deviceName, state, snapshot, channels, pending, onClose, onInputs, onFaults }: { sessionName: string; deviceName: string; state: SimulatorSession['state']; snapshot?: SimulatorSnapshot; channels: Channel[]; pending: boolean; onClose: () => void; onInputs: (values: Record<string, unknown>) => void; onFaults: (values: Record<string, unknown>) => void }) {
  const [tab, setTab] = useState<'inputs' | 'faults' | 'console'>('inputs')
  const running = activeStates.has(state)
  const sensors = channels.filter((channel) => channel.category === 'sensor')
  const actuators = channels.filter((channel) => channel.category === 'actuador')

  function submitInputs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const values: Record<string, unknown> = {}
    sensors.forEach((channel) => {
      const raw = data.get(channel.key)
      if (raw === null || raw === '') return
      values[channel.key] = ['numero', 'entero'].includes(channel.data_type) ? Number(raw) : raw
    })
    onInputs(values)
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b1726]/65 p-2 backdrop-blur-[2px] sm:p-4" role="presentation">
    <section aria-label={`Laboratorio de ${sessionName}`} aria-modal="true" className="flex h-[min(720px,calc(100vh-1rem))] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_28px_80px_rgba(8,20,34,.32)] sm:h-[min(720px,calc(100vh-2rem))]" role="dialog">
      <header className="flex min-h-14 items-center gap-3 border-b border-[#e5e7eb] px-3 sm:px-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf3ff] text-[#1677ff]"><Bot size={17} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-semibold">{sessionName}</h2><span className="hidden rounded-full bg-[#e9f8ef] px-2 py-0.5 text-[10px] font-semibold text-[#15803d] sm:inline">{state}</span></div><p className="truncate text-[11px] text-[#667085]">{deviceName} · {snapshot?.connected ? 'conectado' : 'sin conexión'} · {snapshot?.messages_sent ?? 0} mensajes</p></div><button aria-label="Cerrar laboratorio" className="grid size-9 place-items-center rounded-lg text-[#667085] transition hover:bg-[#f2f4f7]" onClick={onClose} type="button"><X size={18} /></button></header>

      <nav className="grid grid-cols-3 border-b border-[#e5e7eb] bg-[#f8fafc] lg:hidden">{([['inputs', 'Entradas'], ['faults', 'Fallos'], ['console', 'Consola']] as const).map(([value, label]) => <button className={`h-10 border-b-2 text-xs font-semibold ${tab === value ? 'border-[#1677ff] bg-white text-[#1677ff]' : 'border-transparent text-[#667085]'}`} key={value} onClick={() => setTab(value)} type="button">{label}</button>)}</nav>

      <div className="min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[1.05fr_.85fr_1.2fr]">
        <section className={`${tab === 'inputs' ? 'flex' : 'hidden'} h-full min-h-0 flex-col overflow-y-auto p-4 lg:flex lg:border-r lg:border-[#e5e7eb]`}><PanelTitle icon={Activity} subtitle="Ajusta sensores y consulta la respuesta de los actuadores." title="Sensores y actuadores" /><div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">{sensors.length ? <form onSubmit={submitInputs}><p className="mb-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#8795a5]">Sensores virtuales</p><div className="space-y-2">{sensors.map((channel) => <label className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 rounded-lg border border-[#eef1f4] bg-[#fbfcfe] px-3 py-2 text-xs text-[#475467]" key={channel.id}><span className="min-w-0"><span className="block truncate font-medium text-[#344054]">{channel.name}</span><span className="text-[10px] text-[#98a2b3]">{channel.key} · {channel.unit || 'sin unidad'}</span></span><input className="h-8 rounded-lg border border-[#d0d5dd] bg-white px-2 text-right text-xs outline-none focus:border-[#1677ff]" defaultValue={String(snapshot?.values[channel.key] ?? '')} max={channel.maximum_value ?? undefined} min={channel.minimum_value ?? undefined} name={channel.key} step={channel.data_type === 'entero' ? 1 : 'any'} type={['numero', 'entero'].includes(channel.data_type) ? 'number' : 'text'} /></label>)}</div><Button className="mt-3 w-full" disabled={!running || pending} type="submit">Aplicar valores</Button></form> : <p className="text-xs text-[#667085]">No hay sensores activos.</p>}{actuators.length > 0 && <div><div className="mb-2 flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8795a5]">Actuadores vinculados</p><span className="text-[9px] text-[#98a2b3]">Responden a comandos MQTT</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{actuators.map((channel) => { const value = snapshot?.actuators[channel.key]; const active = value === true || Number(value) > 0; return <div className="flex items-center gap-2.5 rounded-lg border border-[#ece8f7] bg-[#faf9ff] px-3 py-2.5" key={channel.id}><span className="grid size-7 place-items-center rounded-md bg-[#f2edff] text-[#7c3aed]"><SlidersHorizontal size={14} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-[#344054]">{channel.name}</span><span className="text-[10px] text-[#98a2b3]">{channel.key}</span></span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${active ? 'bg-[#e9f8ef] text-[#15803d]' : 'bg-[#eef1f4] text-[#667085]'}`}>{channel.data_type === 'booleano' ? active ? 'Encendido' : 'Apagado' : String(value ?? 0)}{channel.unit ? ` ${channel.unit}` : ''}</span></div> })}</div></div>}</div></section>

        <section className={`${tab === 'faults' ? 'flex' : 'hidden'} h-full min-h-0 flex-col overflow-y-auto p-4 lg:flex lg:border-r lg:border-[#e5e7eb]`}><PanelTitle icon={FlaskConical} subtitle="Prueba recuperación, timeouts y errores." title="Inyección de fallos" /><div className="mt-4 space-y-2"><FaultToggle active={snapshot?.faults.network_disconnected ?? false} disabled={!running || pending} label="Desconexión de red" onClick={() => onFaults({ network_disconnected: !snapshot?.faults.network_disconnected })} /><FaultToggle active={snapshot?.faults.drop_ack ?? false} disabled={!running || pending} label="Descartar ACK" onClick={() => onFaults({ drop_ack: !snapshot?.faults.drop_ack })} /><label className="block rounded-lg border border-[#eef1f4] bg-[#fbfcfe] p-3 text-xs font-medium text-[#475467]">Latencia de ACK <span className="font-normal text-[#98a2b3]">(ms)</span><input className="mt-2 h-9 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 text-xs outline-none focus:border-[#1677ff] disabled:opacity-50" defaultValue={snapshot?.faults.latency_ms ?? 0} disabled={!running || pending} max="30000" min="0" onBlur={(event) => running && onFaults({ latency_ms: Number(event.target.value) })} type="number" /></label><div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3 text-[11px] leading-5 text-[#1d4f91]">Los fallos se aplican al runtime activo y se reflejan en MQTT sin modificar la configuración del dispositivo.</div></div></section>

        <section className={`${tab === 'console' ? 'flex' : 'hidden'} h-full min-h-0 flex-col bg-[#0b2239] lg:flex`}><div className="flex min-h-14 items-center justify-between border-b border-white/10 px-4"><div><h3 className="text-sm font-semibold text-white">Consola en vivo</h3><p className="text-[10px] text-[#9fb2c5]">Telemetría, comandos, ACK y fallos</p></div><Terminal className="text-[#7dd3fc]" size={17} /></div><div className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-3 font-mono text-[11px] leading-5 text-[#d8e2ec] sm:p-4">{snapshot?.logs.length ? snapshot.logs.slice().reverse().map((log, index) => <div className="grid grid-cols-[72px_72px_minmax(0,1fr)] gap-2 border-b border-white/5 py-1.5" key={`${log.timestamp}-${index}`}><span className="text-[#7dd3fc]">{new Date(log.timestamp).toLocaleTimeString('es-CO')}</span><span className="truncate uppercase text-[#94a3b8]">{log.level}</span><span className="break-words">{log.message}</span></div>) : <p className="text-[#94a3b8]">Inicia la sesión para ver actividad MQTT.</p>}</div></section>
      </div>
    </section>
  </div>
}

function PanelTitle({ icon: Icon, title, subtitle }: { icon: typeof Activity; title: string; subtitle: string }) {
  return <div className="flex items-start gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eef6ff] text-[#1677ff]"><Icon size={15} /></span><div><h3 className="text-sm font-semibold text-[#111827]">{title}</h3><p className="mt-0.5 text-[11px] leading-4 text-[#667085]">{subtitle}</p></div></div>
}

function SessionMetric({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0 bg-[#fbfcfd] px-2.5 py-2 sm:px-3"><p className="truncate text-[9px] font-medium uppercase tracking-[.08em] text-[#87909d] sm:text-[10px]">{label}</p><div className="mt-0.5 flex min-h-6 min-w-0 items-center gap-1.5 truncate text-[15px] font-semibold text-[#27364a] sm:text-[17px]">{children}</div></div>
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function FaultToggle({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return <button className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-[#fda29b] bg-[#fff1f0] text-[#b42318]' : 'border-[#d0d5dd] bg-white text-[#475467] hover:bg-[#f8fafc]'}`} disabled={disabled} onClick={onClick} type="button"><span>{label}</span><span className={`h-4 w-7 rounded-full p-0.5 ${active ? 'bg-[#ef4444]' : 'bg-[#cbd5e1]'}`}><span className={`block size-3 rounded-full bg-white transition ${active ? 'translate-x-3' : ''}`} /></span></button>
}
