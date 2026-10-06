import {
  CalendarDays, ChevronsUpDown, ExternalLink, LayoutDashboard, LogOut, Moon, Settings,
  ShoppingBag, Sun, UserRound, Users, UtensilsCrossed,
} from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from '@/components/ui/sidebar'
import { useAuth } from '@/lib/auth'
import { initials } from '@/lib/format'
import { useTheme } from '@/lib/theme'
import type { Role } from '@/lib/types'
import { Mountain } from './brand'
import { ROLE_LABEL } from './status'

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; badge?: number }

export function AppSidebar({ pending }: { pending: number }) {
  const { user, can, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const { isMobile, setOpenMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()

  const service: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'manager', 'staff'] },
    { to: '/reservations', label: 'Reservations', icon: CalendarDays, roles: ['owner', 'manager', 'staff'], badge: pending },
    { to: '/orders', label: 'Orders', icon: ShoppingBag, roles: ['owner', 'manager', 'staff'] },
  ]
  const manage: NavItem[] = [
    { to: '/menu', label: 'Menu', icon: UtensilsCrossed, roles: ['owner', 'manager'] },
    { to: '/team', label: 'Team', icon: Users, roles: ['owner'] },
    { to: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'manager'] },
  ]

  const isActive = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))
  const close = () => isMobile && setOpenMobile(false)

  const group = (label: string, items: NavItem[]) => {
    const visible = items.filter((i) => can(...i.roles))
    if (!visible.length) return null
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-sidebar-foreground/60">{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  isActive={isActive(item.to)}
                  tooltip={item.label}
                  render={<NavLink to={item.to} end={item.to === '/'} onClick={close} />}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {!!item.badge && <SidebarMenuBadge className="bg-sidebar-primary text-sidebar-primary-foreground">{item.badge}</SidebarMenuBadge>}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<NavLink to="/" onClick={close} />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Mountain className="w-5" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="font-heading text-base uppercase tracking-[0.08em]">Yerevan</span>
                <span className="text-xs text-sidebar-foreground/60">Restaurant admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {group('Service', service)}
        {group('Manage', manage)}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent" />}
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    {initials(user?.name ?? '')}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user?.name}</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">{user && ROLE_LABEL[user.role]}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-56" side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="grid text-sm leading-tight">
                      <span className="font-medium text-foreground">{user?.name}</span>
                      <span className="text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => { close(); navigate('/account') }}>
                    <UserRound /> My account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggle}>
                    {dark ? <Sun /> : <Moon />} {dark ? 'Light mode' : 'Evening mode'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open('/', '_blank')}>
                    <ExternalLink /> View website
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => logout()}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
