import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth-shell'
import { api, describe } from '@/lib/api'

export function Forgot() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/auth/forgot', { email })
      setSent(true)
    } catch (err) {
      setError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your inbox" subtitle={<>If <strong>{email}</strong> has an account, we’ve sent a link to choose a new password. It works for 72 hours.</>}>
        <div className="flex justify-center"><MailCheck className="size-10 text-primary" /></div>
        <p className="text-center text-sm text-muted-foreground">No email after a few minutes? Check your spam folder, or ask the owner to reset your password from Team.</p>
        <Button variant="outline" className="w-full" render={<Link to="/login" />}>Back to sign in</Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we’ll send you a link to choose a new one.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="h-10 w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
        <Button type="button" variant="ghost" className="w-full" render={<Link to="/login" />}>Back to sign in</Button>
      </form>
    </AuthShell>
  )
}
