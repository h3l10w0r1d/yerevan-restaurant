import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Shows a one-time password once, with copy. It is not stored anywhere in plain text. */
export function TempPasswordDialog({ value, name, email, onClose }: { value: string | null; name: string; email: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(`Yerevan admin\n${location.origin}/admin/\nEmail: ${email}\nTemporary password: ${value}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Temporary password for {name}</DialogTitle>
          <DialogDescription>
            Share it privately. It’s shown only this once; {name.split(' ')[0]} can change it under My account after signing in.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
          <p className="text-xs text-muted-foreground">{email}</p>
          <p className="mt-1 font-mono text-2xl tracking-wider select-all">{value}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy sign-in details'}</Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
