import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, File, FileImage, Grid2X2, List, Plus, Trash2, UploadCloud, X } from 'lucide-react'
import { type DragEvent, type FormEvent, useRef, useState } from 'react'

import { Button } from '../../../components/common/Button'
import { Dialog } from '../../../components/common/Dialog'
import type { ProjectFile } from '../../../types/entities'
import { projectsApi } from '../../crud/api'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function ProjectFiles({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const client = useQueryClient()
  const files = useQuery({ queryKey: ['project-files', projectId], queryFn: () => projectsApi.files(projectId) })
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProjectFile | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const upload = useMutation({
    mutationFn: (data: FormData) => projectsApi.uploadFile(projectId, data, setProgress),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['project-files', projectId] })
      setProgress(0)
      setUploadOpen(false)
      setMessage('Archivo subido correctamente')
    },
    onError: (error: Error) => { setProgress(0); setMessage(error.message) },
  })
  const remove = useMutation({
    mutationFn: projectsApi.deleteFile,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['project-files', projectId] })
      setDeleteTarget(null)
      setMessage('Archivo eliminado definitivamente')
    },
    onError: (error: Error) => setMessage(error.message),
  })

  async function download(item: ProjectFile) {
    try {
      const blob = await projectsApi.downloadFile(item.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = item.original_name
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible descargar el archivo')
    }
  }

  return <section className="mt-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Archivos del proyecto</h2><p className="mt-1 text-xs text-[#667085]">Código, diagramas, imágenes, documentos y evidencias.</p></div><div className="flex gap-2"><div className="flex rounded-lg border border-[#d0d5dd] bg-white p-1"><button aria-label="Vista en cuadrícula" className={`rounded p-1.5 ${view === 'grid' ? 'bg-[#eaf3ff] text-[#1677ff]' : 'text-[#667085]'}`} onClick={() => setView('grid')} type="button"><Grid2X2 size={16} /></button><button aria-label="Vista en lista" className={`rounded p-1.5 ${view === 'list' ? 'bg-[#eaf3ff] text-[#1677ff]' : 'text-[#667085]'}`} onClick={() => setView('list')} type="button"><List size={16} /></button></div>{canWrite && <Button onClick={() => { setMessage(''); setUploadOpen(true) }}><Plus size={17} />Subir archivo</Button>}</div></div>
    {message && <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${message.includes('correctamente') || message.includes('eliminado') ? 'bg-[#e7f6ec] text-[#167543]' : 'bg-[#feeceb] text-[#b42318]'}`}>{message}</p>}
    {files.data?.length ? view === 'grid' ? <FileGrid canWrite={canWrite} files={files.data} onDelete={setDeleteTarget} onDownload={download} /> : <FileList canWrite={canWrite} files={files.data} onDelete={setDeleteTarget} onDownload={download} /> : <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-white p-12 text-center"><UploadCloud className="mx-auto text-[#98a2b3]" size={36} /><p className="mt-3 text-sm text-[#667085]">No hay archivos en este proyecto.</p></div>}
    <Dialog open={uploadOpen} title="Subir archivo" onClose={() => !upload.isPending && setUploadOpen(false)}><FileUploader pending={upload.isPending} progress={progress} onCancel={() => setUploadOpen(false)} onSubmit={(data) => upload.mutate(data)} /></Dialog>
    <FileDeleteDialog file={deleteTarget} pending={remove.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)} />
  </section>
}

function FileUploader({ pending, progress, onSubmit, onCancel }: { pending: boolean; progress: number; onSubmit: (data: FormData) => void; onCancel: () => void }) {
  const [file, setFile] = useState<globalThis.File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!file) return; const data = new FormData(event.currentTarget); data.set('upload', file); onSubmit(data) }
  return <form className="space-y-4" onSubmit={submit}><FileDropzone file={file} inputRef={input} onFile={setFile} /><input accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.md,.csv,.json,.yaml,.yml,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.ino,.c,.cpp,.py,.mp4,.webm" className="hidden" name="upload" onChange={(event) => setFile(event.target.files?.[0] ?? null)} ref={input} type="file" /><div><label className="mb-1.5 block text-sm font-medium text-[#344054]" htmlFor="file-description">Descripción</label><textarea className="min-h-20 w-full rounded-lg border border-[#d0d5dd] px-3 py-2 text-sm outline-none focus:border-[#1677ff]" id="file-description" maxLength={1000} name="description" /></div>{pending && <div><div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]"><div className="h-full bg-[#1677ff] transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-right text-xs text-[#667085]">{progress}%</p></div>}<p className="text-xs leading-5 text-[#667085]">Límite general: 25 MB. Video MP4 o WebM: 100 MB.</p><div className="flex justify-end gap-2"><Button disabled={pending} onClick={onCancel} type="button" variant="secondary">Cancelar</Button><Button disabled={!file || pending} type="submit">{pending ? 'Subiendo…' : 'Subir'}</Button></div></form>
}

function FileDropzone({ file, inputRef, onFile }: { file: globalThis.File | null; inputRef: React.RefObject<HTMLInputElement | null>; onFile: (file: globalThis.File | null) => void }) {
  function drop(event: DragEvent<HTMLButtonElement>) { event.preventDefault(); onFile(event.dataTransfer.files[0] ?? null) }
  return <button className="w-full rounded-xl border-2 border-dashed border-[#b9c8dc] bg-[#f8fbff] p-7 text-center transition hover:border-[#1677ff]" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={drop} type="button">{file ? <><File className="mx-auto text-[#1677ff]" size={32} /><p className="mt-2 break-all text-sm font-semibold">{file.name}</p><p className="mt-1 text-xs text-[#667085]">{formatBytes(file.size)}</p></> : <><UploadCloud className="mx-auto text-[#1677ff]" size={34} /><p className="mt-2 text-sm font-semibold">Arrastra un archivo o selecciónalo</p><p className="mt-1 text-xs text-[#667085]">El archivo se guarda en el almacenamiento privado del proyecto.</p></>}</button>
}

function FilePreview({ item }: { item: ProjectFile }) { const Icon = item.mime_type.startsWith('image/') ? FileImage : File; return <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-[#1677ff]"><Icon size={22} /></span> }
function FileCard({ item, canWrite, onDownload, onDelete }: { item: ProjectFile; canWrite: boolean; onDownload: () => void; onDelete: () => void }) { return <article className="rounded-xl border border-[#e2e8f0] bg-white p-4"><div className="flex gap-3"><FilePreview item={item} /><div className="min-w-0"><h3 className="truncate text-sm font-semibold" title={item.original_name}>{item.original_name}</h3><p className="mt-1 text-xs text-[#667085]">{formatBytes(item.size_bytes)} · {item.mime_type}</p></div></div>{item.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#667085]">{item.description}</p>}<p className="mt-3 text-[11px] text-[#98a2b3]">{item.uploaded_by_name} · {new Date(item.created_at).toLocaleString('es-CO')}</p><div className="mt-3 flex gap-2 border-t border-[#eaecf0] pt-3"><Button className="h-9" onClick={onDownload} variant="secondary"><Download size={15} />Descargar</Button>{canWrite && <Button className="h-9" onClick={onDelete} variant="ghost"><Trash2 size={15} /></Button>}</div></article> }
function FileGrid({ files, canWrite, onDownload, onDelete }: { files: ProjectFile[]; canWrite: boolean; onDownload: (item: ProjectFile) => void; onDelete: (item: ProjectFile) => void }) { return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{files.map((item) => <FileCard canWrite={canWrite} item={item} key={item.id} onDelete={() => onDelete(item)} onDownload={() => onDownload(item)} />)}</div> }
function FileList({ files, canWrite, onDownload, onDelete }: { files: ProjectFile[]; canWrite: boolean; onDownload: (item: ProjectFile) => void; onDelete: (item: ProjectFile) => void }) { return <div className="divide-y divide-[#eaecf0] overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">{files.map((item) => <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" key={item.id}><FilePreview item={item} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.original_name}</p><p className="mt-1 text-xs text-[#667085]">{formatBytes(item.size_bytes)} · {item.uploaded_by_name} · {new Date(item.created_at).toLocaleString('es-CO')}</p></div><div className="flex gap-2"><Button className="h-9" onClick={() => onDownload(item)} variant="secondary"><Download size={15} />Descargar</Button>{canWrite && <Button className="size-9 px-0" onClick={() => onDelete(item)} variant="ghost"><Trash2 size={15} /></Button>}</div></div>)}</div> }
function FileDeleteDialog({ file, pending, onCancel, onConfirm }: { file: ProjectFile | null; pending: boolean; onCancel: () => void; onConfirm: () => void }) { return <Dialog open={Boolean(file)} title="Eliminar archivo definitivamente" onClose={onCancel}><div className="space-y-4"><div className="flex gap-3 rounded-lg bg-[#fff4e5] p-3 text-sm text-[#8a4b12]"><X className="shrink-0" size={19} /><p>Se eliminarán el registro y el archivo físico. Esta acción no se puede deshacer.</p></div><p className="break-all text-sm font-semibold">{file?.original_name}</p><div className="flex justify-end gap-2"><Button disabled={pending} onClick={onCancel} variant="secondary">Cancelar</Button><Button disabled={pending} onClick={onConfirm} variant="danger">{pending ? 'Eliminando…' : 'Eliminar definitivamente'}</Button></div></div></Dialog> }
