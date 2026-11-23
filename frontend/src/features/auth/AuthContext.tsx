import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { apiRequest, refreshAccessToken, setAccessToken } from '../../services/api'
import type { User } from '../../types/entities'
import { usersApi } from '../crud/api'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (payload: Record<string, unknown>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refreshAccessToken<User>()
      .then((payload) => setUser(payload.user))
      .catch(() => {
        setAccessToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(username: string, password: string) {
    const payload = await apiRequest<{ access_token: string; user: User }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      false,
    )
    setAccessToken(payload.access_token)
    setUser(payload.user)
  }

  async function logout() {
    await apiRequest('/api/auth/logout', { method: 'POST' }, false).catch(() => undefined)
    setAccessToken(null)
    setUser(null)
  }

  async function updateProfile(payload: Record<string, unknown>) {
    const updated = await usersApi.updateMe(payload)
    setUser(updated)
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, updateProfile }),
    [user, loading],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
