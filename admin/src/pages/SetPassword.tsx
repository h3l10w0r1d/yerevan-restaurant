import { Loader2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth-shell'
import { api, describe } from '@/lib/api'
import { useAuth } from '@/lib/auth'

type Info = { name: string; email: string; purpose: 'invite' | 'reset' }

/** Landing page for invite and password-reset links: /set-password?token=… */
export function SetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { login } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState<Info | null>(null)
  const [invalid, setInvalid] = useState(!token)
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api.get<Info>(`/auth/token?token=${encodeURIComponent(token)}`).then(setInfo).catch(() => setInvalid(true))
  }, [token])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pw.next.length < 8) return setError('Use at least 8 characters.')
    if (pw.next !== pw.confirm) return setError('The passwords don’t match.')
    setBusy(true)
    setError('')
    try {
      const { email } = await api.post<{ email: string }>('/auth/reset', { token, password: pw.next })
      await login(email, pw.next)
      toast.success(info?.purpose === 'invite' ? 'Welcome! Your account is ready.' : 'Password changed.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  if (invalid) {
    return (
      <AuthShell title="This link has expired" subtitle="Links work once and for 72 hours. Ask for a new one below, or ask the owner to resend your invite.">
        <Button className="w-full" render={<Link to="/forgot" />}>Get a new link</Button>
        <Button variant="ghost" className="w-full" render={<Link to="/login" />}>Back to sign in</Button>
      </AuthShell>
    )
  }
  if (!info) return <div className="flex min-h-svh items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

  return (
    <AuthShell
      title={info.purpose === 'invite' ? `Welcome, ${info.name.split(' ')[0]}` : 'Choose a new password'}
      subtitle={<>For <strong>{info.email}</strong>. You’ll be signed in straight after.</>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" autoComplete="new-password" minLength={8} required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className="h-10" />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw2">Repeat password</Label>
          <Input id="pw2" type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="h-10" />
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="h-10 w-full" disabled={busy}>{busy ? 'Saving…' : 'Save and sign in'}</Button>
      </form>
    </AuthShell>
  )
}
