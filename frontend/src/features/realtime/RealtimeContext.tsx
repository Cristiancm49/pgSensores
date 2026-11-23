import { useQueryClient } from '@tanstack/react-query'
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react'

import { getAccessToken } from '../../services/api'
import type { RealtimeEvent } from '../../types/entities'
import { useAuth } from '../auth/AuthContext'
import { RealtimeContext } from './RealtimeState'

function websocketBaseUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

export function RealtimeProvider({ children }: PropsWithChildren) {
  const { user, loading } = useAuth()
  const client = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    let socket: WebSocket | null = null
    let retry: number | undefined
    let disposed = false

    const connect = () => {
      const token = getAccessToken()
      if (!token || disposed) return
      socket = new WebSocket(`${websocketBaseUrl()}/api/ws?token=${encodeURIComponent(token)}`)
      socket.onopen = () => setConnected(true)
      socket.onmessage = (message) => {
        const event = JSON.parse(message.data) as RealtimeEvent
        if (event.device_id) client.invalidateQueries({ queryKey: ['device', event.device_id] })
        if (event.channel_id) {
          client.invalidateQueries({ queryKey: ['channel-state', event.channel_id] })
          client.invalidateQueries({ queryKey: ['telemetry', event.channel_id] })
        }
        if (event.command_id) client.invalidateQueries({ queryKey: ['command', event.command_id] })
        if (event.type === 'command_ack' || event.type === 'command_status') {
          client.invalidateQueries({ queryKey: ['commands', event.device_id] })
        }
        if (event.type === 'event') client.invalidateQueries({ queryKey: ['events'] })
      }
      socket.onclose = () => {
        setConnected(false)
        if (!disposed) retry = window.setTimeout(connect, 2000)
      }
      socket.onerror = () => socket?.close()
    }

    connect()
    return () => {
      disposed = true
      if (retry) window.clearTimeout(retry)
      socket?.close()
      setConnected(false)
    }
  }, [client, loading, user])

  const value = useMemo(() => ({ connected }), [connected])
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}
