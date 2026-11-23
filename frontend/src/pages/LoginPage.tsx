import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, CheckCircle2, Cpu, Radio, ShieldCheck, Wifi } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '../components/common/Button'
import { InputField } from '../components/common/FormField'
import { useAuth } from '../features/auth/AuthContext'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Escribe tu usuario'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})

type LoginForm = z.infer<typeof loginSchema>

const capabilities = [
  { icon: Cpu, title: 'Dispositivos y canales', text: 'ESP32, Arduino, sensores y actuadores.' },
  { icon: Wifi, title: 'Telemetría MQTT', text: 'Lecturas, comandos y ACK en tiempo real.' },
  { icon: ShieldCheck, title: 'Acceso controlado', text: 'Proyectos, roles y sesiones protegidas.' },
]

export function LoginPage() {
  const { login } = useAuth()
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } })

  async function submit(values: LoginForm) {
    try {
      await login(values.username, values.password)
    } catch (reason) {
      form.setError('root', { message: reason instanceof Error ? reason.message : 'No fue posible iniciar sesión' })
    }
  }

  return (
    <main className="grid min-h-screen overflow-hidden bg-[#f3f6fa] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#071a2b] px-10 py-8 text-white lg:flex lg:flex-col xl:px-16 xl:py-11">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute -right-32 top-1/4 size-[430px] rounded-full bg-[#0b6ffb]/20 blur-[90px]" />
        <div className="absolute -bottom-44 -left-20 size-[400px] rounded-full bg-[#12b8a6]/10 blur-[90px]" />

        <div className="relative flex items-center gap-3"><span className="brand-mark grid size-11 place-items-center rounded-xl"><Radio size={23} /></span><div><p className="text-lg font-bold tracking-tight">UDLAIoT</p><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#82a0b8]">Plataforma de laboratorio IoT</p></div></div>

        <div className="relative my-auto max-w-2xl py-10">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#38d3bd]/20 bg-[#38d3bd]/10 px-3 py-1.5 text-[11px] font-semibold text-[#8be6da]"><span className="size-1.5 rounded-full bg-[#38d3bd]" />Infraestructura preparada para pruebas</p>
          <h1 className="max-w-xl text-[clamp(2.35rem,4vw,4rem)] font-bold leading-[1.05] tracking-[-.045em]">Del sensor a la decisión, en una sola plataforma.</h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#a9bece]">Diseña proyectos, observa telemetría y controla dispositivos físicos o simulados con los mismos contratos MQTT.</p>

          <div className="mt-9 grid max-w-2xl gap-2.5 xl:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text }) => <article className="rounded-[14px] border border-white/[.09] bg-white/[.045] p-3.5 backdrop-blur" key={title}><span className="grid size-8 place-items-center rounded-lg bg-[#0b6ffb]/20 text-[#70b2ff]"><Icon size={17} /></span><h2 className="mt-3 text-[13px] font-semibold">{title}</h2><p className="mt-1 text-[11px] leading-4 text-[#82a0b8]">{text}</p></article>)}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[10px] text-[#718da3]"><CheckCircle2 className="text-[#38d3bd]" size={14} />PostgreSQL · Mosquitto · FastAPI · React</div>
      </section>

      <section className="app-grid-background flex min-h-screen items-center justify-center p-4 sm:p-8 lg:p-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-7 flex items-center gap-3 lg:hidden"><span className="brand-mark grid size-10 place-items-center rounded-xl text-white"><Radio size={20} /></span><div><p className="font-bold">UDLAIoT</p><p className="text-[9px] font-bold uppercase tracking-[.13em] text-[#8795a5]">Laboratorio IoT</p></div></div>
          <div className="rounded-[20px] border border-[#dce3ea] bg-white p-5 shadow-[0_22px_70px_rgba(16,32,51,.11)] sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#0b6ffb]">Acceso seguro</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-.03em] text-[#102033]">Bienvenido de nuevo</h2>
            <p className="mt-2 text-[13px] leading-5 text-[#617184]">Ingresa con la cuenta asignada por el administrador de tu laboratorio.</p>
            <form className="mt-7 space-y-4.5" onSubmit={form.handleSubmit(submit)}>
              <div><InputField autoComplete="username" label="Usuario" placeholder="Tu nombre de usuario" {...form.register('username')} />{form.formState.errors.username && <p className="mt-1.5 text-xs text-[#c9342b]">{form.formState.errors.username.message}</p>}</div>
              <div><InputField autoComplete="current-password" label="Contraseña" placeholder="••••••••" type="password" {...form.register('password')} />{form.formState.errors.password && <p className="mt-1.5 text-xs text-[#c9342b]">{form.formState.errors.password.message}</p>}</div>
              {form.formState.errors.root && <p className="rounded-[10px] border border-[#f5c5c1] bg-[#fff0ef] px-3 py-2.5 text-[13px] text-[#ad2c25]" role="alert">{form.formState.errors.root.message}</p>}
              <Button className="mt-1 w-full" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? 'Verificando…' : 'Ingresar a la plataforma'}<ArrowRight size={17} /></Button>
            </form>
          </div>
          <p className="mt-4 text-center text-[11px] text-[#8795a5]">El registro público está deshabilitado. Solicita acceso al administrador.</p>
        </div>
      </section>
    </main>
  )
}

