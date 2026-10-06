import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ROLE_LABEL } from '@/components/status'
import { api, describe } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { initials } from '@/lib/format'
import { useTheme } from '@/lib/theme'
import type { User } from '@/lib/types'

export function Account() {
  const { user, setUser, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const [profile, setProfile] = useState({ name: user?.name ?? '', email: user?.email ?? '' })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null)

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setBusy('profile')
    try {
      setUser(await api.put<User>('/auth/me', profile))
      toast.success('Profile updated')
    } catch (err) {
      toast.error(describe(err))
    } finally {
      setBusy(null)
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    if (pw.next !== pw.confirm) return toast.error('The new passwords don’t match.')
    if (pw.next.length < 8) return toast.error('Use at least 8 characters.')
    setBusy('password')
    try {
      await api.post('/auth/password', { current_password: pw.current, new_password: pw.next })
      setPw({ current: '', next: '', confirm: '' })
      toast.success('Password changed. Other devices have been signed out.')
    } catch (err) {
      toast.error(describe(err))
    } finally {
      setBusy(null)
    }
  }

  if (!user) return null
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-14"><AvatarFallback className="bg-primary text-lg text-primary-foreground">{initials(user.name)}</AvatarFallback></Avatar>
        <div>
          <h2 className="font-heading text-2xl">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{ROLE_LABEL[user.role]} · {user.email}</p>
        </div>
      </div>

      <Card>
        <form onSubmit={saveProfile}>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your name is shown to the rest of the team.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="a-name">Name</Label>
              <Input id="a-name" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="a-email">Email (used to sign in)</Label>
              <Input id="a-email" type="email" required value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={busy === 'profile'}>Save profile</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <form onSubmit={savePassword}>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Changing it signs you out everywhere else.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="a-cur">Current password</Label>
              <Input id="a-cur" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="a-new">New password</Label>
                <Input id="a-new" type="password" autoComplete="new-password" minLength={8} required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="a-conf">Repeat new password</Label>
                <Input id="a-conf" type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={busy === 'password'}>Change password</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">Evening mode</span>
              <span className="text-xs text-muted-foreground">Night navy and amber, easier on the eyes during service.</span>
            </span>
            <Switch checked={dark} onCheckedChange={toggle} />
          </label>
          <Button variant="outline" onClick={() => logout()}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  )
}
