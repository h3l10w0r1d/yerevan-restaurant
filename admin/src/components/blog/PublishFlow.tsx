import { format, parseISO } from 'date-fns'
import { ArrowLeft, ArrowRight, ExternalLink, Monitor, Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { imageUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

type Step = 'options' | 'confirm' | 'done'

/** Ghost-style full-screen publish flow: options → final review → "Boom. It's out there." */
export function PublishFlow({ title, excerpt, featureImage, postUrl, onPublish, onClose, onDone }: {
  title: string
  excerpt: string
  featureImage: string | null
  postUrl: string
  onPublish: (at: Date | null) => Promise<boolean>
  onClose: () => void
  onDone: () => void
}) {
  const [step, setStep] = useState<Step>('options')
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [date, setDate] = useState(() => format(new Date(Date.now() + 864e5), 'yyyy-MM-dd'))
  const [time, setTime] = useState('10:00')
  const [busy, setBusy] = useState(false)
  const at = when === 'later' ? new Date(`${date}T${time}:00`) : null
  const pretty = at ? format(at, "EEEE d MMMM yyyy 'at' HH:mm") : ''

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function go() {
    setBusy(true)
    const ok = await onPublish(at)
    setBusy(false)
    if (ok) setStep('done')
  }

  return (
    <div className="gh-publish" role="dialog" aria-modal="true" aria-label="Publish">
      <header className="gh-publish__bar">
        {step === 'confirm'
          ? <button type="button" className="gh-link" onClick={() => setStep('options')}><ArrowLeft /> Back to settings</button>
          : <span />}
        <button type="button" className="gh-link" onClick={step === 'done' ? onDone : onClose}>{step === 'done' ? 'Back to editor' : 'Close'} <X /></button>
      </header>

      <div className="gh-publish__body">
        {step === 'options' && (
          <>
            <h1><span className="gh-accent">Ready, set, publish.</span> Share it with the world.</h1>
            <div className="gh-publish__options">
              <div className="gh-publish__option is-open">
                <div className="gh-publish__option-head"><span>Publish</span><strong>{when === 'now' ? 'Right now' : pretty}</strong></div>
                <label className="gh-radio"><input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> Right now</label>
                <label className="gh-radio"><input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} /> Schedule for later</label>
                {when === 'later' && (
                  <div className="gh-publish__when">
                    <input type="date" value={date} min={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setDate(e.target.value)} />
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
            <button type="button" className="gh-btn-black gh-btn-lg" onClick={() => setStep('confirm')} disabled={when === 'later' && (!at || at <= new Date())}>
              Continue, final review <ArrowRight />
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <h1><span className="gh-accent">Ready to go?</span> Here’s what happens next.</h1>
            <p className="gh-publish__sentence">
              Your post will be published on <strong>the website</strong>, {at ? <>on <strong>{pretty}</strong></> : <strong>right now</strong>}.
            </p>
            <button type="button" className="gh-btn-green gh-btn-lg" onClick={go} disabled={busy}>
              {busy ? 'Publishing…' : at ? 'Schedule post' : 'Publish post, right now'}
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <h1><span className="gh-accent">{at ? 'All set!' : 'Boom! It’s out there.'}</span> {at ? `It goes live on ${pretty}.` : 'That’s great work.'}</h1>
            <a className="gh-publish__card" href={postUrl} target="_blank" rel="noreferrer">
              {featureImage && <img src={imageUrl(featureImage)} alt="" />}
              <div><strong>{title || 'Untitled'}</strong><p>{excerpt}</p></div>
            </a>
            <div className="gh-publish__actions">
              {!at && <a className="gh-btn-black" href={postUrl} target="_blank" rel="noreferrer">View post <ExternalLink /></a>}
              <button type="button" className="gh-btn-outline" onClick={() => navigator.clipboard.writeText(postUrl)}>Copy link</button>
              <button type="button" className="gh-btn-outline" onClick={onDone}>Back to editor</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Ghost-style preview: the real blog page in desktop or mobile size. */
export function PreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="gh-preview" role="dialog" aria-modal="true" aria-label="Preview">
      <header className="gh-preview__bar">
        <strong>Preview</strong>
        <div className="gh-seg-pill">
          <button type="button" className={cn(device === 'desktop' && 'is-active')} onClick={() => setDevice('desktop')}><Monitor /> Desktop</button>
          <button type="button" className={cn(device === 'mobile' && 'is-active')} onClick={() => setDevice('mobile')}><Smartphone /> Mobile</button>
        </div>
        <div className="gh-preview__right">
          <a className="gh-link" href={url} target="_blank" rel="noreferrer">Open in new tab <ExternalLink /></a>
          <button type="button" className="gh-link" onClick={onClose}>Close <X /></button>
        </div>
      </header>
      <div className={cn('gh-preview__frame', device === 'mobile' && 'is-mobile')}>
        <iframe title="Post preview" src={url} />
      </div>
    </div>
  )
}

export const fmtDate = (iso: string | null) => (iso ? format(parseISO(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`), 'd MMM yyyy, HH:mm') : '')
