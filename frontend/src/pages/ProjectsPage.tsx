import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowRight, Cpu, FolderKanban, Pencil, Plus, Users } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '../components/common/Button'
import { Dialog } from '../components/common/Dialog'
import { InputField, SelectField, TextareaField } from '../components/common/FormField'
import { AppShell } from '../components/layout/AppShell'
import { devicesApi, projectsApi } from '../features/crud/api'
import { InventoryHeader, Pagination } from '../features/inventory/InventoryUi'
import { ApiError } from '../services/api'
import type { Project } from '../types/entities'

export function ProjectsPage() {
  const client = useQueryClient()
  const [searchParams] = useSearchParams()
  const projects = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })
  const deviceQueries = useQueries({ queries: (projects.data ?? []).map((project) => ({ queryKey: ['devices', project.id], queryFn: () => devicesApi.list(project.id) })) })
  const memberQueries = useQueries({ queries: (projects.data ?? []).map((project) => ({ queryKey: ['members', project.id], queryFn: () => projectsApi.members(project.id) })) })
  const [editing, setEditing] = useState<Project | null>(null)
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get('crear') === '1')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => id ? projectsApi.update(id, payload) : projectsApi.create(payload),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['projects'] }); setDialogOpen(false); setEditing(null) },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'No fue posible guardar el proyecto'),
  })
  const archive = useMutation({ mutationFn: projectsApi.archive, onSuccess: () => client.invalidateQueries({ queryKey: ['projects'] }) })

  function openForm(project: Project | null = null) { setEditing(project); setError(''); setDialogOpen(true) }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    save.mutate({ id: editing?.id, payload: { name: data.get('name'), description: data.get('description'), summary: data.get('summary') || null, ...(editing ? { status: data.get('status') } : {}) } })
  }
  const searchTerm = (searchParams.get('buscar') ?? '').trim().toLocaleLowerCase('es')
  const visibleProjects = projects.data?.filter((project) => !searchTerm || `${project.name} ${project.description} ${project.summary ?? ''}`.toLocaleLowerCase('es').includes(searchTerm)) ?? []
  const pageItems = visibleProjects.slice((page - 1) * pageSize, page * pageSize)
  const dateFormatter = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  const deviceCounts = new Map((projects.data ?? []).map((project, index) => [project.id, deviceQueries[index]?.data?.length ?? 0]))
  const memberCounts = new Map((projects.data ?? []).map((project, index) => [project.id, memberQueries[index]?.data?.length ?? 0]))

  useEffect(() => setPage(1), [searchTerm])

  return (
    <AppShell>
      <div className="mx-auto max-w-[1460px]">
        <InventoryHeader actions={<Button onClick={() => openForm()}><Plus size={16} />Nuevo proyecto</Button>} description="Administra los proyectos, sus dispositivos y el equipo de trabajo." title="Proyectos" />
        {searchTerm && <p className="mt-4 text-xs text-[#667085]">Resultados para <strong className="text-[#344054]">“{searchParams.get('buscar')}”</strong></p>}
        {projects.isLoading && <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div className="h-52 animate-pulse rounded-xl border border-[#e2e8f0] bg-white" key={item} />)}</div>}
        {projects.isError && <div className="mt-8 flex items-center justify-between rounded-xl border border-[#fecdca] bg-[#fff7f6] p-4"><p className="text-sm text-[#b42318]">No fue posible cargar los proyectos.</p><Button onClick={() => projects.refetch()} variant="secondary">Reintentar</Button></div>}
        {projects.data?.length === 0 && <div className="mt-6 grid min-h-56 place-items-center rounded-xl border border-dashed border-[#cbd5e1] bg-white p-6 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-[#eaf3ff] text-[#1677ff]"><FolderKanban size={22} /></span><h2 className="mt-3 text-sm font-semibold">Aún no hay proyectos</h2><p className="mt-1 text-xs text-[#667085]">Crea el primero para agregar ubicaciones y dispositivos.</p><Button className="mt-4" onClick={() => openForm()}><Plus size={16} />Crear proyecto</Button></div></div>}
        {!projects.isLoading && projects.data?.length !== 0 && visibleProjects.length === 0 && <div className="mt-6 rounded-xl border border-dashed border-[#cbd5e1] bg-white p-8 text-center text-sm text-[#667085]">No hay proyectos que coincidan con la búsqueda.</div>}
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((project) => <article className="group relative flex min-h-[268px] flex-col overflow-hidden rounded-2xl border border-[#dce3ea] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9bc7ff] hover:shadow-[0_10px_26px_rgba(16,24,40,.09)] sm:p-5" key={project.id}>
            <Link aria-label={`Abrir proyecto ${project.name}`} className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[#0b6ffb]/35" to={`/app/proyectos/${project.id}`} />
            <div className="pointer-events-none relative z-10 flex items-start gap-3.5"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-[#1677ff] transition group-hover:bg-[#1677ff] group-hover:text-white"><FolderKanban size={20} /></span><div className="min-w-0 flex-1"><h2 className="truncate text-[16px] font-semibold leading-5 text-[#102033]">{project.name}</h2><span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${project.status === 'activo' ? 'bg-[#e7f6ec] text-[#167543]' : 'bg-[#f2f4f7] text-[#667085]'}`}><span className="size-1.5 rounded-full bg-current" />{project.status}</span></div><ArrowRight className="mt-1 shrink-0 text-[#98a2b3] transition group-hover:translate-x-1 group-hover:text-[#1677ff]" size={17} /></div>
            <div className="pointer-events-none relative z-10 mt-4 flex flex-1 flex-col"><p className="line-clamp-2 min-h-10 text-[12px] leading-5 text-[#617184]">{project.description || 'Sin descripción'}</p><p className={`mt-3 line-clamp-2 rounded-[10px] bg-[#f3f6fa] px-3 py-2 text-[11px] leading-4 ${project.summary ? 'text-[#34465a]' : 'italic text-[#8795a5]'}`}>{project.summary || 'Sin resumen técnico'}</p><div className="mt-auto flex flex-wrap items-center gap-4 pt-4 text-[11px] text-[#617184]"><span className="inline-flex items-center gap-1.5"><Cpu size={14} /><strong className="font-semibold text-[#102033]">{deviceCounts.get(project.id) ?? 0}</strong> dispositivos</span><span className="inline-flex items-center gap-1.5"><Users size={14} /><strong className="font-semibold text-[#102033]">{memberCounts.get(project.id) ?? 0}</strong> miembros</span></div></div>
            <footer className="pointer-events-none relative z-10 mt-4 flex items-center gap-1 border-t border-[#e5eaf0] pt-3"><span className="min-w-0 flex-1 truncate text-[10px] text-[#8795a5]">Actualizado el {dateFormatter.format(new Date(project.updated_at))}</span><button aria-label={`Editar ${project.name}`} className="pointer-events-auto grid size-9 place-items-center rounded-lg text-[#617184] hover:bg-[#eef3f8] hover:text-[#102033]" onClick={() => openForm(project)} title="Editar" type="button"><Pencil size={15} /></button><button aria-label={`Archivar ${project.name}`} className="pointer-events-auto grid size-9 place-items-center rounded-lg text-[#617184] hover:bg-[#fff0ef] hover:text-[#c9342b]" onClick={() => confirm('¿Archivar este proyecto?') && archive.mutate(project.id)} title="Archivar" type="button"><Archive size={15} /></button><Link className="pointer-events-auto ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1677ff] px-3 text-[11px] font-semibold text-white hover:bg-[#0f63d8]" to={`/app/proyectos/${project.id}`}>Abrir<ArrowRight size={13} /></Link></footer>
          </article>)}
        </div>
        {visibleProjects.length > pageSize && <div className="mt-3 overflow-hidden rounded-xl border border-[#e5e7eb]"><Pagination label="proyectos" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} page={page} pageSize={pageSize} total={visibleProjects.length} /></div>}
      </div>
      <Dialog open={dialogOpen} title={editing ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={() => setDialogOpen(false)}><form className="space-y-4" onSubmit={submit}><InputField defaultValue={editing?.name} label="Nombre" name="name" required /><TextareaField defaultValue={editing?.description} label="Descripción" name="description" /> <TextareaField defaultValue={editing?.summary ?? ''} label="Resumen" name="summary" />{editing && <SelectField defaultValue={editing.status} label="Estado" name="status"><option value="borrador">Borrador</option><option value="activo">Activo</option><option value="finalizado">Finalizado</option><option value="archivado">Archivado</option></SelectField>}{error && <p className="text-sm text-[#b42318]">{error}</p>}<div className="flex justify-end gap-2"><Button onClick={() => setDialogOpen(false)} type="button" variant="secondary">Cancelar</Button><Button disabled={save.isPending} type="submit">{save.isPending ? 'Guardando…' : 'Guardar'}</Button></div></form></Dialog>
    </AppShell>
  )
}
