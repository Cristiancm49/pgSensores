import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, ImagePlus, Pencil, Power } from 'lucide-react'

import { AuthenticatedImage } from '../../../components/common/AuthenticatedImage'
import { Button } from '../../../components/common/Button'
import { HardwareVisual } from '../../../components/common/HardwareVisual'
import type { Channel, DeviceCommand } from '../../../types/entities'
import { devicesApi } from '../../crud/api'
import { ChannelSparkline } from './ChannelSparkline'
import { ChannelWidget } from './widgetRegistry'

type Props = {
  channel: Channel
  onEdit: () => void
  onHistory: () => void
  onToggleActive: () => void
  onError: (error: Error) => void
  canWrite: boolean
  onImage: (file: File) => void
}

const terminalStatuses = new Set(['confirmado', 'fallido', 'expirado'])

function commandMessage(command?: DeviceCommand) {
  if (!command) return null
  if (command.status === 'pendiente' || command.status === 'enviado') return 'Comando enviado · esperando ACK'
  if (command.status === 'confirmado') return 'Confirmado por el dispositivo'
  if (command.status === 'expirado') return 'Sin respuesta del dispositivo'
  return command.error || 'El dispositivo rechazó el comando'
}

export function ChannelCard({ channel, canWrite, onEdit, onHistory, onToggleActive, onImage, onError }: Props) {
  const client = useQueryClient()
  const state = useQuery({
    queryKey: ['channel-state', channel.id],
    queryFn: () => devicesApi.state(channel.id),
    retry: false,
    enabled: channel.active,
  })
  const sendCommand = useMutation({
    mutationFn: (value: unknown) => devicesApi.sendCommand(channel.id, value),
    onSuccess: (command) => client.setQueryData(['command', command.id], command),
    onError,
  })
  const latestCommand = sendCommand.data
  const command = useQuery({
    queryKey: ['command', latestCommand?.id],
    queryFn: () => devicesApi.command(latestCommand!.id),
    enabled: Boolean(latestCommand),
    initialData: latestCommand,
    refetchInterval: (query) => {
      const current = query.state.data as DeviceCommand | undefined
      return current && !terminalStatuses.has(current.status) ? 750 : false
    },
  })
  const isActuator = channel.category === 'actuador'
  const waiting = Boolean(command.data && !terminalStatuses.has(command.data.status))
  const message = commandMessage(command.data)

  return <article className={`group overflow-hidden rounded-[14px] border bg-white shadow-[0_1px_3px_rgba(16,32,51,.05)] transition hover:border-[#b9d5f4] hover:shadow-[0_8px_24px_rgba(16,32,51,.08)] ${isActuator ? 'flex h-[288px] flex-col' : ''} ${channel.active ? 'border-[#dce3ea]' : 'border-[#dce3ea] opacity-65'}`}>
    <div className={`relative p-2.5 pb-0 ${isActuator ? '' : 'sm:p-3 sm:pb-0'}`}>
      <AuthenticatedImage
        alt={channel.name}
        className={`${isActuator ? 'h-14 sm:h-16' : 'h-16 sm:h-24'} w-full rounded-[11px]`}
        fallback={<HardwareVisual channelKey={channel.key} className={`${isActuator ? 'h-14 sm:h-16' : 'h-16 sm:h-24'} w-full rounded-[11px]`} kind={channel.category === 'actuador' ? 'actuator' : 'sensor'} label={channel.name} />}
        load={() => devicesApi.channelImage(channel.id)}
        queryKey={['channel', channel.id]}
      />
      <span className={`absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-white/80 px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur ${channel.active ? 'bg-[#e8f7ef]/95 text-[#137a49]' : 'bg-[#eef3f8]/95 text-[#617184]'}`}><span className="size-1.5 rounded-full bg-current" />{channel.active ? 'Activo' : 'Inactivo'}</span>
    </div>

    <div className={isActuator ? 'flex min-h-0 flex-1 flex-col p-2.5 pt-2' : 'p-3 pt-2.5 sm:p-3.5 sm:pt-3'}>
      <div className={isActuator ? 'min-h-[38px] shrink-0' : ''}><h3 className="truncate text-[14px] font-semibold text-[#102033]">{channel.name}</h3><p className={`${isActuator ? 'mt-0.5 text-[10px]' : 'mt-1 text-[11px]'} truncate text-[#617184]`}>{channel.key} · {channel.data_type}{channel.unit ? ` · ${channel.unit}` : ''}{channel.gpio ? ` · GPIO ${channel.gpio}` : ''}</p></div>
      <div className={`${isActuator ? 'mt-2 px-2.5 py-1.5' : 'mt-2.5 px-3 py-2 sm:mt-3 sm:py-2.5'} rounded-[11px] border border-[#edf1f5] bg-[#f7f9fc]`}><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8795a5]">Estado actual</p><div className={isActuator || (channel.data_type !== 'numero' && channel.data_type !== 'entero') ? '' : 'grid grid-cols-[minmax(0,1fr)_96px] items-end gap-3'}><ChannelWidget channel={channel} disabled={!canWrite || !channel.active || waiting || sendCommand.isPending} key={`${channel.id}-${state.data?.received_at ?? 'pending'}`} onCommand={(value) => sendCommand.mutate(value)} value={state.data?.value} />{!isActuator && (channel.data_type === 'numero' || channel.data_type === 'entero') && <ChannelSparkline channel={channel} />}</div><p className={`${isActuator ? 'mt-0.5' : 'mt-1'} truncate text-[10px] text-[#8795a5]`}>{state.data ? new Date(state.data.received_at).toLocaleString('es-CO') : 'Esperando la primera lectura'}</p>{message && <p className={`mt-1.5 text-center text-[11px] ${isActuator ? 'truncate' : ''} ${command.data?.status === 'confirmado' ? 'text-[#137a49]' : command.data?.status === 'fallido' || command.data?.status === 'expirado' ? 'text-[#ad2c25]' : 'text-[#617184]'}`} title={message}>{message}</p>}</div>
      <div className={`${isActuator ? 'mt-auto grid grid-cols-3 gap-1 pt-1.5' : 'mt-3 flex flex-wrap items-center gap-1.5 pt-3'} border-t border-[#edf1f5]`}>{!isActuator && <Button className="h-8 px-2.5" onClick={onHistory} variant="secondary"><History size={14} />Histórico</Button>}{canWrite && (isActuator ? <><Button aria-label={`Editar ${channel.name}`} className="h-8 px-0" onClick={onEdit} title="Editar actuador" variant="ghost"><Pencil size={15} /></Button><label aria-label={`Cambiar imagen de ${channel.name}`} className="grid h-8 cursor-pointer place-items-center rounded-[9px] text-[#4a5d70] transition hover:bg-[#eef3f8]" title="Cambiar imagen"><ImagePlus size={15} /><input accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImage(file) }} type="file" /></label><Button aria-label={`${channel.active ? 'Desactivar' : 'Activar'} ${channel.name}`} className="h-8 px-0" onClick={onToggleActive} title={channel.active ? 'Desactivar actuador' : 'Activar actuador'} variant="ghost"><Power size={15} /></Button></> : <><Button className="h-8 px-2.5" onClick={onEdit} variant="secondary"><Pencil size={14} />Editar</Button><label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#4a5d70] hover:bg-[#eef3f8]"><ImagePlus size={14} />Imagen<input accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImage(file) }} type="file" /></label><Button className="h-8 px-2.5" onClick={onToggleActive} variant="ghost">{channel.active ? 'Desactivar' : 'Activar'}</Button></>)}</div>
    </div>
  </article>
}

