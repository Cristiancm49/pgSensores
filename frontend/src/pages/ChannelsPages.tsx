import { ChevronDown, ExternalLink, Gauge, Plus, RefreshCw, ToggleLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '../components/common/Button'
import { AppShell } from '../components/layout/AppShell'
import { CompactStats, InventoryEmpty, InventoryHeader, InventorySelect, InventorySkeleton, InventoryToolbar, Pagination, StateBadge } from '../features/inventory/InventoryUi'
import { usePortfolioInventory } from '../features/inventory/usePortfolioInventory'
import type { Channel } from '../types/entities'

type Category = '' | 'sensor' | 'actuador'
type Inventory = ReturnType<typeof usePortfolioInventory>

export function ChannelsPage() {
  const inventory = usePortfolioInventory()
  const [params, setParams] = useSearchParams()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const search = params.get('q') ?? ''
  const projectId = params.get('proyecto') ?? ''
  const category = (params.get('tipo') ?? '') as Category
  const state = params.get('estado') ?? ''
  const connection = params.get('conexion') ?? ''
  const requestedPage = Math.max(1, Number(params.get('pagina')) || 1)
  const requestedSize = Number(params.get('filas')) || 10
  const pageSize = [10, 20, 50].includes(requestedSize) ? requestedSize : 10

  function setFilter(key: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'pagina') next.delete('pagina')
      return next
    }, { replace: true })
  }

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return inventory.channels.filter((channel) => {
      const device = inventory.deviceById.get(channel.device_id)
      const project = device ? inventory.projectById.get(device.project_id) : undefined
      const matchesText = !term || `${channel.name} ${channel.key} ${channel.category} ${channel.data_type} ${channel.unit ?? ''} ${device?.name ?? ''} ${project?.name ?? ''}`.toLocaleLowerCase('es').includes(term)
      const matchesProject = !projectId || device?.project_id === projectId
      const matchesCategory = !category || channel.category === category
      const matchesState = !state || (state === 'activo' ? channel.active : !channel.active)
      const isOnline = device?.status === 'conectado'
      const matchesConnection = !connection || (connection === 'online' ? isOnline : !isOnline)
      return matchesText && matchesProject && matchesCategory && matchesState && matchesConnection
    })
  }, [category, connection, inventory.channels, inventory.deviceById, inventory.projectById, projectId, search, state])

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const pageItems = visible.slice((page - 1) * pageSize, page * pageSize)
  const grouped = useMemo(() => {
    const groups = new Map<string, Channel[]>()
    pageItems.forEach((channel) => groups.set(channel.device_id, [...(groups.get(channel.device_id) ?? []), channel]))
    return [...groups.entries()].sort(([firstId], [secondId]) => (inventory.deviceById.get(firstId)?.name ?? '').localeCompare(inventory.deviceById.get(secondId)?.name ?? '', 'es'))
  }, [inventory.deviceById, pageItems])
  const sensors = inventory.channels.filter((channel) => channel.category === 'sensor').length
  const actuators = inventory.channels.filter((channel) => channel.category === 'actuador').length
  const onlineChannels = inventory.channels.filter((channel) => inventory.deviceById.get(channel.device_id)?.status === 'conectado').length

  function toggleGroup(deviceId: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(deviceId)) next.delete(deviceId)
      else next.add(deviceId)
      return next
    })
  }

  return <AppShell><div className="mx-auto max-w-[1460px]">
    <InventoryHeader actions={<div className="flex gap-2"><Button onClick={() => inventory.refetch()} variant="secondary"><RefreshCw size={15} />Actualizar</Button><Link className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1677ff] px-3.5 text-[13px] font-semibold text-white hover:bg-[#0f63d8]" to="/app/proyectos"><Plus size={15} />Agregar canal</Link></div>} description="Sensores y actuadores organizados por dispositivo, con estado de conexión y configuración en una sola vista." title="Canales IoT" />
    <CompactStats items={[
      { label: 'Total', value: inventory.channels.length },
      { label: 'Sensores', value: sensors, tone: 'amber' },
      { label: 'Actuadores', value: actuators, tone: 'purple' },
      { label: 'En línea', value: onlineChannels, tone: 'green' },
    ]} />
    <div aria-label="Filtrar por tipo de canal" className="mt-4 inline-flex rounded-xl border border-[#dce3ea] bg-white p-1 shadow-[0_1px_3px_rgba(16,32,51,.04)]">{([['', 'Todos'], ['sensor', 'Sensores'], ['actuador', 'Actuadores']] as const).map(([value, label]) => <button aria-pressed={category === value} className={`h-9 rounded-lg px-3.5 text-xs font-semibold transition ${category === value ? 'bg-[#eaf3ff] text-[#1268d6]' : 'text-[#617184] hover:bg-[#f3f6fa] hover:text-[#102033]'}`} key={label} onClick={() => setFilter('tipo', value)} type="button">{label}</button>)}</div>
    <InventoryToolbar onSearch={(value) => setFilter('q', value)} placeholder="Buscar canal, clave, dispositivo o proyecto..." search={search}>
      <InventorySelect label="Filtrar por proyecto" onChange={(value) => setFilter('proyecto', value)} value={projectId}><option value="">Todos los proyectos</option>{inventory.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</InventorySelect>
      <InventorySelect label="Filtrar por estado del canal" onChange={(value) => setFilter('estado', value)} value={state}><option value="">Canal: cualquier estado</option><option value="activo">Canal habilitado</option><option value="inactivo">Canal deshabilitado</option></InventorySelect>
      <InventorySelect label="Filtrar por conexión" onChange={(value) => setFilter('conexion', value)} value={connection}><option value="">Cualquier conexión</option><option value="online">Dispositivo en línea</option><option value="offline">Dispositivo fuera de línea</option></InventorySelect>
    </InventoryToolbar>
    {inventory.loadingChannels ? <InventorySkeleton /> : visible.length ? <section aria-label="Canales agrupados por dispositivo" className="mt-3 space-y-3">{grouped.map(([deviceId, channels]) => <DeviceChannelGroup channels={channels} collapsed={collapsed.has(deviceId)} deviceId={deviceId} inventory={inventory} key={deviceId} onToggle={() => toggleGroup(deviceId)} />)}{visible.length > pageSize && <div className="overflow-hidden rounded-xl border border-[#dce3ea] bg-white"><Pagination label="canales" onPageChange={(value) => setFilter('pagina', String(value))} onPageSizeChange={(value) => setFilter('filas', String(value))} page={page} pageSize={pageSize} total={visible.length} /></div>}</section> : <div className="mt-3"><InventoryEmpty><div><Gauge className="mx-auto mb-2 text-[#98a2b3]" size={25} /><p>No hay canales que coincidan con los filtros.</p><Link className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#1677ff] px-3 text-xs font-semibold text-white" to="/app/proyectos"><Plus size={14} />Agregar canal</Link></div></InventoryEmpty></div>}
  </div></AppShell>
}

function DeviceChannelGroup({ channels, collapsed, deviceId, inventory, onToggle }: { channels: Channel[]; collapsed: boolean; deviceId: string; inventory: Inventory; onToggle: () => void }) {
  const device = inventory.deviceById.get(deviceId)
  const project = device ? inventory.projectById.get(device.project_id) : undefined
  const sensors = channels.filter((channel) => channel.category === 'sensor').length
  const actuators = channels.length - sensors
  const online = device?.status === 'conectado'
  return <article className="overflow-hidden rounded-xl border border-[#dce3ea] bg-white shadow-[0_1px_3px_rgba(16,32,51,.04)]">
    <button aria-expanded={!collapsed} className="flex w-full items-center gap-3 bg-[#f8fafc] px-3.5 py-3 text-left hover:bg-[#f3f7fb] sm:px-4" onClick={onToggle} type="button"><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${online ? 'bg-[#e8f7ef] text-[#139a5b]' : 'bg-[#eef3f8] text-[#617184]'}`}><Gauge size={17} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-[13px] text-[#102033]">{device?.name ?? 'Dispositivo no disponible'}</strong><StateBadge state={online ? 'conectado' : 'desconectado'} /></span><span className="mt-0.5 block truncate text-[10px] text-[#617184]">{project?.name ?? 'Sin proyecto'} · {device?.device_identifier ?? deviceId}{device?.last_connection ? ` · última comunicación ${new Date(device.last_connection).toLocaleString('es-CO')}` : ''}</span></span><span className="hidden items-center gap-1.5 text-[10px] text-[#617184] sm:flex"><span className="rounded-full bg-[#fff4e5] px-2 py-1">{sensors} sensores</span><span className="rounded-full bg-[#f2edff] px-2 py-1">{actuators} actuadores</span></span><ChevronDown className={`shrink-0 text-[#617184] transition ${collapsed ? '-rotate-90' : ''}`} size={17} /></button>
    {!collapsed && <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[860px] text-left"><thead className="border-y border-[#edf1f5] bg-white text-[10px] font-semibold uppercase tracking-wide text-[#667085]"><tr><th className="px-4 py-2.5">Canal</th><th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5">Dato</th><th className="px-4 py-2.5">Canal</th><th className="px-4 py-2.5">Conexión</th><th className="px-4 py-2.5 text-right">Acción</th></tr></thead><tbody className="divide-y divide-[#eef1f4]">{channels.map((channel) => <DesktopChannelRow channel={channel} deviceId={deviceId} key={channel.id} online={online} />)}</tbody></table></div><div className="divide-y divide-[#edf1f5] md:hidden">{channels.map((channel) => <MobileChannelCard channel={channel} deviceId={deviceId} key={channel.id} online={online} />)}</div></>}
  </article>
}

function ChannelIdentity({ channel }: { channel: Channel }) {
  const Icon = channel.category === 'sensor' ? Gauge : ToggleLeft
  return <div className="flex min-w-0 items-center gap-2.5"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${channel.category === 'sensor' ? 'bg-[#fff4e5] text-[#b86608]' : 'bg-[#f2edff] text-[#7047c8]'}`}><Icon size={16} /></span><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-[#111827]">{channel.name}</p><p className="truncate text-[10px] text-[#667085]">{channel.key}{channel.gpio ? ` · GPIO ${channel.gpio}` : ''}</p></div></div>
}

function DesktopChannelRow({ channel, deviceId, online }: { channel: Channel; deviceId: string; online: boolean }) {
  return <tr className="hover:bg-[#fbfdff]"><td className="px-4 py-3"><ChannelIdentity channel={channel} /></td><td className="px-4 py-3 text-xs capitalize text-[#475467]">{channel.category}</td><td className="px-4 py-3 text-xs text-[#667085]">{channel.data_type}{channel.unit ? ` · ${channel.unit}` : ''}</td><td className="px-4 py-3"><StateBadge state={channel.active ? 'activo' : 'inactivo'} /></td><td className="px-4 py-3"><StateBadge state={online ? 'conectado' : 'desconectado'} /></td><td className="px-4 py-3 text-right"><Link aria-label={`Abrir ${channel.name}`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-[#1677ff] hover:bg-[#eaf3ff]" to={`/app/dispositivos/${deviceId}`}><span>Abrir</span><ExternalLink size={13} /></Link></td></tr>
}

function MobileChannelCard({ channel, deviceId, online }: { channel: Channel; deviceId: string; online: boolean }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3"><div className="min-w-0"><ChannelIdentity channel={channel} /><div className="mt-2 flex flex-wrap gap-1.5"><StateBadge state={channel.active ? 'activo' : 'inactivo'} /><StateBadge state={online ? 'conectado' : 'desconectado'} /><span className="rounded-full bg-[#f3f6fa] px-2.5 py-1 text-[10px] text-[#617184]">{channel.data_type}{channel.unit ? ` · ${channel.unit}` : ''}</span></div></div><Link aria-label={`Abrir ${channel.name}`} className="grid size-11 place-items-center rounded-xl border border-[#dce3ea] text-[#1677ff] hover:bg-[#eaf3ff]" to={`/app/dispositivos/${deviceId}`}><ExternalLink size={16} /></Link></div>
}

export function SensorsPage() { return <ChannelsPage /> }
export function ActuatorsPage() { return <ChannelsPage /> }
