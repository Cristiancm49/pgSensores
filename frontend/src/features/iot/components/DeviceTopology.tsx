import { useQueries } from '@tanstack/react-query'
import { Droplets, Gauge, History, ImagePlus, Pencil, Plus, Sprout, Sun, Thermometer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { AuthenticatedImage } from '../../../components/common/AuthenticatedImage'
import type { Channel, ChannelState, Device } from '../../../types/entities'
import { devicesApi } from '../../crud/api'
import { boardAssetFor, channelAssetFor } from '../../hardware/hardwareCatalog'
import { ChannelSparkline } from './ChannelSparkline'
import { usesSerialBridge } from '../connectionLabel'

type Props = {
  device: Device
  channels: Channel[]
  canWrite: boolean
  onAdd: () => void
  onEdit: (channel: Channel) => void
  onHistory: (channel: Channel) => void
  onImage: (channel: Channel, file: File) => void
  onToggleActive: (channel: Channel) => void
}

type SensorStyle = {
  Icon: LucideIcon
  accent: string
  pale: string
  line: string
}

const styles: Record<string, SensorStyle> = {
  temperature: { Icon: Thermometer, accent: '#ef5b62', pale: '#fff0f1', line: '#ef5b62' },
  humidity: { Icon: Droplets, accent: '#478cff', pale: '#edf5ff', line: '#478cff' },
  soil: { Icon: Sprout, accent: '#2ca78c', pale: '#eaf9f5', line: '#2ca78c' },
  light: { Icon: Sun, accent: '#d88a13', pale: '#fff7df', line: '#d88a13' },
  pressure: { Icon: Gauge, accent: '#8b63ea', pale: '#f4efff', line: '#8b63ea' },
  default: { Icon: Gauge, accent: '#1677ff', pale: '#edf5ff', line: '#1677ff' },
}

function sensorStyle(channel: Channel) {
  const key = `${channel.key} ${channel.name}`.toLowerCase()
  if (key.includes('temper')) return styles.temperature
  if (key.includes('suelo') || key.includes('soil')) return styles.soil
  if (key.includes('hum')) return styles.humidity
  if (key.includes('luz') || key.includes('ilum') || key.includes('light')) return styles.light
  if (key.includes('pres')) return styles.pressure
  return styles.default
}

function formatValue(state: ChannelState | undefined, channel: Channel) {
  if (!state || state.value === null || state.value === undefined) return 'Sin datos'
  if (typeof state.value === 'boolean') return state.value ? 'Sí' : 'No'
  if (typeof state.value === 'number') {
    const value = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(state.value)
    return `${value}${channel.unit ? ` ${channel.unit}` : ''}`
  }
  if (typeof state.value === 'object') return 'Dato recibido'
  return `${String(state.value)}${channel.unit ? ` ${channel.unit}` : ''}`
}

export function DeviceTopology({ device, channels, canWrite, onAdd, onEdit, onHistory, onImage, onToggleActive }: Props) {
  const visibleChannels = channels.slice(0, 6)
  const stateQueries = useQueries({
    queries: visibleChannels.map((channel) => ({
      queryKey: ['channel-state', channel.id],
      queryFn: () => devicesApi.state(channel.id),
      retry: false,
      enabled: channel.active,
      refetchInterval: 10_000,
    })),
  })
  const left = visibleChannels.filter((_, index) => index % 2 === 0)
  const right = visibleChannels.filter((_, index) => index % 2 === 1)
  const stateFor = (channel: Channel) => stateQueries[visibleChannels.findIndex((item) => item.id === channel.id)]?.data

  return <div className="overflow-hidden rounded-2xl border border-[#dce5ef] bg-[#f4f7fb] shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">
    <div className="relative bg-[linear-gradient(rgba(90,120,150,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(90,120,150,.055)_1px,transparent_1px)] bg-[size:28px_28px] px-6 py-6">
      <div className="grid min-h-[500px] grid-cols-[minmax(250px,1fr)_230px_minmax(250px,1fr)] items-center gap-x-14">
        <div className="flex h-full flex-col justify-around gap-4 py-4">
          {left.map((channel) => <TopologyCard channel={channel} key={channel.id} onEdit={onEdit} onHistory={onHistory} onImage={onImage} onToggleActive={onToggleActive} side="left" state={stateFor(channel)} canWrite={canWrite} />)}
        </div>

        <DeviceBoard device={device} />

        <div className="flex h-full flex-col justify-around gap-4 py-4">
          {right.map((channel) => <TopologyCard channel={channel} key={channel.id} onEdit={onEdit} onHistory={onHistory} onImage={onImage} onToggleActive={onToggleActive} side="right" state={stateFor(channel)} canWrite={canWrite} />)}
          {canWrite && right.length < 3 && <button className="group grid min-h-[108px] place-items-center rounded-xl border border-dashed border-[#80b7ff] bg-white/65 px-4 text-center text-[#146ce0] transition hover:border-[#1677ff] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]" onClick={onAdd} type="button"><span><span className="mx-auto mb-1 grid size-7 place-items-center rounded-full bg-[#e9f3ff] transition group-hover:bg-[#d9ebff]"><Plus size={17} /></span><span className="block text-xs font-semibold">Agregar sensor</span><span className="mt-0.5 block text-[10px] font-normal text-[#718198]">Nuevo canal de telemetría</span></span></button>}
        </div>
      </div>
    </div>
    <DataRoute device={device} />
    {channels.length > 6 && <p className="border-t border-[#dce5ef] bg-white px-4 py-2 text-center text-xs text-[#617184]">Se muestran 6 de {channels.length} sensores en el diagrama. Los demás aparecen en la vista compacta.</p>}
  </div>
}

function TopologyCard({ channel, state, side, canWrite, onEdit, onHistory, onImage, onToggleActive }: {
  channel: Channel
  state: ChannelState | undefined
  side: 'left' | 'right'
  canWrite: boolean
  onEdit: (channel: Channel) => void
  onHistory: (channel: Channel) => void
  onImage: (channel: Channel, file: File) => void
  onToggleActive: (channel: Channel) => void
}) {
  const style = sensorStyle(channel)
  const Icon = style.Icon
  const asset = channelAssetFor(channel.key, channel.name, channel.category)
  return <article className={`relative z-10 rounded-xl border border-[#dce3ea] bg-white p-3 shadow-[0_4px_14px_rgba(34,54,76,.07)] ${channel.active ? '' : 'opacity-65'}`}>
    <span aria-hidden="true" className={`absolute top-1/2 -z-10 w-14 border-t border-dashed ${side === 'left' ? '-right-14' : '-left-14'}`} style={{ borderColor: style.line }} />
    <span aria-hidden="true" className={`absolute top-[calc(50%-3px)] size-1.5 rounded-full ${side === 'left' ? '-right-[59px]' : '-left-[59px]'}`} style={{ backgroundColor: style.line }} />
    <div className="flex items-start gap-2.5">
      <AuthenticatedImage alt={channel.name} className="size-11 shrink-0 rounded-lg bg-white" fallback={asset ? <span className="grid size-11 place-items-center overflow-hidden rounded-lg border border-[#e5ebf1] bg-white"><img alt="" className="h-full w-full object-contain p-1" decoding="async" draggable={false} loading="lazy" src={asset} /></span> : <span className="grid size-11 place-items-center rounded-lg" style={{ backgroundColor: style.pale, color: style.accent }}><Icon size={18} /></span>} load={() => devicesApi.channelImage(channel.id)} queryKey={['channel', channel.id]} />
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="truncate text-xs font-semibold text-[#102033]">{channel.name}</h3><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${channel.active ? 'bg-[#e8f7ef] text-[#137a49]' : 'bg-[#eef3f8] text-[#617184]'}`}>{channel.active ? 'Activo' : 'Inactivo'}</span></div><p className="mt-0.5 truncate text-[9px] text-[#7a8999]">{channel.key} · {channel.data_type}{channel.gpio ? ` · GPIO ${channel.gpio}` : ''}</p></div>
    </div>
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_96px] items-end gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#91a0b0]">Estado actual</p><p className="mt-0.5 text-lg font-bold leading-none tracking-[-.02em] text-[#102033]">{formatValue(state, channel)}</p></div><div className="min-w-0">{(channel.data_type === 'numero' || channel.data_type === 'entero') && <ChannelSparkline channel={channel} color={style.accent} />}{state && <p className="mt-0.5 text-right text-[8px] text-[#91a0b0]">{new Date(state.received_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>}</div></div>
    <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-[#edf1f5] pt-2">
      <button className="inline-flex h-7 items-center gap-1 rounded-md border border-[#d5dee8] px-2 text-[10px] font-medium text-[#4a5d70] hover:bg-[#f5f8fb]" onClick={() => onHistory(channel)} type="button"><History size={12} />Histórico</button>
      {canWrite && <><button className="inline-flex h-7 items-center gap-1 rounded-md border border-[#d5dee8] px-2 text-[10px] font-medium text-[#4a5d70] hover:bg-[#f5f8fb]" onClick={() => onEdit(channel)} type="button"><Pencil size={12} />Editar</button><label aria-label={`Cambiar imagen de ${channel.name}`} className="grid size-7 cursor-pointer place-items-center rounded-md border border-[#d5dee8] text-[#4a5d70] hover:bg-[#f5f8fb]"><ImagePlus size={12} /><input accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImage(channel, file) }} type="file" /></label><button className="ml-auto h-7 px-1.5 text-[10px] font-medium text-[#617184] hover:text-[#ad2c25]" onClick={() => onToggleActive(channel)} type="button">{channel.active ? 'Desactivar' : 'Activar'}</button></>}
    </div>
  </article>
}

function DeviceBoard({ device }: { device: Device }) {
  return device.board_type.toLowerCase().includes('arduino') ? <PhotoBoard device={device} /> : <Esp32Board device={device} />
}

function PhotoBoard({ device }: { device: Device }) {
  const asset = boardAssetFor(device.board_type, device.name)
  const pins = ['AREF', 'GND', '13', '12', '11', '10', '9', '8']
  const analog = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', '5V', '3V3']
  return <div className="relative mx-auto w-[230px]">
    <div className="absolute -inset-x-7 bottom-0 h-8 rounded-[50%] bg-[#1a2b3f]/15 blur-xl" />
    <div className="relative min-h-[470px] overflow-hidden rounded-[14px] border border-[#9dc8df] bg-[linear-gradient(rgba(50,112,150,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(50,112,150,.07)_1px,transparent_1px)] bg-[#eef8fc] bg-[size:18px_18px] px-4 py-5 shadow-[0_18px_30px_rgba(16,70,100,.2)]">
      <p className="text-center text-[9px] font-bold uppercase tracking-[.14em] text-[#0879b9]">Arduino Uno R3</p><p className="mt-1 truncate text-center text-[7px] font-semibold text-[#4b6c80]">{device.device_identifier}</p>
      <div className="absolute inset-x-2 top-[92px] flex justify-between">{pins.map((pin) => <span className="text-[5px] font-semibold text-[#54778b]" key={pin}>{pin}</span>)}</div>
      <div className="absolute inset-x-2 bottom-[112px] flex justify-between">{analog.map((pin) => <span className="text-[5px] font-semibold text-[#54778b]" key={pin}>{pin}</span>)}</div>
      <div className="absolute inset-x-2 top-[105px] flex justify-between">{pins.map((pin) => <i className="size-2 rounded-full border-2 border-[#d8b54b] bg-[#20394a]" key={pin} />)}</div>
      <div className="absolute inset-x-2 bottom-[124px] flex justify-between">{analog.map((pin) => <i className="size-2 rounded-full border-2 border-[#d8b54b] bg-[#20394a]" key={pin} />)}</div>
      <div className="absolute inset-x-2 top-[125px] grid h-[210px] place-items-center rounded-xl border border-white/70 bg-white/75 shadow-inner">{asset ? <img alt={`Imagen de ${device.name}`} className="h-full w-full object-contain p-2" decoding="async" draggable={false} src={asset} /> : <span className="text-xs font-semibold text-[#54778b]">Arduino Uno</span>}</div>
      <div className="absolute inset-x-7 bottom-12 flex items-center justify-center gap-1.5 rounded-full border border-[#b8d8e9] bg-white/90 px-2 py-1.5 text-[8px] font-semibold text-[#365a70]"><span className={`size-1.5 rounded-full ${device.status === 'conectado' ? 'bg-[#25c281]' : device.status === 'error' ? 'bg-[#ef5b62]' : 'bg-[#8b98a7]'}`} />{device.status}</div>
      <p className="absolute inset-x-0 bottom-5 text-center text-[6px] font-bold tracking-[.15em] text-[#0879b9]">SERIAL JSON · MQTT BRIDGE</p>
    </div>
  </div>
}

function Esp32Board({ device }: { device: Device }) {
  const pins = ['3V3', 'EN', 'VP', 'VN', '34', '35', '32', '33', '25', '26', '27', '14', '12', 'GND', '13']
  const rightPins = ['GND', '23', '22', 'TX', 'RX', '21', 'GND', '19', '18', '5', '17', '16', '4', '0', '2']
  return <div className="relative mx-auto w-[230px]">
    <div className="absolute -inset-x-7 bottom-0 h-8 rounded-[50%] bg-[#1a2b3f]/15 blur-xl" />
    <div className="relative min-h-[470px] overflow-hidden rounded-[9px] border border-[#16202b] bg-[#101923] px-5 pb-9 pt-5 shadow-[0_18px_30px_rgba(16,32,51,.28)]">
      <div className="mx-auto mb-3 h-12 w-28 border-x-2 border-t-2 border-[#cbd5df] opacity-80"><div className="mx-auto mt-2 h-8 w-20 border-x-2 border-t-2 border-[#cbd5df]" /></div>
      <div className="relative mx-auto h-142px min-h-[142px] w-[142px] border border-[#606f7e] bg-[#86929d] p-2 shadow-inner">
        <div className="grid h-full place-items-center border border-[#aeb7c0] bg-[#a7b0b8] text-center text-[#24313d]"><div><p className="text-[10px] font-bold">ESP32-WROOM-32</p><p className="mt-1 text-[6px]">WiFi · Bluetooth · 4 MB</p><span className="mx-auto mt-4 block w-12 border border-[#71808e] px-1 py-1 text-[6px]">CE FCC</span></div></div>
      </div>
      <div className="mx-auto mt-3 flex w-32 items-center justify-center gap-1.5 rounded-full border border-[#435365] bg-[#0b1219] px-2 py-1 text-[7px] font-semibold text-[#d7e1eb]"><span className={`size-1.5 rounded-full ${device.status === 'conectado' ? 'bg-[#25c281]' : device.status === 'error' ? 'bg-[#ef5b62]' : 'bg-[#8b98a7]'}`} />{device.status}</div>
      <p className="mt-2 truncate text-center text-[8px] font-semibold text-[#dce5ee]">{device.device_identifier}</p>
      <div className="mt-5 grid grid-cols-3 gap-3 px-5"><span className="h-8 border border-[#405063] bg-[#111a24]" /><span className="h-8 border border-[#405063] bg-[#111a24]" /><span className="h-8 border border-[#405063] bg-[#111a24]" /></div>
      <p className="mt-6 text-center text-[7px] font-bold tracking-[.18em] text-white">UDLAIOT</p><p className="mt-0.5 text-center text-[5px] tracking-[.1em] text-[#8999a9]">ESP32 DEV CONTROLLER</p>
      <div className="absolute inset-y-[88px] left-1.5 flex flex-col justify-between">{pins.map((pin, index) => <span className="flex items-center gap-1 text-[5px] text-[#c8d3de]" key={`${pin}-${index}`}><i className="size-2 rounded-full border-2 border-[#efbd35] bg-[#17212c]" />{pin}</span>)}</div>
      <div className="absolute inset-y-[88px] right-1.5 flex flex-col justify-between">{rightPins.map((pin, index) => <span className="flex flex-row-reverse items-center gap-1 text-[5px] text-[#c8d3de]" key={`${pin}-${index}`}>{pin}<i className="size-2 rounded-full border-2 border-[#efbd35] bg-[#17212c]" /></span>)}</div>
      <div className="absolute bottom-1 left-1/2 h-8 w-14 -translate-x-1/2 rounded-t border-2 border-[#aeb8c2] bg-[#cbd3da]"><span className="mx-auto mt-1.5 block h-3 w-8 bg-[#1d2b38]" /></div>
    </div>
  </div>
}

function DataRoute({ device }: { device: Device }) {
  const nodes = usesSerialBridge(device) ? [device.board_type, 'Puente Serial JSON', 'Mosquitto (MQTT)', 'FastAPI', 'PostgreSQL', 'WebSocket'] : [device.board_type, 'Mosquitto (MQTT)', 'FastAPI', 'PostgreSQL', 'WebSocket']
  return <div className="border-t border-[#dce5ef] bg-white px-5 py-3"><div className="flex items-center gap-3 overflow-x-auto"><span className="shrink-0 text-[10px] font-bold uppercase tracking-[.08em] text-[#617184]">Ruta de los datos</span><div className="flex min-w-max items-center gap-2">{nodes.map((node, index) => <span className="contents" key={node}>{index > 0 && <span aria-hidden="true" className="text-xs text-[#9aabba]">→</span>}<span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${index === 0 ? 'bg-[#e8f2ff] text-[#1268d6]' : 'border border-[#d8e2ec] bg-[#f8fafc] text-[#4a5d70]'}`}>{node}</span></span>)}</div></div></div>
}
