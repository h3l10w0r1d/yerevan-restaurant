import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, session } from './api'
import type { Role, User } from './types'

type AuthState = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (u: User) => void
  can: (...roles: Role[]) => boolean
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!session.get())

  useEffect(() => {
    if (!session.get()) return
    api.get<User>('/auth/me').then(setUser).catch(() => session.clear()).finally(() => setLoading(false))
  }, [])

  // Any 401 from the API (expired or revoked session) signs the user out.
  useEffect(() => {
    const onUnauthorized = () => { session.clear(); setUser(null) }
    window.addEventListener('admin:unauthorized', onUnauthorized)
    return () => window.removeEventListener('admin:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password })
    session.set(res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {})
    session.clear()
    setUser(null)
  }, [])

  const can = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user])

  return <Ctx.Provider value={{ user, loading, login, logout, setUser, can }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
