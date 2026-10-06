import { CalendarClock, Clock, ShoppingBag, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { ReservationBadge } from '@/components/status'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { shortDate } from '@/lib/format'
import type { Stats } from '@/lib/types'
import { useFetch } from '@/lib/use-fetch'

const chartConfig = {
  covers: { label: 'Guests', color: 'var(--chart-1)' },
} satisfies ChartConfig

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function Dashboard() {
  const { user } = useAuth()
  const { data, loading } = useFetch(() => api.get<Stats>('/admin/stats'))

  const tiles = [
    { label: 'Tonight', value: data?.today.reservations, sub: `${data?.today.covers ?? 0} guests`, icon: CalendarClock },
    { label: 'Next 7 days', value: data?.week.reservations, sub: `${data?.week.covers ?? 0} guests`, icon: Users },
    { label: 'To confirm', value: data?.pending, sub: 'pending requests', icon: Clock, href: '/reservations?status=pending' },
    { label: 'Open orders', value: data?.open_orders, sub: 'takeaway', icon: ShoppingBag, href: '/orders' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="font-heading text-3xl">{greeting()}, {user?.name.split(' ')[0]}</h2>
        <p className="text-muted-foreground">Here is how service is looking.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <Card className="h-full transition-colors hover:border-primary/30">
              <CardHeader>
                <CardDescription>{t.label}</CardDescription>
                <CardTitle className="font-heading text-3xl tabular-nums sm:text-4xl">
                  {loading ? <Skeleton className="h-9 w-12" /> : t.value}
                </CardTitle>
                <CardAction><t.icon className="size-5 text-muted-foreground" /></CardAction>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{t.sub}</CardContent>
            </Card>
          )
          return t.href ? <Link key={t.label} to={t.href}>{body}</Link> : <div key={t.label}>{body}</div>
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Guests, next two weeks</CardTitle>
            <CardDescription>Booked covers per day, excluding cancellations</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={data?.series ?? []} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={shortDate} minTickGap={16} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />} />
                  <Bar dataKey="covers" fill="var(--color-covers)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tonight</CardTitle>
            <CardDescription>{data ? `${data.today.reservations} bookings · ${data.today.covers} guests` : '…'}</CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" render={<Link to="/reservations" />}>Calendar</Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !data?.upcoming_today.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No bookings tonight yet.</p>
            ) : (
              <ul className="divide-y">
                {data.upcoming_today.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-12 font-medium tabular-nums">{r.time}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.guests} guests{r.notes ? ` · ${r.notes}` : ''}</p>
                    </div>
                    <ReservationBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
