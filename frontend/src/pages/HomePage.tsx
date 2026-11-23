import { AppShell } from '../components/layout/AppShell'
import { Dashboard } from '../features/dashboard/components/Dashboard'

export function HomePage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  )
}

