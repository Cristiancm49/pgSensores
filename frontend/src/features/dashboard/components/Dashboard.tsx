import { useQueries, useQuery } from '@tanstack/react-query'
import {
  BellRing, CircleCheck, Cpu, Droplets, FolderKanban, Gauge, Leaf, Plus, Radio, Sun,
  Thermometer, ToggleLeft, Users, Wifi, WifiOff, Zap, type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import type { Channel, Device } from '../../../types/entities'
import { useAuth } from '../../auth/AuthContext'
import { devicesApi, eventsApi, locationsApi, projectsApi } from '../../crud/api'
import {
  AlertList, DashboardSection, DashboardSkeleton, DashboardStatCard, MiniTrendChart,
  ProjectSummaryRow, QuickAction, type ProjectSummary,
} from './DashboardPrimitives'

type SensorTone = 'red' | 'blue' | 'green' | 'orange' | 'purple'
type TimeRange = 1 | 6 | 24

const sensorColors: Record<SensorTone, { color: string; background: string }> = {
  red: { color: '#ef4444', background: '#feecec' },
  blue: { color: '#1677ff', background: '#eaf3ff' },
  green: { color: '#16a34a', background: '#e9f8ef' },
  orange: { color: '#f59e0b', background: '#fff4e5' },
  purple: { color: '#7c3aed', background: '#f2edff' },
}

function sensorAppearance(channel: Channel): { icon: LucideIcon; tone: SensorTone } {
  const text = `${channel.key} ${channel.name} ${channel.unit ?? ''}`.toLowerCase()
  if (text.includes('temperatura') || text.includes('temp') || text.includes('°c')) return { icon: Thermometer, tone: 'red' }
  if (text.includes('humedad') || text.includes('agua') || text.includes('%')) return { icon: Droplets, tone: 'blue' }
  if (text.includes('luz') || text.includes('lux')) return { icon: Sun, tone: 'orange' }
  if (text.includes('suelo') || text.includes('planta')) return { icon: Leaf, tone: 'green' }
  if (text.includes('volt') || text.includes('corriente')) return { icon: Zap, tone: 'purple' }
  return { icon: Gauge, tone: 'blue' }
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return 'Sin datos'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1)
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1)
  return String(value)
}

function deviceActivity(device: Device, currentTime: Date) {
  if (device.status !== 'conectado' || !device.last_connection) return device.status === 'conectado' ? 'En línea' : 'Sin conexión'
  const elapsed = currentTime.getTime() - new Date(device.last_connection).getTime()
  if (elapsed < 60_000) return 'Ahora'
  if (elapsed < 3_600_000) return `Hace ${Math.max(1, Math.floor(elapsed / 60_000))} min`
  return `Hace ${Math.floor(elapsed / 3_600_000)} h`
}

export function Dashboard() {
  const { user } = useAuth()
  const [now, setNow] = useState(() => new Date())
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null)
  const [rangeHours, setRangeHours] = useState<TimeRange>(6)
  const projects = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })
  const projectList = projects.data ?? []
  const deviceQueries = useQueries({ queries: projectList.map((project) => ({ queryKey: ['devices', project.id], queryFn: () => devicesApi.list(project.id) })) })
  const memberQueries = useQueries({ queries: projectList.map((project) => ({ queryKey: ['members', project.id], queryFn: () => projectsApi.members(project.id) })) })
  const locationQueries = useQueries({ queries: projectList.map((project) => ({ queryKey: ['locations', project.id], queryFn: () => locationsApi.list(project.id) })) })
  const devices = useMemo(() => deviceQueries.flatMap((query) => query.data ?? []), [deviceQueries])
  const channelQueries = useQueries({ queries: devices.map((device) => ({ queryKey: ['channels', device.id, 'all'], queryFn: () => devicesApi.channels(device.id) })) })
  const channels = useMemo(() => channelQueries.flatMap((query) => query.data ?? []), [channelQueries])
  const sensors = channels.filter((channel) => channel.category === 'sensor' && channel.active)
  const numericSensors = sensors.filter((channel) => channel.data_type === 'numero' || channel.data_type === 'entero')
  const graphSensors = (numericSensors.length ? numericSensors : sensors).slice(0, 5)
  const actuators = channels.filter((channel) => channel.category === 'actuador' && channel.active)
  const selectedSensor = graphSensors.find((channel) => channel.id === selectedSensorId) ?? graphSensors[0]

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const sensorTelemetry = useQueries({
    queries: graphSensors.map((channel) => ({
      queryKey: ['telemetry', channel.id, 'dashboard-tile'],
      queryFn: () => devicesApi.telemetry(channel.id, { page: 1, page_size: 18 }),
      refetchInterval: 15_000,
    })),
  })
  const selectedTelemetry = useQuery({
    queryKey: ['telemetry', selectedSensor?.id, 'dashboard-chart', rangeHours],
    queryFn: () => devicesApi.telemetry(selectedSensor!.id, { page: 1, page_size: 100, from_date: new Date(now.getTime() - rangeHours * 3_600_000).toISOString() }),
    enabled: Boolean(selectedSensor),
    refetchInterval: 15_000,
  })
  const events = useQuery({ queryKey: ['events', 'dashboard'], queryFn: () => eventsApi.list({ page: 1, page_size: 5 }), refetchInterval: 30_000 })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const warningEvents = useQuery({
    queryKey: ['events', 'dashboard-today', 'advertencia', today.toISOString()],
    queryFn: () => eventsApi.list({ page: 1, page_size: 1, severity: 'advertencia', from_date: today.toISOString() }),
    refetchInterval: 30_000,
  })
  const criticalEvents = useQuery({
    queryKey: ['events', 'dashboard-today', 'critica', today.toISOString()],
    queryFn: () => eventsApi.list({ page: 1, page_size: 1, severity: 'critica', from_date: today.toISOString() }),
    refetchInterval: 30_000,
  })

  const deviceById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices])
  const projectName = (id: string) => projectList.find((project) => project.id === id)?.name ?? 'Proyecto'
  const deviceName = (id: string | null) => id ? deviceById.get(id)?.name ?? 'Dispositivo' : 'Sistema'
  const projectForChannel = (channel: Channel) => projectName(deviceById.get(channel.device_id)?.project_id ?? '')
  const sensorsByDevice = new Map<string, number>()
  const actuatorsByDevice = new Map<string, number>()
  channels.forEach((channel) => {
    const target = channel.category === 'sensor' ? sensorsByDevice : actuatorsByDevice
    target.set(channel.device_id, (target.get(channel.device_id) ?? 0) + (channel.active ? 1 : 0))
  })
  const projectRows: ProjectSummary[] = projectList.slice(0, 4).map((project, index) => {
    const projectDevices = deviceQueries[index]?.data ?? []
    return {
      id: project.id, name: project.name, description: project.description, status: project.status,
      devices: projectDevices.length,
      sensors: projectDevices.reduce((total, device) => total + (sensorsByDevice.get(device.id) ?? 0), 0),
      actuators: projectDevices.reduce((total, device) => total + (actuatorsByDevice.get(device.id) ?? 0), 0),
      members: memberQueries[index]?.data?.length ?? 0,
      locations: locationQueries[index]?.data?.length ?? 0,
      updatedAt: project.updated_at,
    }
  })
  const connectedDevices = devices.filter((device) => device.status === 'conectado')
  const incidentsToday = (warningEvents.data?.total ?? 0) + (criticalEvents.data?.total ?? 0)
  const chartData = (selectedTelemetry.data?.items ?? []).map((point) => ({
    value: Number(point.value),
    time: new Date(point.recorded_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
  })).filter((point) => Number.isFinite(point.value)).reverse()
  const chartValues = chartData.map((point) => point.value)
  const average = chartValues.length ? chartValues.reduce((sum, value) => sum + value, 0) / chartValues.length : null
  const latest = chartData.at(-1)?.value
  const selectedAppearance = selectedSensor ? sensorAppearance(selectedSensor) : null
  const selectedColor = selectedAppearance ? sensorColors[selectedAppearance.tone].color : '#1677ff'
  const SelectedSensorIcon = selectedAppearance?.icon ?? Gauge
  const currentDate = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)

  if (projects.isLoading) return <DashboardSkeleton />

  return (
    <div className="mx-auto max-w-[1540px] pb-4">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[clamp(1.45rem,2.4vw,1.9rem)] font-bold tracking-[-.03em] text-[#102033]">Monitoreo en vivo</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f8ef] px-2.5 py-1 text-[11px] font-semibold text-[#15803d]"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#22c55e] opacity-50" /><span className="relative inline-flex size-2 rounded-full bg-[#22c55e]" /></span>Datos en vivo</span>
          </div>
          <p className="mt-1 text-[13px] text-[#617184]"><span className="capitalize">{currentDate}</span> · Actualizado {now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex gap-2">
          <Link className="inline-flex h-9 items-center rounded-lg border border-[#cfd8e3] bg-white px-3.5 text-xs font-semibold text-[#344054] hover:bg-[#f8fafc]" to="/app/proyectos">Ver proyectos</Link>
          <Link className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1677ff] px-3.5 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(22,119,255,.2)] hover:bg-[#0f63d8]" to="/app/proyectos?crear=1"><Plus size={14} />Crear proyecto</Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <DashboardStatCard icon={Wifi} subtitle={`${connectedDevices.length} conectados ahora`} title="Dispositivos en línea" tone="green" to="/app/dispositivos" value={`${connectedDevices.length} / ${devices.length}`} />
        <DashboardStatCard icon={BellRing} subtitle="Advertencias y críticas" title="Incidentes hoy" tone="red" to="/app/alertas" value={incidentsToday} />
        <DashboardStatCard icon={Gauge} subtitle="Canales disponibles" title="Sensores activos" tone="blue" to="/app/sensores" value={sensors.length} />
        <DashboardStatCard icon={ToggleLeft} subtitle="Canales de control" title="Actuadores" tone="purple" to="/app/actuadores" value={actuators.length} />
        <DashboardStatCard icon={FolderKanban} subtitle="Espacios en operación" title="Proyectos activos" tone="orange" to="/app/proyectos" value={projectList.filter((project) => project.status === 'activo').length} />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-xl border border-[#dce3ea] bg-white shadow-[0_2px_8px_rgba(16,32,51,.05)]">
            <div className="flex flex-col gap-3 border-b border-[#e5e7eb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ color: selectedColor, background: `${selectedColor}16` }}><SelectedSensorIcon size={19} /></span>
                <div className="min-w-0"><h2 className="truncate text-[15px] font-semibold text-[#111827]">Telemetría principal</h2><p className="truncate text-xs text-[#667085]">{selectedSensor ? `${selectedSensor.name} · ${projectForChannel(selectedSensor)}` : 'Selecciona un sensor para comenzar'}</p></div>
              </div>
              <div className="inline-flex w-fit rounded-lg bg-[#f2f4f7] p-1">
                {([1, 6, 24] as TimeRange[]).map((range) => <button className={`h-7 rounded-md px-3 text-[11px] font-semibold transition ${rangeHours === range ? 'bg-white text-[#1677ff] shadow-sm' : 'text-[#667085] hover:text-[#344054]'}`} key={range} onClick={() => setRangeHours(range)} type="button">{range} h</button>)}
              </div>
            </div>

            {selectedSensor && chartData.length ? <>
              <div className="grid grid-cols-2 gap-px border-b border-[#e5e7eb] bg-[#eef1f4] sm:grid-cols-4">
                {[
                  ['Valor actual', latest], ['Promedio', average], ['Mínimo', Math.min(...chartValues)], ['Máximo', Math.max(...chartValues)],
                ].map(([label, value]) => <div className="bg-white px-4 py-2.5" key={String(label)}><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8a98aa]">{label}</p><p className="mt-1 text-base font-bold tabular-nums text-[#102033]">{typeof value === 'number' ? value.toFixed(1) : '—'} <span className="text-[11px] font-semibold text-[#667085]">{selectedSensor.unit}</span></p></div>)}
              </div>
              <div className="px-2 pb-2 pt-4 sm:px-4" style={{ height: 280 }}>
                <ResponsiveContainer height="100%" width="100%">
                  <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                    <defs><linearGradient id="dashboardSensorArea" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor={selectedColor} stopOpacity={0.22} /><stop offset="95%" stopColor={selectedColor} stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid stroke="#e8edf3" strokeDasharray="3 4" vertical={false} />
                    <XAxis axisLine={false} dataKey="time" minTickGap={42} tick={{ fill: '#8290a3', fontSize: 10 }} tickLine={false} />
                    <YAxis axisLine={false} domain={['auto', 'auto']} tick={{ fill: '#8290a3', fontSize: 10 }} tickLine={false} width={46} />
                    <Tooltip contentStyle={{ border: '1px solid #dce3ea', borderRadius: 10, boxShadow: '0 8px 24px rgba(16,32,51,.12)', fontSize: 12 }} formatter={(value) => [`${Number(value).toFixed(1)} ${selectedSensor.unit ?? ''}`, selectedSensor.name]} labelStyle={{ color: '#667085', marginBottom: 4 }} />
                    {selectedSensor.maximum_value !== null && <ReferenceLine stroke="#f59e0b" strokeDasharray="5 5" y={selectedSensor.maximum_value} />}
                    <Area dataKey="value" fill="url(#dashboardSensorArea)" isAnimationActive={false} stroke={selectedColor} strokeWidth={2.4} type="monotone" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </> : <div className="grid h-[330px] place-items-center px-6 text-center"><div><Gauge className="mx-auto text-[#98a2b3]" size={28} /><p className="mt-2 text-sm font-semibold text-[#344054]">Sin telemetría para mostrar</p><p className="mt-1 text-xs text-[#667085]">Cuando un sensor envíe datos, su tendencia aparecerá aquí.</p></div></div>}

            {graphSensors.length > 0 && <div className="border-t border-[#e5e7eb] bg-[#fbfcfe] p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#7b8b9e]">Cambiar sensor</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {graphSensors.map((channel, index) => {
                  const appearance = sensorAppearance(channel)
                  const colors = sensorColors[appearance.tone]
                  const telemetry = sensorTelemetry[index]?.data?.items ?? []
                  const values = telemetry.map((point) => Number(point.value)).filter(Number.isFinite).reverse()
                  const Icon = appearance.icon
                  const active = channel.id === selectedSensor?.id
                  return <button className={`min-w-0 rounded-lg border bg-white p-2.5 text-left transition ${active ? 'border-[#8fc1ff] ring-2 ring-[#1677ff]/10' : 'border-[#e3e8ef] hover:border-[#b9d7ff]'}`} key={channel.id} onClick={() => setSelectedSensorId(channel.id)} type="button"><div className="flex items-center gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-md" style={{ color: colors.color, background: colors.background }}><Icon size={14} /></span><span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#344054]">{channel.name}</span></div><div className="mt-2 flex items-end justify-between gap-1"><strong className="truncate text-sm tabular-nums text-[#111827]">{displayValue(telemetry[0]?.value)} <span className="text-[10px] text-[#667085]">{channel.unit}</span></strong><MiniTrendChart color={colors.color} values={values} /></div></button>
                })}
              </div>
            </div>}
          </section>

          <DashboardSection action={{ label: 'Ver todos', to: '/app/proyectos' }} icon={FolderKanban} subtitle="Estado general de tus espacios de trabajo." title="Proyectos recientes">
            {projectRows.length ? <div className="divide-y divide-[#e5e7eb]">{projectRows.map((project) => <ProjectSummaryRow key={project.id} project={project} />)}</div> : <div className="grid min-h-32 place-items-center px-4 text-center"><div><FolderKanban className="mx-auto text-[#98a2b3]" size={25} /><p className="mt-2 text-xs text-[#667085]">Aún no tienes proyectos.</p></div></div>}
          </DashboardSection>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <DashboardSection action={{ label: 'Ver todas', to: '/app/alertas' }} icon={BellRing} title="Alertas recientes">
            <AlertList deviceName={deviceName} events={events.data?.items ?? []} projectName={projectName} />
          </DashboardSection>
          <DashboardSection action={{ label: 'Ver dispositivos', to: '/app/dispositivos' }} icon={Radio} title="Conectividad actual">
            <div className="divide-y divide-[#eef1f4]">
              {devices.slice(0, 5).map((device) => {
                const connected = device.status === 'conectado'
                return <article className="flex items-center gap-2.5 px-3.5 py-2.5" key={device.id}><span className={`grid size-8 shrink-0 place-items-center rounded-full ${connected ? 'bg-[#e9f8ef] text-[#16a34a]' : 'bg-[#f2f4f7] text-[#7b8794]'}`}>{connected ? <Wifi size={15} /> : <WifiOff size={15} />}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#111827]">{device.name}</p><p className="truncate text-[10px] text-[#667085]">{projectName(device.project_id)}</p></div><div className="text-right"><span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${connected ? 'text-[#15803d]' : 'text-[#667085]'}`}><span className="size-1.5 rounded-full bg-current" />{connected ? 'En línea' : 'Fuera de línea'}</span><p className="mt-0.5 text-[9px] text-[#98a2b3]">{deviceActivity(device, now)}</p></div></article>
              })}
              {!devices.length && <div className="grid min-h-28 place-items-center px-4 text-center"><p className="text-xs text-[#667085]">No hay dispositivos registrados.</p></div>}
            </div>
            {devices.length > 0 && <div className="flex items-center gap-2 border-t border-[#eef1f4] bg-[#fbfcfe] px-3.5 py-2 text-[10px] text-[#667085]"><CircleCheck className="text-[#16a34a]" size={13} />{connectedDevices.length} de {devices.length} dispositivos en línea</div>}
          </DashboardSection>
          <DashboardSection icon={Zap} title="Acciones rápidas">
            <div className="grid grid-cols-2 gap-2 p-3">
              <QuickAction icon={Plus} label="Crear proyecto" to="/app/proyectos?crear=1" />
              <QuickAction icon={Cpu} label="Dispositivos" to="/app/dispositivos" />
              {user?.is_admin && <QuickAction icon={Users} label="Usuarios" to="/app/usuarios" />}
              <QuickAction icon={ToggleLeft} label="Actuadores" to="/app/actuadores" />
            </div>
          </DashboardSection>
        </aside>
      </div>
    </div>
  )
}
