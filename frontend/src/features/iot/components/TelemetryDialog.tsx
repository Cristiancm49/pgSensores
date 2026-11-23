import { useQuery } from '@tanstack/react-query'
import { BarChart3, Table2 } from 'lucide-react'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Dialog } from '../../../components/common/Dialog'
import type { Channel } from '../../../types/entities'
import { devicesApi } from '../../crud/api'

type Period = 'today' | 'week' | 'month' | 'custom'
type View = 'chart' | 'table'

function inputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formattedValue(value: unknown, unit: string | null | undefined) {
  if (typeof value === 'number') return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ''}`
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value ?? 'Sin datos')
}

export function TelemetryDialog({ channel, onClose }: { channel: Channel | null; onClose: () => void }) {
  const [fromDate, setFromDate] = useState(() => inputDate(new Date()))
  const [toDate, setToDate] = useState(() => inputDate(new Date()))
  const [page, setPage] = useState(1)
  const [period, setPeriod] = useState<Period>('today')
  const [view, setView] = useState<View>('chart')
  const telemetry = useQuery({
    queryKey: ['telemetry', channel?.id, fromDate, toDate, page],
    queryFn: () => devicesApi.telemetry(channel!.id, { page, page_size: 100, from_date: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined, to_date: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined }),
    enabled: Boolean(channel),
  })
  const points = (telemetry.data?.items ?? [])
    .filter((point) => typeof point.value === 'number')
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((point) => ({ value: point.value as number, time: new Date(point.recorded_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }))

  function selectPeriod(nextPeriod: Exclude<Period, 'custom'>) {
    const end = new Date()
    const start = new Date(end)
    if (nextPeriod === 'week') start.setDate(end.getDate() - ((end.getDay() + 6) % 7))
    if (nextPeriod === 'month') start.setDate(1)
    setFromDate(inputDate(start))
    setToDate(inputDate(end))
    setPeriod(nextPeriod)
    setPage(1)
  }

  return <Dialog open={Boolean(channel)} title={channel ? `Histórico · ${channel.name}` : 'Histórico'} onClose={onClose}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5"><div className="flex items-center gap-1 rounded-lg bg-[#f2f5f8] p-1">{([['today', 'Hoy'], ['week', 'Esta semana'], ['month', 'Este mes']] as const).map(([value, label]) => <button aria-pressed={period === value} className={`h-8 rounded-md px-2.5 text-[11px] font-semibold transition ${period === value ? 'bg-white text-[#1268d6] shadow-sm' : 'text-[#617184] hover:text-[#102033]'}`} key={value} onClick={() => selectPeriod(value)} type="button">{label}</button>)}</div><div className="flex items-center gap-1 rounded-lg border border-[#dce3ea] p-1"><button aria-pressed={view === 'chart'} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold ${view === 'chart' ? 'bg-[#eaf3ff] text-[#1268d6]' : 'text-[#617184] hover:bg-[#f6f8fa]'}`} onClick={() => setView('chart')} type="button"><BarChart3 size={14} />Gráfica</button><button aria-pressed={view === 'table'} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold ${view === 'table' ? 'bg-[#eaf3ff] text-[#1268d6]' : 'text-[#617184] hover:bg-[#f6f8fa]'}`} onClick={() => setView('table')} type="button"><Table2 size={14} />Tabla</button></div></div>
    <div className="mb-4 grid gap-3 min-[460px]:grid-cols-2"><label className="text-xs font-medium text-[#475467]">Desde<input className="mt-1 block h-9 w-full rounded-lg border border-[#d0d5dd] px-2 text-sm outline-none focus:border-[#1677ff]" onChange={(event) => { setFromDate(event.target.value); setPeriod('custom'); setPage(1) }} type="date" value={fromDate} /></label><label className="text-xs font-medium text-[#475467]">Hasta<input className="mt-1 block h-9 w-full rounded-lg border border-[#d0d5dd] px-2 text-sm outline-none focus:border-[#1677ff]" onChange={(event) => { setToDate(event.target.value); setPeriod('custom'); setPage(1) }} type="date" value={toDate} /></label></div>
    {view === 'chart' ? <div className="h-72 w-full">{telemetry.isLoading ? <div className="grid h-full place-items-center text-sm text-[#667085]">Cargando lecturas…</div> : points.length ? <ResponsiveContainer height="100%" width="100%"><LineChart data={points}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis dataKey="time" minTickGap={28} stroke="#98a2b3" tick={{ fontSize: 10 }} /><YAxis stroke="#98a2b3" tick={{ fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(Number(value))} /><Tooltip formatter={(value) => [`${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(Number(value))}${channel?.unit ? ` ${channel.unit}` : ''}`, channel?.name]} /><Line dataKey="value" dot={false} isAnimationActive={false} stroke="#1677ff" strokeWidth={2} type="monotone" /></LineChart></ResponsiveContainer> : <div className="grid h-full place-items-center rounded-lg border border-dashed border-[#cbd5e1] text-sm text-[#667085]">Todavía no hay lecturas numéricas.</div>}</div> : <div className="h-72 overflow-auto rounded-xl border border-[#dce3ea]"><table className="min-w-[420px] w-full text-left text-xs"><thead className="sticky top-0 z-[1] bg-[#f6f8fb] text-[10px] uppercase tracking-[.06em] text-[#617184]"><tr><th className="px-3 py-2.5 font-semibold">Fecha</th><th className="px-3 py-2.5 font-semibold">Hora</th><th className="px-3 py-2.5 text-right font-semibold">Valor</th></tr></thead><tbody className="divide-y divide-[#edf1f5] bg-white">{telemetry.isLoading ? <tr><td className="px-3 py-10 text-center text-[#667085]" colSpan={3}>Cargando lecturas…</td></tr> : telemetry.data?.items.length ? telemetry.data.items.map((point) => { const recorded = new Date(point.recorded_at); return <tr className="hover:bg-[#f8fbff]" key={point.id}><td className="whitespace-nowrap px-3 py-2.5 text-[#475467]">{recorded.toLocaleDateString('es-CO')}</td><td className="whitespace-nowrap px-3 py-2.5 text-[#667085]">{recorded.toLocaleTimeString('es-CO')}</td><td className="max-w-[180px] truncate px-3 py-2.5 text-right font-semibold tabular-nums text-[#102033]" title={formattedValue(point.value, channel?.unit)}>{formattedValue(point.value, channel?.unit)}</td></tr> }) : <tr><td className="px-3 py-10 text-center text-[#667085]" colSpan={3}>No hay lecturas para este periodo.</td></tr>}</tbody></table></div>}
    <div className="mt-3 flex items-center justify-between"><p className="text-xs text-[#667085]">{telemetry.data?.total ?? 0} lecturas almacenadas · página {page}</p><div className="flex gap-2"><button className="rounded border border-[#d0d5dd] px-2 py-1 text-xs disabled:opacity-40" disabled={page === 1} onClick={() => setPage((value) => value - 1)} type="button">Anterior</button><button className="rounded border border-[#d0d5dd] px-2 py-1 text-xs disabled:opacity-40" disabled={!telemetry.data || page * telemetry.data.page_size >= telemetry.data.total} onClick={() => setPage((value) => value + 1)} type="button">Siguiente</button></div></div>
  </Dialog>
}
