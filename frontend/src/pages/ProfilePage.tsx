import { zodResolver } from '@hookform/resolvers/zod'
import { Save, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '../components/common/Button'
import { AppShell } from '../components/layout/AppShell'
import { useAuth } from '../features/auth/AuthContext'

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Escribe tu nombre').max(160),
  email: z.union([z.literal(''), z.email('Correo inválido')]),
  password: z.union([z.literal(''), z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128)]),
})

type ProfileForm = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.full_name ?? '', email: user?.email ?? '', password: '' },
  })
  const success = form.formState.isSubmitSuccessful && !form.formState.isSubmitting

  async function submit(values: ProfileForm) {
    try {
      await updateProfile({ full_name: values.full_name, email: values.email || null, ...(values.password ? { password: values.password } : {}) })
      form.reset({ ...values, password: '' })
    } catch (error) {
      form.setError('root', { message: error instanceof Error ? error.message : 'No fue posible actualizar el perfil' })
    }
  }

  return <AppShell><div className="mx-auto max-w-3xl"><div><h1 className="text-[26px] font-bold leading-8">Mi perfil</h1><p className="mt-0.5 text-sm text-[#667085]">Actualiza tus datos personales y contraseña.</p></div><section className="mt-4 rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5"><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#eaf3ff] text-[#1677ff]"><UserRound size={19} /></span><div><p className="text-sm font-semibold">@{user?.username}</p><p className="text-xs text-[#667085]">{user?.is_admin ? 'Administrador' : 'Usuario de UDLAIoT'}</p></div></div><form className="space-y-3.5" onSubmit={form.handleSubmit(submit)}><Field error={form.formState.errors.full_name?.message} label="Nombre completo"><input className="h-9 w-full rounded-lg border border-[#d0d5dd] px-3 text-[13px] outline-none focus:border-[#1677ff]" {...form.register('full_name')} /></Field><Field error={form.formState.errors.email?.message} label="Correo opcional"><input className="h-9 w-full rounded-lg border border-[#d0d5dd] px-3 text-[13px] outline-none focus:border-[#1677ff]" type="email" {...form.register('email')} /></Field><Field error={form.formState.errors.password?.message} label="Nueva contraseña"><input autoComplete="new-password" className="h-9 w-full rounded-lg border border-[#d0d5dd] px-3 text-[13px] outline-none focus:border-[#1677ff]" placeholder="Déjala vacía para conservar la actual" type="password" {...form.register('password')} /></Field>{form.formState.errors.root && <p className="rounded-lg bg-[#feeceb] p-3 text-sm text-[#b42318]">{form.formState.errors.root.message}</p>}{success && <p className="rounded-lg bg-[#e7f6ec] p-3 text-sm text-[#167543]" role="status">Perfil actualizado correctamente.</p>}<div className="flex justify-end"><Button disabled={form.formState.isSubmitting} type="submit"><Save size={16} />{form.formState.isSubmitting ? 'Guardando…' : 'Guardar cambios'}</Button></div></form></section></div></AppShell>
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-[#344054]">{label}<span className="mt-1.5 block">{children}</span>{error && <span className="mt-1 block text-xs text-[#b42318]">{error}</span>}</label> }
