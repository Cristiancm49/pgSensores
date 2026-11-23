import { useQuery } from '@tanstack/react-query'

import type { Channel } from '../../../types/entities'
import { devicesApi } from '../../crud/api'

export function ChannelSparkline({ channel, color = '#1677ff', className = '' }: { channel: Channel; color?: string; className?: string }) {
  const telemetry = useQuery({
    queryKey: ['channel-sparkline', channel.id],
    queryFn: () => devicesApi.telemetry(channel.id, { page: 1, page_size: 20 }),
    enabled: channel.active && (channel.data_type === 'numero' || channel.data_type === 'entero'),
    refetchInterval: 15_000,
  })
  const values = (telemetry.data?.items ?? [])
    .filter((point) => typeof point.value === 'number')
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((point) => point.value as number)
  const label = `Tendencia reciente de ${channel.name}`

  if (values.length < 2) return <div aria-label={`${label}: sin datos suficientes`} className={`flex h-[30px] items-center justify-center rounded-md bg-[#f2f5f8] text-[8px] text-[#98a5b3] ${className}`} role="img">Sin tendencia</div>
  const width = 96
  const height = 30
  const padding = 2
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = maximum - minimum || 1
  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - minimum) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')
  const [lastX, lastY] = points.split(' ').at(-1)!.split(',')

  return <svg aria-label={label} className={`h-[30px] w-full ${className}`} preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}><line stroke="#e4eaf0" strokeWidth="1" x1="0" x2={width} y1={height - 3} y2={height - 3} /><polyline fill="none" points={points} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /><circle cx={lastX} cy={lastY} fill={color} r="2" /></svg>
}
