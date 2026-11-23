import { ExternalLink, MapPin, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '../components/common/Button'
import { AppShell } from '../components/layout/AppShell'
import { InventoryEmpty, InventoryHeader, InventorySelect, InventorySkeleton, InventoryToolbar, Pagination } from '../features/inventory/InventoryUi'
import { usePortfolioInventory } from '../features/inventory/usePortfolioInventory'

export function LocationsPage() {
  const inventory = usePortfolioInventory()
  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return inventory.locations.filter((location) => {
      const project = inventory.projectById.get(location.project_id)
      const matchesText = !term || `${location.name} ${location.description ?? ''} ${project?.name ?? ''}`.toLocaleLowerCase('es').includes(term)
      return matchesText && (!projectId || location.project_id === projectId)
    })
  }, [inventory.locations, inventory.projectById, projectId, search])
  const pageItems = visible.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => setPage(1), [search, projectId])

  return <AppShell><div className="mx-auto max-w-[1460px]">
    <InventoryHeader actions={<div className="flex gap-2"><Button onClick={() => inventory.refetch()} variant="secondary"><RefreshCw size={15} />Actualizar</Button><Link className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1677ff] px-3.5 text-[13px] font-semibold text-white hover:bg-[#0f63d8]" to="/app/proyectos"><Plus size={15} />Nueva ubicación</Link></div>} description="Áreas donde están instalados los dispositivos de tus proyectos." title="Ubicaciones" />
    <InventoryToolbar onSearch={setSearch} placeholder="Buscar ubicación, descripción o proyecto..." search={search}><InventorySelect label="Filtrar por proyecto" onChange={setProjectId} value={projectId}><option value="">Todos los proyectos</option>{inventory.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</InventorySelect></InventoryToolbar>
    {inventory.loadingLocations ? <InventorySkeleton /> : visible.length ? <><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{pageItems.map((location) => {
      const project = inventory.projectById.get(location.project_id)
      const devices = inventory.devices.filter((device) => device.location_id === location.id)
      return <article className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,.04)]" key={location.id}><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf3ff] text-[#1677ff]"><MapPin size={18} /></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-[#111827]">{location.name}</h2><p className="mt-0.5 truncate text-xs text-[#667085]">{project?.name ?? 'Proyecto'}</p></div><span className="rounded-full bg-[#f2f4f7] px-2 py-1 text-[11px] font-medium text-[#667085]">{devices.length} {devices.length === 1 ? 'equipo' : 'equipos'}</span></div><p className="mt-3 line-clamp-2 min-h-8 text-xs leading-4 text-[#667085]">{location.description || 'Sin descripción'}</p><div className="mt-3 flex items-center justify-between border-t border-[#eef1f4] pt-3"><p className="text-[11px] text-[#98a2b3]">Actualizada {new Date(location.updated_at).toLocaleDateString('es-CO')}</p><Link className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-[#1677ff] hover:bg-[#eaf3ff]" to={`/app/proyectos/${location.project_id}`}>Abrir proyecto<ExternalLink size={13} /></Link></div></article>
    })}</div>{visible.length > pageSize && <div className="mt-3 overflow-hidden rounded-xl border border-[#e5e7eb]"><Pagination label="ubicaciones" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} page={page} pageSize={pageSize} total={visible.length} /></div>}</> : <div className="mt-3"><InventoryEmpty><div><MapPin className="mx-auto mb-2 text-[#98a2b3]" size={25} /><p>No hay ubicaciones que coincidan con los filtros.</p></div></InventoryEmpty></div>}
  </div></AppShell>
}
