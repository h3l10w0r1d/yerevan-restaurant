import { Loader2 } from 'lucide-react'
import { lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { useAuth } from '@/lib/auth'
import type { Role } from '@/lib/types'
import { Login } from '@/pages/Login'

// Pages load on demand; the dashboard's chart library stays out of the first download.
const page = <K extends string>(name: K, load: () => Promise<Record<K, () => ReactNode>>) =>
  lazy(() => load().then((m) => ({ default: m[name] })))
const Dashboard = page('Dashboard', () => import('@/pages/Dashboard'))
const Reservations = page('Reservations', () => import('@/pages/Reservations'))
const Orders = page('Orders', () => import('@/pages/Orders'))
const Menu = page('Menu', () => import('@/pages/Menu'))
const Team = page('Team', () => import('@/pages/Team'))
const Settings = page('Settings', () => import('@/pages/Settings'))
const Account = page('Account', () => import('@/pages/Account'))

const Spinner = () => <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, can } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !can(...roles)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { loading } = useAuth()
  if (loading) {
    return <Spinner />
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="orders" element={<Orders />} />
        <Route path="menu" element={<Guard roles={['owner', 'manager']}><Menu /></Guard>} />
        <Route path="team" element={<Guard roles={['owner']}><Team /></Guard>} />
        <Route path="settings" element={<Guard roles={['owner', 'manager']}><Settings /></Guard>} />
        <Route path="account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
