import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, FileText, Plus, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '../../../components/common/Button'
import { Dialog } from '../../../components/common/Dialog'
import { InputField, TextareaField } from '../../../components/common/FormField'
import { projectsApi } from '../../crud/api'

export function ProjectDocumentation({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const client = useQueryClient()
  const documents = useQuery({ queryKey: ['documents', projectId], queryFn: () => projectsApi.documents(projectId) })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [message, setMessage] = useState('')
  const selected = documents.data?.find((document) => document.id === selectedId) ?? documents.data?.[0]

  const createDocument = useMutation({
    mutationFn: (payload: Record<string, unknown>) => projectsApi.createDocument(projectId, payload),
    onSuccess: async (document) => {
      await client.invalidateQueries({ queryKey: ['documents', projectId] })
      setSelectedId(document.id)
      setCreateOpen(false)
      setMessage('Sección creada')
    },
    onError: (error: Error) => setMessage(error.message),
  })
  const saveDocument = useMutation({
    mutationFn: (payload: { title: string; content: string }) => projectsApi.updateDocument(selected!.id, payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['documents', projectId] })
      setMessage('Cambios guardados')
    },
    onError: (error: Error) => setMessage(error.message),
  })
  const deleteDocument = useMutation({
    mutationFn: projectsApi.deleteDocument,
    onSuccess: async () => {
      setSelectedId(null)
      await client.invalidateQueries({ queryKey: ['documents', projectId] })
      setMessage('Sección eliminada')
    },
    onError: (error: Error) => setMessage(error.message),
  })
  const reorder = useMutation({
    mutationFn: (ids: string[]) => projectsApi.reorderDocuments(projectId, ids),
    onSuccess: () => client.invalidateQueries({ queryKey: ['documents', projectId] }),
    onError: (error: Error) => setMessage(error.message),
  })

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    createDocument.mutate({ title: data.get('title'), content: data.get('content') || '' })
  }

  function move(index: number, direction: -1 | 1) {
    const ids = (documents.data ?? []).map((document) => document.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder.mutate(ids)
  }

  return <section className="mt-5">
    <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Documentación del proyecto</h2><p className="mt-1 text-xs text-[#667085]">Secciones técnicas ordenadas y editables.</p></div>{canWrite && <Button onClick={() => { setMessage(''); setCreateOpen(true) }}><Plus size={17} />Nueva sección</Button>}</div>
    {message && <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${message.includes('guardad') || message.includes('creada') || message.includes('eliminada') ? 'bg-[#e7f6ec] text-[#167543]' : 'bg-[#feeceb] text-[#b42318]'}`}>{message}</p>}
    <div className="grid min-h-[480px] overflow-hidden rounded-xl border border-[#e2e8f0] bg-white lg:grid-cols-[270px_minmax(0,1fr)]">
      <DocumentationNavigation canWrite={canWrite} documents={documents.data ?? []} selectedId={selected?.id} onMove={move} onSelect={setSelectedId} />
      {selected ? <DocumentationEditor canWrite={canWrite} document={selected} key={selected.id} pending={saveDocument.isPending} onDelete={() => confirm('¿Eliminar esta sección de documentación?') && deleteDocument.mutate(selected.id)} onSave={(payload) => saveDocument.mutate(payload)} /> : <div className="grid place-items-center p-10 text-center"><div><FileText className="mx-auto text-[#98a2b3]" size={34} /><p className="mt-3 text-sm text-[#667085]">No hay secciones de documentación.</p></div></div>}
    </div>
    <Dialog open={createOpen} title="Nueva sección" onClose={() => setCreateOpen(false)}><form className="space-y-4" onSubmit={create}><InputField label="Título" name="title" placeholder="Arquitectura del sistema" required /><TextareaField label="Contenido inicial" name="content" rows={10} /><div className="flex justify-end gap-2"><Button onClick={() => setCreateOpen(false)} type="button" variant="secondary">Cancelar</Button><Button disabled={createDocument.isPending} type="submit">Crear sección</Button></div></form></Dialog>
  </section>
}

function DocumentationNavigation({ documents, selectedId, canWrite, onSelect, onMove }: { documents: Array<{ id: string; title: string }>; selectedId?: string; canWrite: boolean; onSelect: (id: string) => void; onMove: (index: number, direction: -1 | 1) => void }) {
  return <nav className="border-b border-[#e2e8f0] bg-[#f8fafc] p-3 lg:border-b-0 lg:border-r"><p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#98a2b3]">Secciones</p><div className="space-y-1">{documents.map((document, index) => <div className={`group flex items-center rounded-lg ${selectedId === document.id ? 'bg-[#eaf3ff]' : 'hover:bg-white'}`} key={document.id}><button className={`min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm font-medium ${selectedId === document.id ? 'text-[#1677ff]' : 'text-[#344054]'}`} onClick={() => onSelect(document.id)} type="button">{document.title}</button>{canWrite && <div className="mr-1 flex opacity-0 group-hover:opacity-100"><button aria-label="Subir sección" className="p-1 text-[#667085] disabled:opacity-20" disabled={index === 0} onClick={() => onMove(index, -1)} type="button"><ChevronUp size={14} /></button><button aria-label="Bajar sección" className="p-1 text-[#667085] disabled:opacity-20" disabled={index === documents.length - 1} onClick={() => onMove(index, 1)} type="button"><ChevronDown size={14} /></button></div>}</div>)}</div></nav>
}

function DocumentationEditor({ document, pending, canWrite, onSave, onDelete }: { document: { title: string; content: string }; pending: boolean; canWrite: boolean; onSave: (payload: { title: string; content: string }) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(document.title)
  const [content, setContent] = useState(document.content)
  return <div className="flex min-w-0 flex-col"><div className="flex flex-col gap-3 border-b border-[#e2e8f0] p-4 sm:flex-row sm:items-center"><input className="min-w-0 flex-1 rounded-lg border border-[#d0d5dd] px-3 py-2 text-lg font-semibold outline-none read-only:border-transparent focus:border-[#1677ff]" maxLength={180} onChange={(event) => setTitle(event.target.value)} readOnly={!canWrite} value={title} />{canWrite && <div className="flex gap-2"><Button onClick={onDelete} variant="danger"><Trash2 size={15} />Eliminar</Button><Button disabled={pending || title.trim().length < 2} onClick={() => onSave({ title, content })}><Save size={15} />{pending ? 'Guardando…' : 'Guardar'}</Button></div>}</div><textarea className="min-h-[410px] flex-1 resize-y border-0 p-5 font-mono text-sm leading-6 outline-none" maxLength={200000} onChange={(event) => setContent(event.target.value)} placeholder="Describe el montaje, arquitectura, conexiones y decisiones del proyecto…" readOnly={!canWrite} value={content} /></div>
}
