import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EmailSettings } from '@/components/email-settings'
import { api, describe } from '@/lib/api'
import { WEEKDAYS } from '@/lib/format'
import type { Settings as SettingsT } from '@/lib/types'
import { useFetch } from '@/lib/use-fetch'

export function Settings() {
  const { data, setData } = useFetch(() => api.get<SettingsT>('/admin/settings'))
  const [form, setForm] = useState<SettingsT | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (data) setForm(structuredClone(data)) }, [data])
  if (!form) return <div className="mx-auto max-w-3xl space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>

  const dirty = JSON.stringify(form) !== JSON.stringify(data)
  const setR = (k: keyof SettingsT['restaurant'], v: string) => setForm({ ...form, restaurant: { ...form.restaurant, [k]: v } })
  const setNum = (k: 'slot_capacity' | 'slot_minutes' | 'last_seating_minutes' | 'max_party_size' | 'booking_window_days', v: string) =>
    setForm({ ...form, [k]: Math.max(0, parseInt(v, 10) || 0) })
  const setDay = (i: number, value: [string, string] | null) => {
    const hours = [...form.hours]
    hours[i] = value
    setForm({ ...form, hours })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const saved = await api.put<SettingsT>('/admin/settings', form)
      setData(saved)
      toast.success('Settings saved. The website uses them right away.')
    } catch (err) {
      toast.error(describe(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4 pb-20">
      <Card>
        <CardHeader>
          <CardTitle>Restaurant</CardTitle>
          <CardDescription>Shown on the website’s Visit section and footer.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {([['name', 'Name'], ['phone', 'Phone'], ['address', 'Street and number'], ['city', 'City'], ['email', 'Email']] as const).map(([k, label]) => (
            <div key={k} className={`grid gap-2 ${k === 'email' ? 'sm:col-span-2' : ''}`}>
              <Label htmlFor={`s-${k}`}>{label}</Label>
              <Input id={`s-${k}`} value={form.restaurant[k]} onChange={(e) => setR(k, e.target.value)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opening hours</CardTitle>
          <CardDescription>Closed days can’t be booked online and are shaded in the calendar.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {WEEKDAYS.map((day, i) => {
            const h = form.hours[i]
            return (
              <div key={day} className="flex flex-wrap items-center gap-3 py-2.5">
                <Switch checked={!!h} onCheckedChange={(open) => setDay(i, open ? ['17:00', '22:00'] : null)} aria-label={`Open on ${day}`} />
                <span className="w-28 font-medium">{day}</span>
                {h ? (
                  <div className="flex items-center gap-2">
                    <Input type="time" className="w-28" value={h[0]} onChange={(e) => setDay(i, [e.target.value, h[1]])} aria-label={`${day} opens`} />
                    <span className="text-muted-foreground">to</span>
                    <Input type="time" className="w-28" value={h[1]} onChange={(e) => setDay(i, [h[0], e.target.value])} aria-label={`${day} closes`} />
                  </div>
                ) : <span className="text-sm text-muted-foreground">Closed</span>}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Online bookings</CardTitle>
          <CardDescription>Rules for the reservation form on the website. Staff can always override them here.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {([
            ['slot_capacity', 'Guests per time slot', 'How many people can arrive in the same slot'],
            ['slot_minutes', 'Slot length (minutes)', 'Time between bookable times'],
            ['last_seating_minutes', 'Last booking before closing (minutes)', 'E.g. 90 → last table 1½ hours before close'],
            ['max_party_size', 'Largest party online', 'Bigger groups are asked to call or email'],
            ['booking_window_days', 'Book ahead up to (days)', ''],
          ] as const).map(([k, label, help]) => (
            <div key={k} className="grid gap-2">
              <Label htmlFor={`s-${k}`}>{label}</Label>
              <Input id={`s-${k}`} type="number" min={1} value={form[k]} onChange={(e) => setNum(k, e.target.value)} />
              {help && <p className="text-xs text-muted-foreground">{help}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Takeaway ordering</CardTitle>
          <CardDescription>When off, the website shows “Coming soon” and the cart is hidden.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">Accept online orders</span>
            <Switch checked={form.ordering_enabled} onCheckedChange={(v) => setForm({ ...form, ordering_enabled: v })} />
          </label>
        </CardContent>
      </Card>

      <EmailSettings form={form} setForm={setForm} />

      <div className={`fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur transition-transform md:left-(--sidebar-width) ${dirty ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 p-3">
          <span className="mr-auto text-sm text-muted-foreground">You have unsaved changes</span>
          <Button type="button" variant="outline" onClick={() => setForm(structuredClone(data!))}>Discard</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>
    </form>
  )
}
