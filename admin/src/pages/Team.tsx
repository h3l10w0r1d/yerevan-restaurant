import { formatDistanceToNow, parseISO } from 'date-fns'
import { KeyRound, MoreHorizontal, Plus, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ROLE_LABEL } from '@/components/status'
import { TempPasswordDialog } from '@/components/temp-password'
import { api, describe } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { initials } from '@/lib/format'
import type { Role, User } from '@/lib/types'
import { useFetch } from '@/lib/use-fetch'

const ROLES: { value: Role; label: string; help: string }[] = [
  { value: 'staff', label: 'Staff', help: 'Reservations and orders' },
  { value: 'manager', label: 'Manager', help: 'Also the menu and settings' },
  { value: 'owner', label: 'Owner', help: 'Everything, including the team' },
]

export function Team() {
  const { user: me } = useAuth()
  const { data, reload, setData } = useFetch(() => api.get<User[]>('/admin/team'))
  const [invite, setInvite] = useState(false)
  const [secret, setSecret] = useState<{ value: string; name: string; email: string } | null>(null)
  const [removing, setRemoving] = useState<User | null>(null)

  async function update(u: User, body: Partial<Pick<User, 'role' | 'active'>>, message: string) {
    try {
      const saved = await api.patch<User>(`/admin/team/${u.id}`, body)
      setData((list) => list?.map((x) => (x.id === u.id ? saved : x)) ?? null)
      toast.success(message)
    } catch (e) {
      toast.error(describe(e))
    }
  }

  async function reset(u: User) {
    try {
      const res = await api.post<{ emailed: boolean; temporary_password: string | null }>(`/admin/team/${u.id}/reset-password`)
      if (res.emailed) toast.success(`Reset link emailed to ${u.email}`)
      else setSecret({ value: res.temporary_password!, name: u.name, email: u.email })
    } catch (e) {
      toast.error(describe(e))
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">People who can sign in to this admin panel.</p>
        <Button onClick={() => setInvite(true)}><Plus /> Add team member</Button>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Last sign-in</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((u) => (
              <TableRow key={u.id} className={u.active ? '' : 'opacity-60'}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9"><AvatarFallback className="bg-secondary text-secondary-foreground">{initials(u.name)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.name}{u.id === me?.id && <span className="ml-1 text-muted-foreground">(you)</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === 'owner' ? 'default' : 'secondary'}>
                    {u.role === 'owner' && <ShieldCheck />} {ROLE_LABEL[u.role]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {u.last_login_at ? formatDistanceToNow(parseISO(u.last_login_at + 'Z'), { addSuffix: true }) : 'Never'}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {u.active ? <Badge variant="outline">Active</Badge> : <Badge variant="destructive">Disabled</Badge>}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`} />}><MoreHorizontal /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52">
                      <DropdownMenuLabel>Role</DropdownMenuLabel>
                      <DropdownMenuRadioGroup value={u.role} onValueChange={(v) => update(u, { role: v as Role }, `${u.name} is now ${ROLE_LABEL[v as Role]}`)}>
                        {ROLES.map((r) => (
                          <DropdownMenuRadioItem key={r.value} value={r.value}>
                            <span className="grid"><span>{r.label}</span><span className="text-xs text-muted-foreground">{r.help}</span></span>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => reset(u)}><KeyRound /> Reset password</DropdownMenuItem>
                      {u.id !== me?.id && (u.active ? (
                        <DropdownMenuItem onClick={() => update(u, { active: false }, `${u.name} can no longer sign in`)}><UserX /> Disable access</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => update(u, { active: true }, `${u.name} can sign in again`)}><UserCheck /> Restore access</DropdownMenuItem>
                      ))}
                      {u.id !== me?.id && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setRemoving(u)}><Trash2 /> Remove</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>What each role can do</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.value} className="rounded-lg border p-3">
              <p className="font-medium">{r.label}</p>
              <p className="text-sm text-muted-foreground">{r.help}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <InviteDialog open={invite} onOpenChange={setInvite} onCreated={(u, pw) => {
        reload()
        if (pw) setSecret({ value: pw, name: u.name, email: u.email })
        else toast.success(`Invitation emailed to ${u.email}`)
      }} />
      <TempPasswordDialog value={secret?.value ?? null} name={secret?.name ?? ''} email={secret?.email ?? ''} onClose={() => setSecret(null)} />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They’ll be signed out and their account deleted. To pause access instead, disable the account.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => {
              try { await api.del(`/admin/team/${removing!.id}`); toast.success('Team member removed'); reload() } catch (e) { toast.error(describe(e)) }
              setRemoving(null)
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InviteDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: (u: User, password: string | null) => void
}) {
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' as Role })
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await api.post<{ user: User; temporary_password: string | null }>('/admin/team', form)
      onOpenChange(false)
      setForm({ name: '', email: '', role: 'staff' })
      onCreated(res.user, res.temporary_password)
    } catch (err) {
      toast.error(describe(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Add team member</DialogTitle>
            <DialogDescription>They’ll get an email to choose a password. If email isn’t set up yet, you’ll get a temporary password to pass on.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="t-name">Name</Label>
            <Input id="t-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-email">Email</Label>
            <Input id="t-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select items={ROLES} value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label} · {r.help}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add team member'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
