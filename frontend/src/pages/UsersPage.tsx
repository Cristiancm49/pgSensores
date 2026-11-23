import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { Button } from '../components/common/Button'
import { Dialog } from '../components/common/Dialog'
import { InputField } from '../components/common/FormField'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../features/auth/AuthContext'
import { usersApi } from '../features/crud/api'
import { InventoryHeader, InventoryToolbar, Pagination } from '../features/inventory/InventoryUi'
import { ApiError } from '../services/api'
import type { User } from '../types/entities'

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: currentUser?.is_admin })
  const [editing, setEditing] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => id ? usersApi.update(id, payload) : usersApi.create(payload),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['users'] }); setOpen(false); setEditing(null) },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : 'No fue posible guardar el usuario'),
  })

  function show(user: User | null = null) { setEditing(user); setError(''); setOpen(true) }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') || '')
    save.mutate({ id: editing?.id, payload: editing ? { full_name: data.get('full_name'), email: data.get('email') || null, is_admin: data.get('is_admin') === 'on', ...(password ? { password } : {}) } : { username: data.get('username'), full_name: data.get('full_name'), email: data.get('email') || null, password, is_admin: data.get('is_admin') === 'on' } })
  }
  const visibleUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return (users.data ?? []).filter((user) => !term || `${user.full_name} ${user.username} ${user.email ?? ''}`.toLocaleLowerCase('es').includes(term))
  }, [search, users.data])
  const pageItems = visibleUsers.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => setPage(1), [search])

  if (!currentUser?.is_admin) return <Navigate to="/app/inicio" replace />

  return <AppShell><div className="mx-auto max-w-[1400px]">
    <InventoryHeader actions={<Button onClick={() => show()}><Plus size={16} />Agregar usuario</Button>} description="Administra el acceso a la plataforma." title="Usuarios" />
    <InventoryToolbar onSearch={setSearch} placeholder="Buscar por nombre, usuario o correo..." search={search} />
    <div className="mt-3 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(16,24,40,.05)]"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-[#667085]"><tr><th className="px-4 py-2.5">Usuario</th><th className="px-4 py-2.5">Correo</th><th className="px-4 py-2.5">Rol</th><th className="px-4 py-2.5">Estado</th><th className="px-4 py-2.5 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-[#eaecf0]">
      {pageItems.map((user) => <tr className="hover:bg-[#fbfdff]" key={user.id}><td className="px-4 py-3"><p className="text-[13px] font-semibold">{user.full_name}</p><p className="text-[11px] text-[#667085]">@{user.username}</p></td><td className="px-4 py-3 text-[13px] text-[#475467]">{user.email || '—'}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2.5 py-1 text-xs text-[#0f63d8]">{user.is_admin && <ShieldCheck size={13} />}{user.is_admin ? 'Administrador' : 'Usuario'}</span></td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${user.active ? 'bg-[#e7f6ec] text-[#167543]' : 'bg-[#f2f4f7] text-[#667085]'}`}>{user.active ? <UserRoundCheck size={13} /> : <UserRoundX size={13} />}{user.active ? 'Activo' : 'Inactivo'}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button aria-label={`Editar a ${user.full_name}`} className="size-8 px-0" onClick={() => show(user)} variant="ghost"><Pencil size={15} /></Button><Button className="h-8 px-3" disabled={user.id === currentUser.id} onClick={() => save.mutate({ id: user.id, payload: { active: !user.active } })} variant="secondary">{user.active ? 'Desactivar' : 'Activar'}</Button></div></td></tr>)}
      {visibleUsers.length === 0 && <tr><td className="px-5 py-10 text-center text-sm text-[#667085]" colSpan={5}>{search ? 'No hay usuarios que coincidan con la búsqueda.' : 'No hay usuarios registrados.'}</td></tr>}
    </tbody></table></div><Pagination label="usuarios" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} page={page} pageSize={pageSize} total={visibleUsers.length} /></div>
  </div><Dialog open={open} title={editing ? 'Editar usuario' : 'Agregar usuario'} onClose={() => setOpen(false)}><form className="space-y-4" onSubmit={submit}>{!editing && <InputField label="Nombre de usuario" name="username" pattern="[a-zA-Z0-9_.-]+" required />}<InputField defaultValue={editing?.full_name} label="Nombre completo" name="full_name" required /><InputField defaultValue={editing?.email ?? ''} label="Correo opcional" name="email" type="email" /><InputField label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'} minLength={8} name="password" required={!editing} type="password" /><label className="flex items-center gap-2 text-sm font-medium text-[#344054]"><input defaultChecked={editing?.is_admin} name="is_admin" type="checkbox" />Administrador</label>{error && <p className="text-sm text-[#b42318]">{error}</p>}<div className="flex justify-end gap-2"><Button onClick={() => setOpen(false)} type="button" variant="secondary">Cancelar</Button><Button disabled={save.isPending} type="submit">Guardar</Button></div></form></Dialog></AppShell>
}
