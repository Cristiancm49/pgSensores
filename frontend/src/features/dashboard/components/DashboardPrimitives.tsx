import {
  Activity,
  ArrowRight,
  BellRing,
  ChevronRight,
  CircleAlert,
  Clock3,
  Cpu,
  FolderKanban,
  Gauge,
  Info,
  MapPin,
  ToggleLeft,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { EventSeverity, SystemEvent } from '../../../types/entities'

const panelClass = 'overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(16,24,40,.05)]'

export function DashboardSection({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  action?: { label: string; to: string }
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`${panelClass} ${className}`}>
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[#e5e7eb] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eaf3ff] text-[#1677ff]"><Icon size={17} /></span>}
          <div className="min-w-0"><h2 className="text-[15px] font-semibold leading-5 text-[#111827]">{title}</h2>{subtitle && <p className="truncate text-xs text-[#667085]">{subtitle}</p>}</div>
        </div>
        {action && <Link className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#1677ff] hover:text-[#0f63d8]" to={action.to}>{action.label}<ChevronRight size={14} /></Link>}
      </header>
      {children}
    </section>
  )
}

export function DashboardStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  to,
}: {
  title: string
  value: number | string
  subtitle: string
  icon: LucideIcon
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'red'
  to: string
}) {
  const tones = {
    blue: 'bg-[#eaf3ff] text-[#1677ff]',
    green: 'bg-[#e9f8ef] text-[#16a34a]',
    orange: 'bg-[#fff4e5] text-[#f59e0b]',
    purple: 'bg-[#f2edff] text-[#7c3aed]',
    red: 'bg-[#feecec] text-[#dc2626]',
  }
  return (
    <Link className="group flex min-h-[72px] min-w-0 items-center gap-2.5 rounded-xl border border-[#dce3ea] bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(16,32,51,.05)] transition hover:border-[#a7ccff] hover:shadow-[0_6px_18px_rgba(16,32,51,.08)]" to={to}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon size={18} /></span>
      <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-1.5"><span className="truncate text-[12px] font-semibold text-[#34465a]">{title}</span><strong className="text-lg font-bold leading-5 tabular-nums text-[#102033]">{value}</strong></span><span className="mt-1 block truncate text-[10px] text-[#617184]">{subtitle}</span></span>
      <ChevronRight className="hidden shrink-0 text-[#8795a5] transition group-hover:translate-x-0.5 group-hover:text-[#0b6ffb] sm:block" size={15} />
    </Link>
  )
}

export type ProjectSummary = {
  id: string
  name: string
  description: string
  status: string
  devices: number
  sensors: number
  actuators: number
  members: number
  locations: number
  updatedAt: string
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const style = normalized === 'activo'
    ? 'bg-[#e9f8ef] text-[#15803d]'
    : normalized === 'borrador'
      ? 'bg-[#eaf3ff] text-[#1677ff]'
      : normalized === 'finalizado'
        ? 'bg-[#f2edff] text-[#6d28d9]'
        : 'bg-[#f2f4f7] text-[#667085]'
  const label = normalized === 'borrador' ? 'En prueba' : normalized.charAt(0).toUpperCase() + normalized.slice(1)
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}><span className="size-1.5 rounded-full bg-current" />{label}</span>
}

function Metric({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return <span className="inline-flex items-center gap-1.5 text-xs text-[#667085]"><Icon size={14} /><strong className="font-semibold text-[#344054]">{value}</strong><span className="hidden 2xl:inline">{label}</span></span>
}

export function ProjectSummaryRow({ project }: { project: ProjectSummary }) {
  const date = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(project.updatedAt))
  return (
    <article className="grid gap-3 px-4 py-3.5 transition hover:bg-[#fbfdff] md:grid-cols-[minmax(180px,1.2fr)_minmax(300px,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf3ff] text-[#1677ff]"><FolderKanban size={19} /></span>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-[#111827]">{project.name}</h3><StatusBadge status={project.status} /></div><p className="mt-1 truncate text-xs text-[#667085]">{project.description || 'Sin descripción'}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-[#eef1f4] py-2 md:border-y-0 md:border-l md:py-0 md:pl-4">
        <Metric icon={Cpu} label="disp." value={project.devices} /><Metric icon={Gauge} label="sens." value={project.sensors} /><Metric icon={ToggleLeft} label="act." value={project.actuators} /><Metric icon={Users} label="integr." value={project.members} /><Metric icon={MapPin} label="ubic." value={project.locations} />
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <div className="flex items-center gap-2 text-[11px] text-[#667085]"><Clock3 size={14} /><span><span className="hidden xl:inline">Actualizado </span>{date}</span></div>
        <Link className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1677ff] px-3 text-xs font-semibold text-white hover:bg-[#0f63d8]" to={`/app/proyectos/${project.id}`}>Abrir<ArrowRight size={13} /></Link>
      </div>
    </article>
  )
}

export function MiniTrendChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-7 w-20 rounded bg-[#f5f7fa]" />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 80},${26 - ((value - min) / range) * 22}`).join(' ')
  return <svg aria-label="Tendencia reciente" className="h-7 w-20 overflow-visible" role="img" viewBox="0 0 80 28"><polyline fill="none" points={points} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
}

export function SensorMiniCard({
  name,
  projectName,
  value,
  unit,
  values,
  icon: Icon = Activity,
  tone = 'blue',
}: {
  name: string
  projectName: string
  value: string
  unit?: string | null
  values: number[]
  icon?: LucideIcon
  tone?: 'red' | 'blue' | 'green' | 'orange' | 'purple'
}) {
  const colors = { red: ['#ef4444', '#feecec'], blue: ['#1677ff', '#eaf3ff'], green: ['#16a34a', '#e9f8ef'], orange: ['#f59e0b', '#fff4e5'], purple: ['#7c3aed', '#f2edff'] } as const
  const [color, background] = colors[tone]
  return <article className="min-w-0 rounded-lg border border-[#e5e7eb] bg-white p-3"><div className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ color, background }}><Icon size={16} /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#344054]">{name}</p><p className="truncate text-[11px] text-[#667085]">{projectName}</p></div></div><div className="mt-2 flex items-end justify-between gap-2"><p className="truncate text-lg font-bold tracking-tight text-[#111827]">{value}<span className="ml-1 text-xs font-semibold text-[#475467]">{unit}</span></p><MiniTrendChart color={color} values={values} /></div></article>
}

export function ActuatorMiniCard({ name, projectName, active }: { name: string; projectName: string; active: boolean }) {
  return <article className="min-w-0 rounded-lg border border-[#e5e7eb] bg-white p-3"><div className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f2edff] text-[#7c3aed]"><ToggleLeft size={17} /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#344054]">{name}</p><p className="truncate text-[11px] text-[#667085]">{projectName}</p></div></div><div className="mt-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${active ? 'bg-[#e9f8ef] text-[#15803d]' : 'bg-[#f2f4f7] text-[#667085]'}`}><span className="size-1.5 rounded-full bg-current" />{active ? 'Encendido' : 'Apagado'}</span></div></article>
}

const severityStyle: Record<EventSeverity, { icon: LucideIcon; dot: string; bg: string }> = {
  critica: { icon: CircleAlert, dot: '#ef4444', bg: '#feecec' },
  advertencia: { icon: TriangleAlert, dot: '#f59e0b', bg: '#fff4e5' },
  info: { icon: Info, dot: '#3b82f6', bg: '#eaf3ff' },
}

export function AlertList({ events, projectName, deviceName }: { events: SystemEvent[]; projectName: (id: string) => string; deviceName: (id: string | null) => string }) {
  if (!events.length) return <div className="grid min-h-40 place-items-center px-4 text-center"><div><BellRing className="mx-auto text-[#98a2b3]" size={24} /><p className="mt-2 text-xs text-[#667085]">No hay alertas recientes.</p></div></div>
  return <div className="divide-y divide-[#eef1f4]">{events.map((event) => { const item = severityStyle[event.severity]; const Icon = item.icon; return <article className="flex gap-2.5 px-3 py-2.5" key={event.id}><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full" style={{ color: item.dot, background: item.bg }}><Icon size={14} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#111827]">{event.message}</p><p className="mt-0.5 truncate text-[11px] text-[#667085]">{projectName(event.project_id)} · {deviceName(event.device_id)}</p></div><time className="shrink-0 text-[10px] text-[#98a2b3]">{new Date(event.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</time></article> })}</div>
}

export function QuickAction({ label, icon: Icon, to }: { label: string; icon: LucideIcon; to: string }) {
  return <Link className="flex min-h-14 items-center gap-2.5 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] px-3 text-xs font-semibold text-[#344054] transition hover:border-[#b9d7ff] hover:bg-[#eef6ff]" to={to}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eaf3ff] text-[#1677ff]"><Icon size={16} /></span>{label}</Link>
}

export function DashboardSkeleton() {
  return <div className="animate-pulse space-y-4"><div className="h-12 w-64 rounded-lg bg-[#e9edf2]" /><div className="grid grid-cols-2 gap-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div className="h-[72px] rounded-xl bg-white" key={index} />)}</div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="h-[520px] rounded-xl bg-white" /><div className="h-[520px] rounded-xl bg-white" /></div></div>
}
