import { ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ORDER_STATUS, OrderBadge } from '@/components/status'
import { api, describe } from '@/lib/api'
import { dateTime, euro } from '@/lib/format'
import type { Order, OrderStatus } from '@/lib/types'
import { useFetch } from '@/lib/use-fetch'

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: 'confirmed', label: 'Accept' },
  confirmed: { to: 'ready', label: 'Mark ready' },
  ready: { to: 'completed', label: 'Collected' },
}

export function Orders() {
  const [tab, setTab] = useState('open')
  const { data, loading, setData, reload } = useFetch(() => api.get<Order[]>('/admin/orders'))
  const { data: info } = useFetch(() => api.get<{ ordering_enabled: boolean }>('/info'))

  const rows = (data ?? []).filter((o) =>
    tab === 'open' ? ['pending', 'confirmed', 'ready'].includes(o.status) : !['pending', 'confirmed', 'ready'].includes(o.status))

  async function move(o: Order, status: OrderStatus) {
    setData((list) => list?.map((x) => (x.id === o.id ? { ...x, status } : x)) ?? null)
    try {
      await api.patch(`/admin/orders/${o.id}`, { status })
    } catch (e) {
      toast.error(describe(e))
      reload()
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {info && !info.ordering_enabled && (
        <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Online ordering is switched off, so the website shows “Coming soon”. Turn it on in Settings when the kitchen is ready.
        </div>
      )}
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="items-center py-16 text-center">
          <ShoppingBag className="size-8 text-muted-foreground" />
          <p className="text-muted-foreground">{tab === 'open' ? 'No open orders.' : 'No finished orders yet.'}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((o) => (
            <Card key={o.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="font-heading text-xl">#{o.id} · {o.name}</span>
                  <span className="ml-auto"><OrderBadge status={o.status} /></span>
                </CardTitle>
                <CardDescription>Pickup {dateTime(o.pickup_at)} · <a className="underline" href={`tel:${o.phone}`}>{o.phone}</a></CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  {o.items.map((i) => (
                    <li key={i.item_id} className="flex justify-between gap-2">
                      <span>{i.quantity} × {i.name}</span>
                      <span className="tabular-nums text-muted-foreground">{euro(i.price * i.quantity)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between border-t pt-1 font-medium"><span>Total</span><span className="tabular-nums">{euro(o.total_cents)}</span></li>
                </ul>
                {o.notes && <p className="rounded-md bg-muted px-3 py-2 text-sm">“{o.notes}”</p>}
                <div className="flex flex-wrap gap-2">
                  {NEXT[o.status] && <Button size="sm" onClick={() => move(o, NEXT[o.status]!.to)}>{NEXT[o.status]!.label}</Button>}
                  {o.status !== 'cancelled' && o.status !== 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => move(o, 'cancelled')}>Cancel order</Button>
                  )}
                  {(o.status === 'cancelled' || o.status === 'completed') && (
                    <Button size="sm" variant="ghost" onClick={() => move(o, 'pending')}>Reopen</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Status flow: {Object.values(ORDER_STATUS).map((s) => s.label).join(' → ')}</p>
    </div>
  )
}
