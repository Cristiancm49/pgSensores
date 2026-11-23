import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { AuthProvider } from '../../features/auth/AuthContext'
import { RealtimeProvider } from '../../features/realtime/RealtimeContext'
import { ToastViewport } from '../../components/common/ToastViewport'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <RealtimeProvider>{children}</RealtimeProvider>
          <ToastViewport />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
