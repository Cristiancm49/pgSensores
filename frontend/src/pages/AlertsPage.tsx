import { useQueries, useQuery } from '@tanstack/react-query'
import { AlertTriangle, BellRing, CircleAlert, Info, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../components/common/Button'
import { AppShell } from '../components/layout/AppShell'
import { devicesApi, eventsApi, projectsApi } from '../features/crud/api'
import { InventoryHeader, Pagination } from '../features/inventory/InventoryUi'
import type { EventSeverity, SystemEvent } from '../types/entities'

export function AlertsPage() {
  const [projectId, setProjectId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [severity, setSeverity] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const projects = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })
  const deviceQueries = useQueries({ queries: (projects.data ?? []).filter((project) => !projectId || project.id === projectId).map((project) => ({ queryKey: ['devices', project.id], queryFn: () => devicesApi.list(project.id) })) })
  const devices = deviceQueries.flatMap((query) => query.data ?? [])
  const events = useQuery({
    queryKey: ['events', projectId, deviceId, severity, fromDate, toDate, page, pageSize],
    queryFn: () => eventsApi.list({ project_id: projectId, device_id: deviceId, severity, from_date: fromDate ? new Date(fromDate).toISOString() : undefined, to_date: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined, page, page_size: pageSize }),
    refetchInterval: 30_000,
  })
  const resetPage = () => setPage(1)
  const projectName = (id: string) => projects.data?.find((project) => project.id === id)?.name ?? 'Proyecto'
  const deviceName = (id: string | null) => devices.find((device) => device.id === id)?.name ?? (id ? 'Dispositivo' : 'Sistema')

  return <AppShell><div className="mx-auto max-w-[1400px]">
    <InventoryHeader actions={<Button onClick={() => events.refetch()} variant="secondary"><RefreshCw size={16} />Actualizar</Button>} description="Desconexiones, lecturas inválidas y problemas con comandos." title="Alertas y eventos" />
    <section className="mt-4 grid gap-3 rounded-xl border border-[#e2e8f0] bg-white p-3.5 sm:grid-cols-2 xl:grid-cols-5"><Filter label="Proyecto" value={projectId} onChange={(value) => { setProjectId(value); setDeviceId(''); resetPage() }}><option value="">Todos</option>{projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Filter><Filter label="Dispositivo" value={deviceId} onChange={(value) => { setDeviceId(value); resetPage() }}><option value="">Todos</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</Filter><Filter label="Severidad" value={severity} onChange={(value) => { setSeverity(value); resetPage() }}><option value="">Todas</option><option value="critica">Crítica</option><option value="advertencia">Advertencia</option><option value="info">Informativa</option></Filter><DateFilter label="Desde" value={fromDate} onChange={(value) => { setFromDate(value); resetPage() }} /><DateFilter label="Hasta" value={toDate} onChange={(value) => { setToDate(value); resetPage() }} /></section>
    <section className="mt-3 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white"><div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3"><h2 className="text-sm font-semibold">Eventos registrados</h2><span className="text-xs text-[#667085]">{events.data?.total ?? 0} resultados</span></div>{events.isLoading ? <div className="space-y-3 p-4">{Array.from({ length: 5 }, (_, index) => <div className="h-16 animate-pulse rounded-lg bg-[#eef2f6]" key={index} />)}</div> : events.data?.items.length ? <EventList events={events.data.items} projectName={projectName} deviceName={deviceName} /> : <div className="p-12 text-center"><BellRing className="mx-auto text-[#98a2b3]" size={34} /><p className="mt-3 text-sm text-[#667085]">No hay eventos con estos filtros.</p></div>}<Pagination label="eventos" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} page={page} pageSize={pageSize} total={events.data?.total ?? 0} /></section>
  </div></AppShell>
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <label className="text-xs font-medium text-[#475467]">{label}<select className="mt-1 block h-9 w-full rounded-lg border border-[#d0d5dd] bg-white px-2 text-[13px]" onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></label> }
function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-medium text-[#475467]">{label}<input className="mt-1 block h-9 w-full rounded-lg border border-[#d0d5dd] px-2 text-[13px]" onChange={(event) => onChange(event.target.value)} type="date" value={value} /></label> }
function EventSeverityBadge({ severity }: { severity: EventSeverity }) { const styles = severity === 'critica' ? 'bg-[#feeceb] text-[#b42318]' : severity === 'advertencia' ? 'bg-[#fff4e5] text-[#9a5b13]' : 'bg-[#eaf3ff] text-[#0f63d8]'; return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${styles}`}>{severity}</span> }
function EventItem({ event, projectName, deviceName }: { event: SystemEvent; projectName: (id: string) => string; deviceName: (id: string | null) => string }) { const Icon = event.severity === 'critica' ? CircleAlert : event.severity === 'advertencia' ? AlertTriangle : Info; return <article className="flex gap-3 px-4 py-3"><span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${event.severity === 'critica' ? 'bg-[#feeceb] text-[#d92d20]' : event.severity === 'advertencia' ? 'bg-[#fff4e5] text-[#dc6803]' : 'bg-[#eaf3ff] text-[#1677ff]'}`}><Icon size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{event.message}</p><EventSeverityBadge severity={event.severity} /></div><p className="mt-1 text-xs text-[#667085]">{projectName(event.project_id)} · {deviceName(event.device_id)} · {event.event_type.replaceAll('_', ' ')}</p></div><time className="shrink-0 text-[11px] text-[#98a2b3]">{new Date(event.created_at).toLocaleString('es-CO')}</time></article> }
function EventList({ events, projectName, deviceName }: { events: SystemEvent[]; projectName: (id: string) => string; deviceName: (id: string | null) => string }) { return <div className="divide-y divide-[#eaecf0]">{events.map((event) => <EventItem deviceName={deviceName} event={event} key={event.id} projectName={projectName} />)}</div> }
