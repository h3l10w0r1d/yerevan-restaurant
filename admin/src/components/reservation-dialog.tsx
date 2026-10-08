import { format, parseISO } from 'date-fns'
import { CalendarIcon, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, describe } from '@/lib/api'
import { iso } from '@/lib/format'
import type { Reservation, ReservationInput, ReservationStatus } from '@/lib/types'
import { RESERVATION_STATUS } from './status'

const SOURCES = [
  { value: 'phone', label: 'Phone' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'web', label: 'Website' },
  { value: 'admin', label: 'Other' },
]
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'nl', label: 'Nederlands' }]
const STATUS_ITEMS = Object.entries(RESERVATION_STATUS).map(([value, s]) => ({ value, label: s.label }))

const WARNINGS: Record<string, string> = {
  outside_hours: 'This time is outside the regular booking slots.',
  over_capacity: 'This slot is now over its seating capacity.',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation?: Reservation | null
  defaultDate?: string
  onSaved: () => void
}

const empty = (date: string): ReservationInput => ({
  name: '', email: '', phone: '', date, time: '19:00', guests: 2, notes: '', internal_note: '',
  source: 'phone', status: 'confirmed', language: 'nl', notify_guest: true,
})

export function ReservationDialog({ open, onOpenChange, reservation, defaultDate, onSaved }: Props) {
  const [form, setForm] = useState<ReservationInput>(empty(defaultDate ?? iso(new Date())))
  const [busy, setBusy] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(reservation ? {
      name: reservation.name, email: reservation.email ?? '', phone: reservation.phone, date: reservation.date,
      time: reservation.time, guests: reservation.guests, notes: reservation.notes ?? '',
      internal_note: reservation.internal_note ?? '', source: reservation.source, status: reservation.status,
      language: reservation.language, notify_guest: true,
    } : empty(defaultDate ?? iso(new Date())))
  }, [open, reservation, defaultDate])

  const set = <K extends keyof ReservationInput>(key: K, value: ReservationInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const body = { ...form, email: form.email || null, notes: form.notes || null, internal_note: form.internal_note || null }
    try {
      const res = reservation
        ? await api.put<{ warnings: string[] }>(`/admin/reservations/${reservation.id}`, body)
        : await api.post<{ warnings: string[] }>('/admin/reservations', body)
      toast.success(reservation ? 'Reservation updated' : 'Reservation added')
      res.warnings.forEach((w) => toast.warning(WARNINGS[w] ?? w))
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(describe(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!reservation) return
    try {
      await api.del(`/admin/reservations/${reservation.id}`)
      toast.success('Reservation deleted')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(describe(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{reservation ? 'Edit reservation' : 'New reservation'}</DialogTitle>
            <DialogDescription>
              {reservation ? `Booked via ${reservation.source.replace('_', '-')} · #${reservation.id}` : 'For phone bookings and walk-ins.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="r-name">Guest name</Label>
            <Input id="r-name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="r-phone">Phone</Label>
              <Input id="r-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r-email">Email</Label>
              <Input id="r-email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-[1.4fr_1fr_0.8fr] gap-3">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger render={<Button type="button" variant="outline" className="justify-start font-normal" />}>
                  <CalendarIcon className="text-muted-foreground" />
                  {format(parseISO(form.date), 'EEE d MMM')}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(form.date)}
                    defaultMonth={parseISO(form.date)}
                    weekStartsOn={1}
                    onSelect={(d) => { if (d) { set('date', iso(d)); setDateOpen(false) } }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r-time">Time</Label>
              <Input id="r-time" type="time" step={900} required value={form.time} onChange={(e) => set('time', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r-guests">Guests</Label>
              <Input id="r-guests" type="number" min={1} max={200} required value={form.guests}
                onChange={(e) => set('guests', Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select items={STATUS_ITEMS} value={form.status} onValueChange={(v) => set('status', v as ReservationStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ITEMS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Source</Label>
              <Select items={SOURCES} value={form.source} onValueChange={(v) => set('source', v as ReservationInput['source'])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Guest’s language</Label>
            <Select items={LANGUAGES} value={form.language} onValueChange={(v) => set('language', String(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="r-notes">Guest notes</Label>
            <Textarea id="r-notes" rows={2} placeholder="Allergies, occasion, high chair…" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="r-internal">Internal note <span className="font-normal text-muted-foreground">(staff only)</span></Label>
            <Textarea id="r-internal" rows={2} placeholder="Table 4, regulars, VIP…" value={form.internal_note ?? ''} onChange={(e) => set('internal_note', e.target.value)} />
          </div>

          {!!form.email && (
            <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <Checkbox className="mt-0.5" checked={form.notify_guest} onCheckedChange={(c) => set('notify_guest', !!c)} />
              <span>
                <span className="font-medium">Email the guest</span>
                <span className="block text-xs text-muted-foreground">
                  Sends a confirmation (with calendar invite) or cancellation when that’s what changes, in the guest’s language.
                </span>
              </span>
            </label>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {reservation ? (
              <AlertDialog>
                <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
                  <Trash2 /> Delete
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this reservation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes {reservation.name}’s booking permanently. To keep a record, set the status to Cancelled instead.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={remove}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
