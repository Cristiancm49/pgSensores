import { Cpu, ExternalLink, MapPin, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../components/common/Button'
import { AppShell } from '../components/layout/AppShell'
import { deviceConnectionLabel } from '../features/iot/connectionLabel'
import { CompactStats, InventoryEmpty, InventoryHeader, InventorySelect, InventorySkeleton, InventoryToolbar, Pagination, StateBadge } from '../features/inventory/InventoryUi'
import { usePortfolioInventory } from '../features/inventory/usePortfolioInventory'

export function DevicesPage() {
  const inventory = usePortfolioInventory()
  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return inventory.devices.filter((device) => {
      const project = inventory.projectById.get(device.project_id)
      const location = device.location_id ? inventory.locationById.get(device.location_id) : undefined
      const matchesText = !term || `${device.name} ${device.device_identifier} ${device.board_type} ${project?.name ?? ''} ${location?.name ?? ''}`.toLocaleLowerCase('es').includes(term)
      return matchesText && (!projectId || device.project_id === projectId) && (!status || device.status === status)
    })
  }, [inventory.devices, inventory.locationById, inventory.projectById, projectId, search, status])
  const pageItems = visible.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => setPage(1), [search, projectId, status])

  return <AppShell><div className="mx-auto max-w-[1460px]">
    <InventoryHeader actions={<div className="flex gap-2"><Button onClick={() => inventory.refetch()} variant="secondary"><RefreshCw size={15} />Actualizar</Button><Link className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1677ff] px-3.5 text-[13px] font-semibold text-white hover:bg-[#0f63d8]" to="/app/proyectos"><Plus size={15} />Registrar dispositivo</Link></div>} description="Inventario de equipos físicos y simulados de todos tus proyectos." title="Dispositivos" />
    <CompactStats items={[
      { label: 'Total', value: inventory.devices.length },
      { label: 'Conectados', value: inventory.devices.filter((item) => item.status === 'conectado').length, tone: 'green' },
      { label: 'Desconectados', value: inventory.devices.filter((item) => item.status === 'desconectado').length, tone: 'amber' },
      { label: 'Con error', value: inventory.devices.filter((item) => item.status === 'error').length, tone: 'red' },
    ]} />
    <InventoryToolbar onSearch={setSearch} placeholder="Buscar por nombre, identificador, placa o ubicación..." search={search}>
      <InventorySelect label="Filtrar por proyecto" onChange={setProjectId} value={projectId}><option value="">Todos los proyectos</option>{inventory.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</InventorySelect>
      <InventorySelect label="Filtrar por estado" onChange={setStatus} value={status}><option value="">Todos los estados</option><option value="conectado">Conectado</option><option value="desconectado">Desconectado</option><option value="error">Error</option><option value="inactivo">Inactivo</option></InventorySelect>
    </InventoryToolbar>
    {inventory.loading ? <InventorySkeleton /> : visible.length ? <section className="mt-3 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(16,24,40,.04)]"><div className="overflow-x-auto"><table className="w-full text-left sm:min-w-[880px]"><thead className="bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-[#667085]"><tr><th className="px-4 py-2.5">Dispositivo</th><th className="hidden px-4 py-2.5 sm:table-cell">Proyecto</th><th className="hidden px-4 py-2.5 sm:table-cell">Ubicación</th><th className="hidden px-4 py-2.5 sm:table-cell">Conexión</th><th className="px-4 py-2.5">Estado</th><th className="hidden px-4 py-2.5 sm:table-cell">Última conexión</th><th className="px-4 py-2.5 text-right">Acción</th></tr></thead><tbody className="divide-y divide-[#eef1f4]">{pageItems.map((device) => <tr className="hover:bg-[#fbfdff]" key={device.id}><td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eaf3ff] text-[#1677ff]"><Cpu size={16} /></span><div><p className="text-[13px] font-semibold text-[#111827]">{device.name}</p><p className="text-[11px] text-[#667085]">{device.board_type} · {device.device_identifier}</p></div></div></td><td className="hidden px-4 py-3 text-[13px] text-[#475467] sm:table-cell">{inventory.projectById.get(device.project_id)?.name ?? '—'}</td><td className="hidden px-4 py-3 sm:table-cell"><span className="inline-flex items-center gap-1 text-xs text-[#667085]"><MapPin size={13} />{device.location_id ? inventory.locationById.get(device.location_id)?.name ?? 'Sin ubicación' : 'Sin ubicación'}</span></td><td className="hidden px-4 py-3 text-xs text-[#667085] sm:table-cell">{deviceConnectionLabel(device)}</td><td className="px-4 py-3"><StateBadge state={device.status} /></td><td className="hidden px-4 py-3 text-[11px] text-[#667085] sm:table-cell">{device.last_connection ? new Date(device.last_connection).toLocaleString('es-CO') : 'Sin conexión registrada'}</td><td className="px-4 py-3 text-right"><Link aria-label={`Abrir ${device.name}`} className="inline-flex size-8 items-center justify-center rounded-lg text-[#1677ff] hover:bg-[#eaf3ff] sm:w-auto sm:gap-1 sm:px-2.5" to={`/app/dispositivos/${device.id}`}><span className="hidden sm:inline">Abrir</span><ExternalLink size={13} /></Link></td></tr>)}</tbody></table></div><Pagination label="dispositivos" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} page={page} pageSize={pageSize} total={visible.length} /></section> : <div className="mt-3"><InventoryEmpty><div><Cpu className="mx-auto mb-2 text-[#98a2b3]" size={25} /><p>No hay dispositivos que coincidan con los filtros.</p></div></InventoryEmpty></div>}
  </div></AppShell>
}
