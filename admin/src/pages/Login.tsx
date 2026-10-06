import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mountain } from '@/components/brand'
import { describe } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <Mountain className="w-10 text-[#e8963a]" />
          <span className="font-heading text-lg uppercase tracking-[0.1em]">Yerevan</span>
        </div>
        <div>
          <p className="font-heading text-4xl leading-tight">
            Armenian cooking at the hour the city lights come on.
          </p>
          <p className="mt-4 text-sm text-primary-foreground/60">Kampstraat 22 · Hilversum</p>
        </div>
        <div
          className="absolute inset-x-0 bottom-0 h-10 opacity-50"
          style={{ backgroundImage: 'radial-gradient(circle, #e8963a 1.2px, transparent 1.6px)', backgroundSize: '18px 18px' }}
          aria-hidden
        />
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <Mountain className="mx-auto w-12 text-primary lg:hidden" />
            <h1 className="font-heading text-3xl">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to manage reservations, the menu and your team.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="h-10 w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <p className="text-center text-xs text-muted-foreground">Forgot your password? Ask the owner to reset it from Team.</p>
        </form>
      </div>
    </div>
  )
}
