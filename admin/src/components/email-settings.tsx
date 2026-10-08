import { formatDistanceToNow, parseISO } from 'date-fns'
import { CircleAlert, CircleCheck, CircleDashed, Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { api, describe } from '@/lib/api'
import type { EmailLogEntry, EmailStatus, Settings } from '@/lib/types'
import { useFetch } from '@/lib/use-fetch'

const TEMPLATES: Record<string, string> = {
  reservation_received: 'Booking received',
  reservation_confirmed: 'Booking confirmed',
  reservation_cancelled: 'Booking cancelled',
  staff_new_reservation: 'Staff: new booking',
  order_received: 'Order received',
  order_ready: 'Order ready',
  staff_new_order: 'Staff: new order',
  account_invite: 'Team invite',
  account_reset: 'Password reset',
  test: 'Test email',
}

const STATUS = {
  sent: { label: 'Sent', icon: CircleCheck, className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200' },
  failed: { label: 'Failed', icon: CircleAlert, className: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200' },
  skipped: { label: 'Not sent', icon: CircleDashed, className: 'bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300' },
} as const

/** Notification switches live in the Settings form; status, test and log are live from the API. */
export function EmailSettings({ form, setForm }: { form: Settings; setForm: (s: Settings) => void }) {
  const { data, reload } = useFetch(() => api.get<EmailStatus>('/admin/email'))
  const [testTo, setTestTo] = useState('')
  const [sending, setSending] = useState(false)
  const n = form.notifications
  const setN = (patch: Partial<Settings['notifications']>) => setForm({ ...form, notifications: { ...n, ...patch } })

  async function sendTest() {
    setSending(true)
    try {
      const res = await api.post<EmailLogEntry>('/admin/email/test', { to: testTo || undefined })
      if (res.status === 'sent') toast.success(`Test email sent to ${res.to}`)
      else if (res.status === 'skipped') toast.warning('Email isn’t connected yet, so nothing was sent.')
      else toast.error(`Sending failed: ${res.error}`)
      reload()
    } catch (e) {
      toast.error(describe(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>Confirmations to guests and alerts to the team, sent through Resend.</CardDescription>
          <CardAction>
            {data && (data.enabled
              ? <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200"><CircleCheck /> Connected</Badge>
              : <Badge variant="secondary"><CircleDashed /> Not connected</Badge>)}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {data && !data.enabled && (
            <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              No Resend API key is set, so emails are only recorded in the log below. Add <code className="font-mono">RESEND_API_KEY</code> to the
              server settings to start sending.
            </p>
          )}
          {data && (
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Sent from</dt><dd className="break-all">{data.from}</dd>
              <dt className="text-muted-foreground">Guests reply to</dt><dd className="break-all">{data.reply_to}</dd>
            </dl>
          )}

          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">Guest emails</span>
              <span className="text-xs text-muted-foreground">Booking received, confirmed (with calendar invite) or cancelled; takeaway order received and ready. In the guest’s language.</span>
            </span>
            <Switch checked={n.guest_emails} onCheckedChange={(v) => setN({ guest_emails: v })} />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">Alerts to the team</span>
              <span className="text-xs text-muted-foreground">An email for every new booking request and takeaway order from the website.</span>
            </span>
            <Switch checked={n.staff_emails} onCheckedChange={(v) => setN({ staff_emails: v })} />
          </label>
          <div className="grid gap-2">
            <Label htmlFor="s-staff-email">Send team alerts to</Label>
            <Input id="s-staff-email" type="email" placeholder={form.restaurant.email} value={n.staff_email}
              onChange={(e) => setN({ staff_email: e.target.value })} />
            <p className="text-xs text-muted-foreground">Leave empty to use the restaurant email.</p>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t pt-4">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="s-test">Send a test email</Label>
              <Input id="s-test" type="email" placeholder="Your own address" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={sendTest} disabled={sending}><Send /> {sending ? 'Sending…' : 'Send test'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Recent emails</CardTitle>
          <CardDescription>The last 50 emails the website tried to send.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {!data?.log.length ? (
            <p className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground"><Mail className="size-6" />Nothing sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">When</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden sm:table-cell">To</TableHead>
                  <TableHead className="pr-6 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.log.map((e) => {
                  const st = STATUS[e.status]
                  const badge = <Badge className={cn('border-0', st.className)}><st.icon /> {st.label}</Badge>
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="pl-6 whitespace-nowrap text-muted-foreground">
                        {formatDistanceToNow(parseISO(e.created_at + 'Z'), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <span className="block font-medium">{TEMPLATES[e.template] ?? e.template}</span>
                        <span className="block max-w-64 truncate text-xs text-muted-foreground">{e.subject}</span>
                      </TableCell>
                      <TableCell className="hidden max-w-48 truncate sm:table-cell">{e.to}</TableCell>
                      <TableCell className="pr-6 text-right">
                        {e.error ? (
                          <Tooltip>
                            <TooltipTrigger render={<span className="cursor-help" />}>{badge}</TooltipTrigger>
                            <TooltipContent className="max-w-xs">{e.error}</TooltipContent>
                          </Tooltip>
                        ) : badge}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
