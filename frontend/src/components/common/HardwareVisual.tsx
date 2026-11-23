import {
  Activity, Droplets, Fan, Gauge, Lightbulb, Sprout, Sun,
  Thermometer, ToggleLeft, Waves, type LucideIcon,
} from 'lucide-react'

import { boardAssetFor, channelAssetFor } from '../../features/hardware/hardwareCatalog'

type HardwareVisualProps = {
  className?: string
  label: string
  kind: 'device' | 'sensor' | 'actuator'
  boardType?: string | null
  channelKey?: string
}

function BoardIllustration({ boardType, label }: { boardType: string; label: string }) {
  const arduino = boardType.toLowerCase().includes('arduino')
  const boardColor = arduino ? '#0879b9' : '#14766a'
  const boardEdge = arduino ? '#075b8d' : '#0d5c53'
  return <svg aria-label={`Ilustración de ${label}`} className="h-full w-full" role="img" viewBox="0 0 320 180">
    <rect fill="#f2f7fc" height="180" width="320" />
    <path d="M0 32H320M0 76H320M0 120H320M44 0V180M112 0V180M180 0V180M248 0V180" stroke="#dfe9f2" strokeWidth="1" />
    <ellipse cx="160" cy="150" fill="#16324a" opacity=".1" rx="112" ry="12" />
    <rect fill={boardEdge} height="118" rx="16" width="218" x="51" y="28" />
    <rect fill={boardColor} height="110" rx="13" width="210" x="55" y="30" />
    {arduino ? <>
      <rect fill="#d7e3ec" height="30" rx="4" width="38" x="45" y="61" />
      <rect fill="#71879a" height="22" rx="2" width="30" x="49" y="65" />
      <rect fill="#202d38" height="50" rx="6" width="76" x="126" y="60" />
      <circle cx="224" cy="50" fill="#dce8ef" r="8" /><circle cx="224" cy="50" fill="#687b8c" r="3" />
      <circle cx="224" cy="120" fill="#dce8ef" r="8" /><circle cx="224" cy="120" fill="#687b8c" r="3" />
      <text fill="#d9f3ff" fontFamily="ui-sans-serif, system-ui" fontSize="12" fontWeight="700" x="112" y="48">ARDUINO</text>
    </> : <>
      <rect fill="#d9e3e9" height="40" rx="4" width="49" x="136" y="18" />
      <path d="M145 24h31v5h-31zm0 10h31v5h-31zm0 10h31v5h-31z" fill="#8ba0ad" />
      <rect fill="#17232d" height="58" rx="5" width="70" x="125" y="68" />
      <path d="M133 76h54v42h-54z" fill="#253744" />
      <path d="M215 48h28v5h-28zm0 10h28v5h-28zm0 10h28v5h-28zm0 10h28v5h-28z" fill="#d8c45d" />
      <text fill="#d8fff8" fontFamily="ui-sans-serif, system-ui" fontSize="12" fontWeight="700" x="72" y="52">ESP32</text>
      <path d="M78 67c19-14 39-14 58 0M86 77c14-9 28-9 42 0M96 87c7-4 14-4 21 0" fill="none" opacity=".6" stroke="#b5efe5" strokeLinecap="round" strokeWidth="2" />
    </>}
    {Array.from({ length: 12 }, (_, index) => <g key={index}><circle cx={69 + index * 16} cy="133" fill="#17232d" r="4" /><circle cx={69 + index * 16} cy="37" fill="#17232d" r="4" /></g>)}
    <text fill="#ffffff" fontFamily="ui-sans-serif, system-ui" fontSize="9" fontWeight="600" opacity=".78" textAnchor="middle" x="160" y="101">{arduino ? 'ATMEGA328P' : 'WiFi · BLE · MQTT'}</text>
  </svg>
}

function channelAppearance(key: string, kind: 'sensor' | 'actuator'): { icon: LucideIcon; color: string; soft: string; detail: string } {
  const text = key.toLowerCase()
  if (text.includes('temp')) return { icon: Thermometer, color: '#d84a3d', soft: '#fff0ef', detail: 'Temperatura' }
  if (text.includes('suelo') || text.includes('planta')) return { icon: Sprout, color: '#139a5b', soft: '#e8f7ef', detail: 'Suelo' }
  if (text.includes('humedad') || text.includes('agua')) return { icon: Droplets, color: '#0b6ffb', soft: '#eaf3ff', detail: 'Humedad' }
  if (text.includes('luz') || text.includes('lux')) return { icon: Sun, color: '#b86608', soft: '#fff4df', detail: 'Iluminación' }
  if (text.includes('presion')) return { icon: Gauge, color: '#7047c8', soft: '#f2edff', detail: 'Presión' }
  if (text.includes('bomba') || text.includes('riego')) return { icon: Waves, color: '#0879b9', soft: '#e8f6fc', detail: 'Riego' }
  if (text.includes('ventil') || text.includes('fan')) return { icon: Fan, color: '#14766a', soft: '#e5f6f2', detail: 'Ventilación' }
  if (text.includes('led') || text.includes('luz')) return { icon: Lightbulb, color: '#b86608', soft: '#fff4df', detail: 'Iluminación' }
  return kind === 'actuator'
    ? { icon: ToggleLeft, color: '#7047c8', soft: '#f2edff', detail: 'Actuador' }
    : { icon: Activity, color: '#0b6ffb', soft: '#eaf3ff', detail: 'Sensor' }
}

export function HardwareVisual({ className = '', label, kind, boardType, channelKey = '' }: HardwareVisualProps) {
  if (kind === 'device') {
    const asset = boardAssetFor(boardType, label)
    return <div className={`relative overflow-hidden border border-[#dce3ea] bg-[linear-gradient(rgba(90,120,150,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(90,120,150,.06)_1px,transparent_1px)] bg-[#f2f7fc] bg-[size:22px_22px] ${className}`}>{asset ? <><span className="absolute inset-x-[18%] bottom-[10%] h-[12%] rounded-[50%] bg-[#18364f]/15 blur-md" /><img alt={`Imagen de ${label}`} className="relative h-full w-full object-contain p-3" decoding="async" draggable={false} loading="lazy" src={asset} /></> : <BoardIllustration boardType={boardType || label} label={label} />}</div>
  }
  const appearance = channelAppearance(`${channelKey} ${label}`, kind)
  const asset = channelAssetFor(channelKey, label, kind === 'actuator' ? 'actuador' : 'sensor')
  const Icon = appearance.icon
  return <div aria-label={`Ilustración de ${label}`} className={`relative grid overflow-hidden border border-[#dce3ea] ${className}`} role="img" style={{ background: appearance.soft }}>
    <span className="absolute -right-6 -top-8 size-24 rounded-full border-[18px] opacity-30" style={{ borderColor: appearance.color }} />
    <span className="absolute bottom-3 left-3 h-px w-14 opacity-25" style={{ background: appearance.color }} />
    <span className="absolute bottom-3 left-[76px] size-1.5 rounded-full opacity-50" style={{ background: appearance.color }} />
    <div className="relative flex min-w-0 items-center justify-center gap-3 p-2.5 sm:p-3">{asset ? <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/85 shadow-[0_8px_22px_rgba(16,32,51,.08)]"><img alt="" className="h-full w-full object-contain p-1.5" decoding="async" draggable={false} loading="lazy" src={asset} /></span> : <span className="grid size-12 place-items-center rounded-2xl bg-white/85 shadow-[0_8px_22px_rgba(16,32,51,.08)]" style={{ color: appearance.color }}><Icon size={25} strokeWidth={1.8} /></span>}<div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.14em] opacity-60" style={{ color: appearance.color }}>{appearance.detail}</p><p className="mt-1 max-w-32 truncate text-xs font-semibold text-[#34465a]">{label}</p></div></div>
  </div>
}

