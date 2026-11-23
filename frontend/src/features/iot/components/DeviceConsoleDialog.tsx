import { useQueries, useQuery } from '@tanstack/react-query'
import { Activity, CirclePause, CirclePlay, Eraser, Gauge, Radio, Terminal, ToggleLeft, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { Channel, ChannelState, Device, DeviceCommand } from '../../../types/entities'
import { devicesApi, eventsApi, simulatorApi } from '../../crud/api'
import { deviceConnectionLabel } from '../connectionLabel'

type Filter = 'all' | 'telemetry' | 'command' | 'system'
type ConsoleView = 'overview' | 'logs'

type ConsoleLine = {
  id: string
  timestamp: string
  category: Exclude<Filter, 'all'>
  level: 'info' | 'success' | 'warning' | 'error'
  prefix: string
  message: string
}

type DeviceConsoleDialogProps = {
  device: Device
  onClose: () => void
  standalone?: boolean
}

export function DeviceConsoleDialog({ device, onClose, standalone = false }: DeviceConsoleDialogProps) {
  const [paused, setPaused] = useState(false)
  const [view, setView] = useState<ConsoleView>('overview')
  const [filter, setFilter] = useState<Filter>('all')
  const [clearedAt, setClearedAt] = useState(0)
  const outputRef = useRef<HTMLDivElement>(null)
  const channels = useQuery({ queryKey: ['device-console-channels', device.id], queryFn: () => devicesApi.channels(device.id), refetchInterval: paused ? false : 5_000 })
  const commands = useQuery({ queryKey: ['device-console-commands', device.id], queryFn: () => devicesApi.commands(device.id), refetchInterval: paused ? false : 2_000 })
  const events = useQuery({ queryKey: ['device-console-events', device.id], queryFn: () => eventsApi.list({ device_id: device.id, page_size: 100 }), refetchInterval: paused ? false : 3_000 })
  const sessions = useQuery({ queryKey: ['device-console-sessions'], queryFn: simulatorApi.sessions, refetchInterval: paused ? false : 5_000 })
  const session = sessions.data?.find((item) => item.device_id === device.id)
  const snapshot = useQuery({ queryKey: ['device-console-snapshot', session?.id], queryFn: () => simulatorApi.status(session!.id), enabled: Boolean(session), refetchInterval: paused ? false : 2_000 })
  const stateQueries = useQueries({
    queries: (channels.data ?? []).map((channel) => ({
      queryKey: ['channel-state', channel.id],
      queryFn: () => devicesApi.state(channel.id),
      retry: false,
      enabled: channel.active,
      refetchInterval: paused ? false : 2_000,
    })),
  })
  const channelById = useMemo(() => new Map((channels.data ?? []).map((channel) => [channel.id, channel])), [channels.data])

  const lines = useMemo(() => {
    const result: ConsoleLine[] = []
    result.push({ id: `status-${device.updated_at}`, timestamp: device.last_connection ?? device.updated_at, category: 'system', level: device.status === 'conectado' ? 'success' : device.status === 'error' ? 'error' : 'warning', prefix: 'STATUS', message: `${device.name} · ${device.status} · ${deviceConnectionLabel(device)}` })
    snapshot.data?.logs.forEach((log, index) => result.push({ id: `runtime-${log.timestamp}-${index}`, timestamp: log.timestamp, category: 'system', level: log.level === 'error' ? 'error' : log.level === 'warning' ? 'warning' : 'info', prefix: 'RUNTIME', message: `${log.message}${Object.keys(log.data).length ? ` · ${JSON.stringify(log.data)}` : ''}` }))
    events.data?.items.forEach((event) => result.push({ id: `event-${event.id}`, timestamp: event.created_at, category: 'system', level: event.severity === 'critica' ? 'error' : event.severity === 'advertencia' ? 'warning' : 'info', prefix: event.event_type.toUpperCase(), message: event.message }))
    ;(channels.data ?? []).forEach((channel, index) => {
      const state = stateQueries[index]?.data
      if (!state) return
      const value = typeof state.value === 'object' ? JSON.stringify(state.value) : String(state.value)
      result.push({ id: `telemetry-${channel.id}-${state.received_at}`, timestamp: state.received_at, category: 'telemetry', level: 'success', prefix: 'RX', message: `${channel.key} = ${value}${channel.unit ? ` ${channel.unit}` : ''}${channel.gpio ? ` · GPIO ${channel.gpio}` : ''}` })
    })
    commands.data?.forEach((command) => {
      const channel = channelById.get(command.channel_id)
      result.push({ id: `command-${command.id}`, timestamp: command.created_at, category: 'command', level: 'info', prefix: 'TX', message: `${channel?.key ?? command.channel_id} ← ${JSON.stringify(command.value)} · ${command.status}` })
      if (command.confirmed_at) result.push({ id: `ack-${command.id}`, timestamp: command.confirmed_at, category: 'command', level: 'success', prefix: 'ACK', message: `${channel?.key ?? command.channel_id} confirmó ${JSON.stringify(command.value)}` })
      if (command.error) result.push({ id: `command-error-${command.id}`, timestamp: command.confirmed_at ?? command.created_at, category: 'command', level: 'error', prefix: 'ERROR', message: command.error })
    })
    return result.filter((line) => new Date(line.timestamp).getTime() >= clearedAt).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(-250)
  }, [channelById, channels.data, clearedAt, commands.data, device, events.data, snapshot.data, stateQueries])

  const visibleLines = filter === 'all' ? lines : lines.filter((line) => line.category === filter)
  const channelEntries = (channels.data ?? []).map((channel, index) => ({ channel, state: stateQueries[index]?.data }))
  const sensors = channelEntries.filter(({ channel }) => channel.category === 'sensor')
  const actuators = channelEntries.filter(({ channel }) => channel.category === 'actuador')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  useEffect(() => {
    if (!paused && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [paused, visibleLines.length])

  const consolePanel = <section aria-label={`Consola de ${device.name}`} className={`flex w-full flex-col overflow-hidden border border-[#314157] bg-[#09131f] shadow-[0_28px_90px_rgba(0,0,0,.45)] ${standalone ? 'h-dvh max-w-none rounded-none sm:rounded-2xl' : 'h-[min(92vh,820px)] max-w-[1180px] rounded-2xl'}`}>
      <header className="flex flex-col gap-3 border-b border-[#26364a] bg-[#0f1c2b] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#17375b] text-[#63a9ff]"><Terminal size={19} /></span><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-white">Consola · {device.name}</h2><p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#8fa5bb]"><span className={`size-1.5 rounded-full ${device.status === 'conectado' ? 'bg-[#36d399]' : 'bg-[#f2b84b]'}`} />{paused ? 'Actualización pausada' : 'Escuchando respuestas del dispositivo cada 2 s'}</p></div></div>
        <div className="flex flex-wrap items-center gap-1.5"><button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#31445a] px-2.5 text-[11px] font-medium text-[#c2d1df] hover:bg-[#17283b]" onClick={() => setPaused((value) => !value)} type="button">{paused ? <CirclePlay size={14} /> : <CirclePause size={14} />}{paused ? 'Reanudar' : 'Pausar'}</button>{view === 'logs' && <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#31445a] px-2.5 text-[11px] font-medium text-[#c2d1df] hover:bg-[#17283b]" onClick={() => setClearedAt(Date.now())} type="button"><Eraser size={14} />Limpiar</button>}<button aria-label="Cerrar consola" className="grid size-8 place-items-center rounded-lg text-[#9fb0c2] hover:bg-[#26384b] hover:text-white" onClick={onClose} type="button"><X size={17} /></button></div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1d2b3a] bg-[#0b1724] px-4 py-2"><div className="flex items-center gap-1">{([['overview', 'Resumen operativo'], ['logs', 'Registros técnicos']] as const).map(([value, label]) => <button aria-pressed={view === value} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${view === value ? 'bg-[#1c4775] text-[#ddecff]' : 'text-[#8499ae] hover:bg-[#14263a] hover:text-[#c4d3e1]'}`} key={value} onClick={() => setView(value)} type="button">{label}</button>)}</div><div className="flex items-center gap-3 text-[10px] text-[#7890a7]"><span className="inline-flex items-center gap-1"><Activity size={12} />{channels.data?.length ?? 0} canales</span>{snapshot.data && <span className="inline-flex items-center gap-1"><Radio size={12} />{snapshot.data.messages_sent} mensajes MQTT</span>}</div></div>
      {view === 'overview' ? <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"><div className="grid gap-3 lg:grid-cols-2 lg:gap-4"><ChannelOverviewSection accent="sensor" entries={sensors} icon={Gauge} title="Sensores" /><ChannelOverviewSection accent="actuator" commands={commands.data ?? []} entries={actuators} icon={ToggleLeft} title="Actuadores" /></div></div> : <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1d2b3a] bg-[#091521] px-4 py-2"><div className="flex items-center gap-1">{([['all', 'Todo'], ['telemetry', 'Telemetría'], ['command', 'Comandos / ACK'], ['system', 'Sistema']] as const).map(([value, label]) => <button className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${filter === value ? 'bg-[#173b62] text-[#ddecff]' : 'text-[#7890a7] hover:bg-[#14263a] hover:text-[#c4d3e1]'}`} key={value} onClick={() => setFilter(value)} type="button">{label}</button>)}</div><span className="text-[10px] text-[#71869a]">{visibleLines.length} registros</span></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 font-mono text-[11px] leading-5 sm:px-4" ref={outputRef}>
          {visibleLines.length ? visibleLines.map((line) => <div className="grid grid-cols-[72px_58px_minmax(0,1fr)] gap-2 border-b border-[#172536] py-1.5 last:border-0 sm:grid-cols-[86px_70px_minmax(0,1fr)]" key={line.id}><time className="text-[#5f778d]">{new Date(line.timestamp).toLocaleTimeString('es-CO', { hour12: false })}</time><span className={`font-bold ${line.level === 'error' ? 'text-[#ff7d85]' : line.level === 'warning' ? 'text-[#f5c15c]' : line.level === 'success' ? 'text-[#4fd6a0]' : 'text-[#65aaff]'}`}>{line.prefix}</span><span className="min-w-0 break-words text-[#c3d0dc]">{line.message}</span></div>) : <div className="grid h-full place-items-center text-center"><div><Terminal className="mx-auto text-[#3e5d7c]" size={30} /><p className="mt-3 text-xs text-[#8196aa]">Esperando nuevas respuestas del dispositivo…</p></div></div>}
        </div>
      </>}
      <footer className="flex items-center justify-between border-t border-[#223247] bg-[#0d1926] px-4 py-2 text-[10px] text-[#71869a]"><span>{view === 'overview' ? 'Valores actualizados cada 2 segundos' : 'Máximo 250 registros visibles'}</span><span>{device.device_identifier}</span></footer>
    </section>

  if (standalone) {
    return <main className="min-h-dvh bg-[#07111d] sm:p-3">{consolePanel}</main>
  }

  return createPortal(<div aria-label={`Consola de ${device.name}`} aria-modal="true" className="fixed inset-0 z-[100] grid place-items-center bg-[#07111d]/70 p-2 backdrop-blur-sm sm:p-5" role="dialog">{consolePanel}</div>, document.body)
}

type ChannelEntry = { channel: Channel; state: ChannelState | undefined }

function ChannelOverviewSection({ accent, commands = [], entries, icon: Icon, title }: { accent: 'sensor' | 'actuator'; commands?: DeviceCommand[]; entries: ChannelEntry[]; icon: typeof Gauge; title: string }) {
  const isSensor = accent === 'sensor'
  return <section className="overflow-hidden rounded-xl border border-[#24364a] bg-[#0c1927]">
    <header className="flex items-center justify-between border-b border-[#203247] px-3.5 py-3"><div className="flex items-center gap-2.5"><span className={`grid size-8 place-items-center rounded-lg ${isSensor ? 'bg-[#123c54] text-[#55c8e8]' : 'bg-[#3d2d17] text-[#f0b85a]'}`}><Icon size={16} /></span><div><h3 className="text-xs font-semibold text-white">{title}</h3><p className="mt-0.5 text-[9px] text-[#71869a]">{isSensor ? 'Lecturas recibidas' : 'Salidas y respuestas'}</p></div></div><span className="rounded-full bg-[#14263a] px-2 py-1 text-[9px] font-semibold text-[#9cb0c3]">{entries.length}</span></header>
    <div className="divide-y divide-[#1c2c3d]">
      {entries.map(({ channel, state }) => {
        const lastCommand = isSensor ? undefined : commands.find((command) => command.channel_id === channel.id)
        return <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3" key={channel.id}><div className="min-w-0"><div className="flex items-center gap-2"><span className={`size-1.5 shrink-0 rounded-full ${channel.active ? 'bg-[#36d399]' : 'bg-[#64788d]'}`} /><h4 className="truncate text-[11px] font-semibold text-[#d9e4ee]">{channel.name}</h4>{lastCommand && <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${lastCommand.status === 'confirmado' ? 'bg-[#123c32] text-[#55d6a8]' : lastCommand.status === 'fallido' || lastCommand.status === 'expirado' ? 'bg-[#44262a] text-[#ff8f98]' : 'bg-[#17375b] text-[#79b7ff]'}`}>{lastCommand.status}</span>}</div><p className="mt-1 truncate text-[9px] text-[#647d93]">{channel.key}{channel.gpio ? ` · GPIO ${channel.gpio}` : ''}</p></div><div className="text-right"><p className={`max-w-[170px] truncate text-sm font-bold ${state ? 'text-white' : 'text-[#60768b]'}`}>{formatChannelValue(channel, state)}</p><p className="mt-1 text-[8px] text-[#60768b]">{state ? new Date(state.received_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Sin lectura'}</p></div></article>
      })}
      {!entries.length && <div className="px-4 py-10 text-center text-[11px] text-[#667e94]">No hay {isSensor ? 'sensores' : 'actuadores'} configurados.</div>}
    </div>
  </section>
}

function formatChannelValue(channel: Channel, state: ChannelState | undefined) {
  if (!state) return 'Sin datos'
  if (typeof state.value === 'boolean') {
    if (channel.category === 'actuador') return state.value ? 'Encendido' : 'Apagado'
    return state.value ? 'Detectado' : 'Sin detección'
  }
  if (typeof state.value === 'number') return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(state.value)}${channel.unit ? ` ${channel.unit}` : ''}`
  const value = typeof state.value === 'object' ? JSON.stringify(state.value) : String(state.value)
  return `${value}${channel.unit ? ` ${channel.unit}` : ''}`
}
