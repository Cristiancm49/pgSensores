import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, Cpu, FolderOpen, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AuthenticatedImage } from '../components/common/AuthenticatedImage'
import { Button } from '../components/common/Button'
import { Dialog } from '../components/common/Dialog'
import { InputField, SelectField, TextareaField } from '../components/common/FormField'
import { HardwareVisual } from '../components/common/HardwareVisual'
import { AppShell } from '../components/layout/AppShell'
import { devicesApi, locationsApi, projectsApi } from '../features/crud/api'
import { ProjectDocumentation } from '../features/projects/components/ProjectDocumentation'
import { ProjectFiles } from '../features/projects/components/ProjectFiles'
import { useProjectPermissions } from '../features/projects/useProjectPermissions'
import { ApiError } from '../services/api'
import type { Device, Location, ProjectMember } from '../types/entities'

type Tab = 'devices' | 'locations' | 'members' | 'documentation' | 'files'

function Notice({ text }: { text: string }) { return <p className="rounded-lg bg-[#feeceb] px-3 py-2 text-sm text-[#b42318]">{text}</p> }

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const client = useQueryClient()
  const [tab, setTab] = useState<Tab>('devices')
  const [dialog, setDialog] = useState<'device' | 'location' | 'member' | null>(null)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null)
  const [error, setError] = useState('')
  const permissions = useProjectPermissions(projectId)
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => projectsApi.get(projectId) })
  const locations = useQuery({ queryKey: ['locations', projectId], queryFn: () => locationsApi.list(projectId) })
  const devices = useQuery({ queryKey: ['devices', projectId], queryFn: () => devicesApi.list(projectId) })
  const members = useQuery({ queryKey: ['members', projectId], queryFn: () => projectsApi.members(projectId) })

  const saveLocation = useMutation({ mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => id ? locationsApi.update(id, payload) : locationsApi.create(projectId, payload), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['locations', projectId] }); closeDialog() }, onError: showError })
  const removeLocation = useMutation({ mutationFn: locationsApi.remove, onSuccess: () => client.invalidateQueries({ queryKey: ['locations', projectId] }), onError: showError })
  const saveDevice = useMutation({ mutationFn: (payload: Record<string, unknown>) => devicesApi.create(projectId, payload), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['devices', projectId] }); closeDialog() }, onError: showError })
  const deactivateDevice = useMutation({ mutationFn: devicesApi.deactivate, onSuccess: () => client.invalidateQueries({ queryKey: ['devices', projectId] }), onError: showError })
  const saveMember = useMutation({ mutationFn: (payload: Record<string, unknown>) => editingMember ? projectsApi.updateMember(projectId, editingMember.user_id, payload) : projectsApi.addMember(projectId, payload), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['members', projectId] }); closeDialog() }, onError: showError })
  const removeMember = useMutation({ mutationFn: (userId: string) => projectsApi.removeMember(projectId, userId), onSuccess: () => client.invalidateQueries({ queryKey: ['members', projectId] }), onError: showError })

  function showError(reason: Error) { setError(reason instanceof ApiError ? reason.message : 'No fue posible completar la operación') }
  function closeDialog() { setDialog(null); setEditingLocation(null); setEditingMember(null); setError('') }
  function openDialog(name: typeof dialog) { setError(''); setDialog(name) }
  function submitLocation(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); saveLocation.mutate({ id: editingLocation?.id, payload: { name: data.get('name'), description: data.get('description') || null } }) }
  function submitDevice(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); saveDevice.mutate({ name: data.get('name'), description: data.get('description') || null, board_type: data.get('board_type'), connection_type: data.get('connection_type'), device_identifier: data.get('device_identifier'), location_id: data.get('location_id') || null, firmware_version: data.get('firmware_version') || null }) }
  function submitMember(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); saveMember.mutate({ ...(!editingMember ? { username: data.get('username') } : {}), role_code: data.get('role_code') }) }

  if (project.isLoading) return <AppShell><p className="text-sm text-[#667085]">Cargando proyecto…</p></AppShell>
  if (!project.data) return <AppShell><Notice text="No fue posible encontrar el proyecto." /></AppShell>

  return <AppShell><div className="mx-auto max-w-[1400px]">
    <Link className="inline-flex items-center gap-1 text-sm font-medium text-[#667085] hover:text-[#1677ff]" to="/app/proyectos"><ArrowLeft size={16} />Proyectos</Link>
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-[#eaf3ff] text-[#1677ff]"><Cpu size={20} /></span><div><h1 className="text-[22px] font-bold">{project.data.name}</h1><p className="mt-0.5 text-[13px] text-[#667085]">{project.data.description || 'Sin descripción'}</p></div></div></div><span className="self-start rounded-full bg-[#e7f6ec] px-2.5 py-1 text-[11px] font-medium capitalize text-[#167543]">{project.data.status}</span></div>
    <div className="mt-5 flex gap-1 overflow-x-auto border-b border-[#dfe5eb]">{([{ id: 'devices', label: 'Dispositivos', icon: Cpu }, { id: 'locations', label: 'Ubicaciones', icon: MapPin }, { id: 'members', label: 'Integrantes', icon: Users }, { id: 'documentation', label: 'Documentación', icon: BookOpen }, { id: 'files', label: 'Archivos', icon: FolderOpen }] as const).map(({ id, label, icon: Icon }) => <button className={`flex h-10 items-center gap-2 border-b-2 px-3 text-[13px] font-medium ${tab === id ? 'border-[#1677ff] text-[#1677ff]' : 'border-transparent text-[#667085]'}`} key={id} onClick={() => { setTab(id); setError('') }} type="button"><Icon size={15} />{label}</button>)}</div>
    {error && <div className="mt-4"><Notice text={error} /></div>}

    {tab === 'devices' && <section className="mt-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Dispositivos del proyecto</h2><p className="mt-1 text-xs text-[#667085]">Equipos físicos y simulados.</p></div>{permissions.canWrite && <Button onClick={() => openDialog('device')}><Plus size={17} />Agregar dispositivo</Button>}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{devices.data?.map((device) => <DeviceCard canWrite={permissions.canWrite} device={device} key={device.id} onDeactivate={() => confirm('¿Desactivar este dispositivo?') && deactivateDevice.mutate(device.id)} location={locations.data?.find((item) => item.id === device.location_id)} />)}{devices.data?.length === 0 && <Empty text="No hay dispositivos en este proyecto." />}</div></section>}

    {tab === 'locations' && <section className="mt-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Ubicaciones</h2><p className="mt-1 text-xs text-[#667085]">Áreas donde se instalan los equipos.</p></div><Button onClick={() => openDialog('location')}><Plus size={17} />Nueva ubicación</Button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{locations.data?.map((location) => <article className="rounded-xl border border-[#e2e8f0] bg-white p-4" key={location.id}><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-lg bg-[#eaf3ff] text-[#1677ff]"><MapPin size={19} /></span><div className="min-w-0 flex-1"><h3 className="font-semibold">{location.name}</h3><p className="mt-1 text-sm text-[#667085]">{location.description || 'Sin descripción'}</p></div><Button className="size-8 px-0" onClick={() => { setEditingLocation(location); openDialog('location') }} variant="ghost"><Pencil size={15} /></Button><Button className="size-8 px-0" onClick={() => confirm('¿Eliminar esta ubicación?') && removeLocation.mutate(location.id)} variant="ghost"><Trash2 size={15} /></Button></div></article>)}{locations.data?.length === 0 && <Empty text="No hay ubicaciones creadas." />}</div></section>}

    {tab === 'members' && <section className="mt-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Integrantes</h2><p className="mt-1 text-xs text-[#667085]">Personas con acceso al proyecto.</p></div><Button onClick={() => openDialog('member')}><Plus size={17} />Agregar integrante</Button></div><div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]"><tr><th className="px-4 py-3">Persona</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-[#eaecf0]">{members.data?.map((member) => <tr key={member.user_id}><td className="px-4 py-3"><p className="font-semibold">{member.full_name}</p><p className="text-xs text-[#667085]">@{member.username}</p></td><td className="px-4 py-3 capitalize">{member.role_name}</td><td className="px-4 py-3"><div className="flex justify-end gap-1">{member.role_code !== 'propietario' && <><Button className="size-8 px-0" onClick={() => { setEditingMember(member); openDialog('member') }} variant="ghost"><Pencil size={15} /></Button><Button className="size-8 px-0" onClick={() => confirm('¿Quitar este integrante?') && removeMember.mutate(member.user_id)} variant="ghost"><Trash2 size={15} /></Button></>}</div></td></tr>)}</tbody></table></div></section>}
    {tab === 'documentation' && <ProjectDocumentation canWrite={permissions.canWrite} projectId={projectId} />}
    {tab === 'files' && <ProjectFiles canWrite={permissions.canWrite} projectId={projectId} />}
  </div>

  <Dialog open={dialog === 'location'} title={editingLocation ? 'Editar ubicación' : 'Nueva ubicación'} onClose={closeDialog}><form className="space-y-4" onSubmit={submitLocation}><InputField defaultValue={editingLocation?.name} label="Nombre" name="name" required /><TextareaField defaultValue={editingLocation?.description ?? ''} label="Descripción" name="description" />{error && <Notice text={error} />}<Actions close={closeDialog} pending={saveLocation.isPending} /></form></Dialog>
  <Dialog open={dialog === 'device'} title="Agregar dispositivo" onClose={closeDialog}><form className="space-y-4" onSubmit={submitDevice}><InputField label="Nombre" name="name" required /><InputField label="Identificador único" name="device_identifier" placeholder="esp32-bodega-01" required /><div className="grid gap-4 sm:grid-cols-2"><SelectField defaultValue="ESP32" label="Tipo de placa" name="board_type"><option>ESP32</option><option>Arduino</option><option>Otro</option></SelectField><SelectField defaultValue="mqtt_directo" label="Conexión" name="connection_type"><option value="mqtt_directo">MQTT directo → Mosquitto</option><option value="simulador">Simulador → Mosquitto</option></SelectField></div><SelectField label="Ubicación" name="location_id"><option value="">Sin ubicación</option>{locations.data?.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</SelectField><InputField label="Firmware opcional" name="firmware_version" /><TextareaField label="Descripción" name="description" />{error && <Notice text={error} />}<Actions close={closeDialog} pending={saveDevice.isPending} /></form></Dialog>
  <Dialog open={dialog === 'member'} title={editingMember ? 'Cambiar rol' : 'Agregar integrante'} onClose={closeDialog}><form className="space-y-4" onSubmit={submitMember}>{!editingMember && <InputField label="Nombre de usuario" name="username" placeholder="jperez23" required />}<SelectField defaultValue={editingMember?.role_code ?? 'editor'} label="Rol" name="role_code"><option value="editor">Editor</option><option value="visualizador">Visualizador</option></SelectField>{error && <Notice text={error} />}<Actions close={closeDialog} pending={saveMember.isPending} /></form></Dialog>
  </AppShell>
}

function Empty({ text }: { text: string }) { return <div className="col-span-full rounded-xl border border-dashed border-[#cbd5e1] bg-white p-6 text-center text-sm text-[#667085]">{text}</div> }
function Actions({ close, pending }: { close: () => void; pending: boolean }) { return <div className="flex justify-end gap-2"><Button onClick={close} type="button" variant="secondary">Cancelar</Button><Button disabled={pending} type="submit">{pending ? 'Guardando…' : 'Guardar'}</Button></div> }
function DeviceCard({ device, location, canWrite, onDeactivate }: { device: Device; location?: Location; canWrite: boolean; onDeactivate: () => void }) {
  const statusStyle = device.status === 'conectado'
    ? 'bg-[#e8f7ef]/95 text-[#137a49]'
    : device.status === 'error'
      ? 'bg-[#fff0ef]/95 text-[#ad2c25]'
      : 'bg-[#eef3f8]/95 text-[#617184]'
  return <article className="group overflow-hidden rounded-[14px] border border-[#dce3ea] bg-white shadow-[0_1px_3px_rgba(16,32,51,.05)] transition hover:border-[#b9d5f4] hover:shadow-[0_9px_26px_rgba(16,32,51,.09)]">
    <div className="relative p-3 pb-0">
      <AuthenticatedImage
        alt={device.name}
        className="h-32 w-full rounded-[11px]"
        fallback={<HardwareVisual boardType={device.board_type} className="h-32 w-full rounded-[11px]" kind="device" label={device.name} />}
        load={() => devicesApi.image(device.id)}
        queryKey={['device', device.id]}
      />
      <span className={`absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-white/80 px-2.5 py-1 text-[10px] font-semibold capitalize shadow-sm backdrop-blur ${statusStyle}`}><span className="size-1.5 rounded-full bg-current" />{device.status}</span>
    </div>
    <div className="p-3.5 pt-3"><h3 className="truncate text-[15px] font-semibold text-[#102033]">{device.name}</h3><p className="mt-1 truncate text-[11px] text-[#617184]">{device.board_type} · {device.device_identifier}</p><p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#617184]"><MapPin size={13} />{location?.name || 'Sin ubicación'}</p><div className="mt-3 flex items-center justify-between gap-2 border-t border-[#edf1f5] pt-3">{canWrite ? <Button className="h-8 px-2.5" disabled={device.status === 'inactivo'} onClick={onDeactivate} variant="ghost">Desactivar</Button> : <span />}<Link className="inline-flex h-8 items-center rounded-lg bg-[#0b6ffb] px-3 text-xs font-semibold text-white hover:bg-[#075ccb]" to={`/app/dispositivos/${device.id}`}>{canWrite ? 'Administrar' : 'Ver'}</Link></div></div>
  </article>
}
