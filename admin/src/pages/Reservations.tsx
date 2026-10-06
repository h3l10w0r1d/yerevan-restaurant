import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday,
  parseISO, startOfMonth, startOfWeek,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, List, Mail, MoreHorizontal, Pencil, Phone, Plus, Search, StickyNote, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ReservationDialog } from '@/components/reservation-dialog'
import { RESERVATION_STATUS, ReservationBadge } from '@/components/status'
import { cn } from '@/lib/utils'
import { api, describe } from '@/lib/api'
import { iso, prettyDate } from '@/lib/format'
import type { Hours, Reservation, ReservationStatus } from '@/lib/types'
import { useFetch } from '@/lib/use-fetch'

const LIVE: ReservationStatus[] = ['pending', 'confirmed', 'seated', 'completed']
const FILTERS = [{ value: 'all', label: 'All statuses' }, ...Object.entries(RESERVATION_STATUS).map(([value, s]) => ({ value, label: s.label }))]

export function Reservations() {
  const [params, setParams] = useSearchParams()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => iso(new Date()))
  const [view, setView] = useState<'month' | 'list'>(params.get('status') ? 'list' : 'month')
  const [query, setQuery] = useState('')
  const status = params.get('status') ?? 'all'
  const [dialog, setDialog] = useState<{ open: boolean; reservation?: Reservation | null; date?: string }>({ open: false })

  const gridStart = startOfWeek(month, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart.getTime(), gridEnd.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: rows, loading, reload, setData } = useFetch(
    () => api.get<Reservation[]>(`/admin/reservations?start=${iso(gridStart)}&end=${iso(gridEnd)}`),
    [gridStart.getTime(), gridEnd.getTime()],
  )
  const { data: info } = useFetch(() => api.get<{ hours: Hours }>('/info'))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows ?? []).filter((r) =>
      (status === 'all' || r.status === status) &&
      (!q || `${r.name} ${r.phone} ${r.email ?? ''}`.toLowerCase().includes(q)))
  }, [rows, status, query])

  const byDay = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    for (const r of filtered) map.set(r.date, [...(map.get(r.date) ?? []), r])
    return map
  }, [filtered])

  const dayRows = (byDay.get(selected) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time))
  const covers = (list: Reservation[]) => list.filter((r) => LIVE.includes(r.status)).reduce((n, r) => n + r.guests, 0)
  const isClosed = (d: Date) => !!info && !info.hours[(d.getDay() + 6) % 7]

  async function setStatus(r: Reservation, next: ReservationStatus) {
    setData((list) => list?.map((x) => (x.id === r.id ? { ...x, status: next } : x)) ?? null)
    try {
      await api.patch(`/admin/reservations/${r.id}`, { status: next })
      toast.success(`${r.name}: ${RESERVATION_STATUS[next].label.toLowerCase()}`)
    } catch (e) {
      toast.error(describe(e))
      reload()
    }
  }

  const goMonth = (delta: number) => setMonth((m) => addMonths(m, delta))
  const goToday = () => { setMonth(startOfMonth(new Date())); setSelected(iso(new Date())) }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="outline" size="icon" onClick={() => goMonth(1)} aria-label="Next month"><ChevronRight /></Button>
          <Button variant="outline" onClick={goToday}>Today</Button>
        </div>
        <h2 className="mr-auto font-heading text-2xl">{format(month, 'MMMM yyyy')}</h2>
        <div className="relative w-full sm:w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search guests" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select items={FILTERS} value={status} onValueChange={(v) => setParams(v === 'all' ? {} : { status: String(v) })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
        </Select>
        <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as 'month' | 'list')} variant="outline">
          <ToggleGroupItem value="month" aria-label="Calendar view"><CalendarDays /></ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view"><List /></ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={() => setDialog({ open: true, reservation: null, date: selected })}><Plus /> New</Button>
      </div>

      {view === 'month' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          {/* Month grid */}
          <Card className="gap-0 overflow-hidden py-0">
            <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = iso(day)
                const list = (byDay.get(key) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time))
                const isSel = key === selected
                const closed = isClosed(day)
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    onDoubleClick={() => setDialog({ open: true, reservation: null, date: key })}
                    className={cn(
                      'group relative flex min-h-20 flex-col gap-1 border-r border-b p-1.5 text-left transition-colors last:border-r-0 sm:min-h-28 [&:nth-child(7n)]:border-r-0',
                      !isSameMonth(day, month) && 'bg-muted/30 text-muted-foreground',
                      closed && 'bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--muted)_6px,var(--muted)_7px)]',
                      isSel ? 'ring-2 ring-primary ring-inset' : 'hover:bg-accent/50',
                    )}
                    aria-pressed={isSel}
                    aria-label={`${format(day, 'EEEE d MMMM')}, ${list.length} reservations`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('flex size-6 items-center justify-center rounded-full text-sm tabular-nums',
                        isToday(day) && 'bg-primary font-semibold text-primary-foreground')}>
                        {format(day, 'd')}
                      </span>
                      {covers(list) > 0 && (
                        <span className="hidden items-center gap-0.5 text-[11px] font-medium text-muted-foreground tabular-nums sm:flex" title={`${covers(list)} guests`}>
                          <Users className="size-3" />{covers(list)}
                        </span>
                      )}
                    </div>
                    {/* Chips on wider screens, dots on phones */}
                    <div className="hidden flex-col gap-0.5 sm:flex">
                      {list.slice(0, 3).map((r) => (
                        <span key={r.id} className={cn('flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] leading-tight',
                          RESERVATION_STATUS[r.status].className)}>
                          <span className="font-medium tabular-nums">{r.time}</span>
                          <span className="truncate">{r.name}</span>
                          <span className="ml-auto pl-1 tabular-nums opacity-70">{r.guests}</span>
                        </span>
                      ))}
                      {list.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{list.length - 3} more</span>}
                    </div>
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {list.slice(0, 6).map((r) => <span key={r.id} className={cn('size-1.5 rounded-full', RESERVATION_STATUS[r.status].dot)} />)}
                    </div>
                    {closed && isSameMonth(day, month) && !list.length && (
                      <span className="mt-auto hidden text-[11px] text-muted-foreground sm:block">Closed</span>
                    )}
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Day agenda */}
          <Card className="h-fit xl:sticky xl:top-20">
            <CardHeader>
              <CardTitle className="font-heading text-xl">{prettyDate(selected)}</CardTitle>
              <CardDescription>
                {dayRows.length ? `${dayRows.length} bookings · ${covers(dayRows)} guests` : 'No bookings'}
                {isClosed(parseISO(selected)) && ' · closed day'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && !rows ? (
                [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : dayRows.map((r) => (
                <div key={r.id} className={cn('rounded-lg border p-3', ['cancelled', 'no_show'].includes(r.status) && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <div className="w-12 pt-0.5 font-heading text-lg tabular-nums">{r.time}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{r.guests} {r.guests === 1 ? 'guest' : 'guests'} · {r.source.replace('_', '-')}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuItem onClick={() => setDialog({ open: true, reservation: r })}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Set status</DropdownMenuLabel>
                        {(Object.keys(RESERVATION_STATUS) as ReservationStatus[]).filter((s) => s !== r.status).map((s) => (
                          <DropdownMenuItem key={s} onClick={() => setStatus(r, s)}>
                            <span className={cn('size-2 rounded-full', RESERVATION_STATUS[s].dot)} /> {RESERVATION_STATUS[s].label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-15 text-xs text-muted-foreground">
                    <ReservationBadge status={r.status} />
                    {r.phone && <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="size-3" />{r.phone}</a>}
                    {r.email && <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="size-3" />Email</a>}
                  </div>
                  {(r.notes || r.internal_note) && (
                    <div className="mt-2 space-y-1 pl-15 text-xs">
                      {r.notes && <p className="text-foreground/80">“{r.notes}”</p>}
                      {r.internal_note && <p className="flex gap-1 text-amber-700 dark:text-amber-300"><StickyNote className="size-3 shrink-0" />{r.internal_note}</p>}
                    </div>
                  )}
                  {r.status === 'pending' && (
                    <div className="mt-3 flex gap-2 pl-15">
                      <Button size="sm" onClick={() => setStatus(r, 'confirmed')}>Confirm</Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(r, 'cancelled')}>Decline</Button>
                    </div>
                  )}
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed" onClick={() => setDialog({ open: true, reservation: null, date: selected })}>
                <Plus /> Add booking on {format(parseISO(selected), 'd MMM')}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead className="text-right">Guests</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  {loading ? 'Loading…' : 'No reservations match this month and filter.'}
                </TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setDialog({ open: true, reservation: r })}>
                  <TableCell className="pl-4">{format(parseISO(r.date), 'EEE d MMM')}</TableCell>
                  <TableCell className="tabular-nums">{r.time}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.guests}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{r.phone || r.email}</TableCell>
                  <TableCell><ReservationBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    {r.status === 'pending' && (
                      <Button size="xs" onClick={(e) => { e.stopPropagation(); setStatus(r, 'confirmed') }}>Confirm</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ReservationDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        reservation={dialog.reservation}
        defaultDate={dialog.date}
        onSaved={reload}
      />
    </div>
  )
}

