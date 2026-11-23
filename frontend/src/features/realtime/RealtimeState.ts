import { createContext, useContext } from 'react'

export type RealtimeContextValue = {
  connected: boolean
}

export const RealtimeContext = createContext<RealtimeContextValue>({ connected: false })

export function useRealtime() {
  return useContext(RealtimeContext)
}
