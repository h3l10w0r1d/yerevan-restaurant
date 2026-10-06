import { Suspense, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { api } from '@/lib/api'
import { AppSidebar } from './app-sidebar'

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/reservations': 'Reservations',
  '/orders': 'Orders',
  '/menu': 'Menu',
  '/team': 'Team',
  '/settings': 'Settings',
  '/account': 'My account',
}

export function Layout() {
  const location = useLocation()
  const [pending, setPending] = useState(0)
  const title = TITLES[location.pathname] ?? ''

  // Keep the "pending reservations" badge fresh as staff move around.
  useEffect(() => {
    api.get<{ pending: number }>('/admin/stats').then((s) => setPending(s.pending)).catch(() => {})
  }, [location.pathname])

  useEffect(() => { document.title = `${title ? `${title} · ` : ''}Yerevan admin` }, [title])

  return (
    <SidebarProvider>
      <AppSidebar pending={pending} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 data-vertical:self-auto" />
          <h1 className="font-heading text-lg">{title}</h1>
        </header>
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
