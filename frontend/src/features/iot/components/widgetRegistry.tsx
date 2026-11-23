import { Check, LoaderCircle, Power } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../../../components/common/Button'
import type { Channel } from '../../../types/entities'

type WidgetProps = {
  channel: Channel
  value: unknown
  disabled: boolean
  onCommand: (value: unknown) => void
}

function formatValue(value: unknown, maximumFractionDigits = 1) {
  if (typeof value !== 'number') return String(value)
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits }).format(value)
}

function SensorValue({ channel, value }: Pick<WidgetProps, 'channel' | 'value'>) {
  const displayed = value === null || value === undefined ? 'Sin datos' : typeof value === 'object' ? JSON.stringify(value) : formatValue(value, 1)
  return <p className="mt-1 min-w-0 truncate text-xl font-semibold text-[#101828]" title={`${displayed}${value !== null && value !== undefined && channel.unit ? ` ${channel.unit}` : ''}`}>{displayed}{value !== null && value !== undefined && channel.unit ? ` ${channel.unit}` : ''}</p>
}

function Indicator({ value }: Pick<WidgetProps, 'value'>) {
  const active = value === true
  return <div className="mt-2 flex items-center gap-2"><span className={`size-3 rounded-full ${active ? 'bg-[#16b364] shadow-[0_0_0_4px_#dcfae6]' : 'bg-[#98a2b3]'}`} /><span className="text-sm font-semibold">{active ? 'Activo' : 'Inactivo'}</span></div>
}

function SwitchControl({ value, disabled, onCommand }: WidgetProps) {
  const active = value === true
  return <Button className="mt-1.5 h-8 w-full justify-center px-3 text-[11px]" disabled={disabled} onClick={() => onCommand(!active)}>{disabled ? <LoaderCircle className="animate-spin" size={14} /> : <Power size={14} />}{active ? 'Apagar' : 'Encender'}</Button>
}

function SliderControl({ channel, value, disabled, onCommand }: WidgetProps) {
  const minimum = channel.minimum_value ?? 0
  const maximum = channel.maximum_value ?? 100
  const [draft, setDraft] = useState(typeof value === 'number' ? value : minimum)
  const step = channel.data_type === 'entero' ? 1 : 0.1
  const displayed = formatValue(draft, channel.data_type === 'entero' ? 0 : 1)
  return <div className="mt-1 grid grid-cols-[minmax(62px,1fr)_auto_32px] items-center gap-1.5"><input aria-label={`Valor de ${channel.name}`} className="min-w-0 w-full accent-[#1677ff]" disabled={disabled} max={maximum} min={minimum} onChange={(event) => setDraft(Number(Number(event.target.value).toFixed(3)))} step={step} type="range" value={draft} /><output className="min-w-11 max-w-16 truncate text-right text-[12px] font-semibold tabular-nums text-[#102033]" title={`${displayed}${channel.unit ? ` ${channel.unit}` : ''}`}>{displayed}{channel.unit ? <span className="ml-0.5 text-[9px] text-[#617184]">{channel.unit}</span> : null}</output><Button aria-label={`Aplicar valor de ${channel.name}`} className="size-8 px-0" disabled={disabled} onClick={() => onCommand(draft)} title="Aplicar valor"><Check size={14} /></Button></div>
}

function ButtonControl({ disabled, onCommand }: WidgetProps) {
  return <Button className="mt-1.5 h-8 w-full justify-center px-3 text-[11px]" disabled={disabled} onClick={() => onCommand(true)}>{disabled ? <LoaderCircle className="animate-spin" size={14} /> : <Power size={14} />}Ejecutar</Button>
}

const widgetRegistry = {
  interruptor: SwitchControl,
  deslizador: SliderControl,
  boton: ButtonControl,
  indicador: Indicator,
  tarjeta: SensorValue,
  grafico: SensorValue,
}

export function ChannelWidget(props: WidgetProps) {
  if (props.channel.category === 'sensor') {
    return props.channel.data_type === 'booleano' || props.channel.widget_type === 'indicador'
      ? <Indicator value={props.value} />
      : <SensorValue channel={props.channel} value={props.value} />
  }
  const Widget = widgetRegistry[props.channel.widget_type as keyof typeof widgetRegistry]
    ?? (props.channel.data_type === 'booleano' ? SwitchControl : props.channel.data_type === 'numero' || props.channel.data_type === 'entero' ? SliderControl : ButtonControl)
  return <Widget {...props} />
}
