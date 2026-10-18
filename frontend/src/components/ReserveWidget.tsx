import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, type Slot } from '../api'
import { bookingError, firstOpenDay, isoDate, localSlots, weekday } from '../booking'
import { fill, useI18n } from '../i18n'
import { useRestaurant } from '../restaurant'
import { useReserveWidget } from '../reserve-widget'
import { useOpeningDate } from './ComingSoon'
import { DatePicker } from './DatePicker'
import { Select } from './Select'

const Icon = {
  guests: <svg viewBox="0 0 20 20" aria-hidden><circle cx="10" cy="7" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M3.8 17c.8-3.2 3.3-5 6.2-5s5.4 1.8 6.2 5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  date: <svg viewBox="0 0 20 20" aria-hidden><rect x="3" y="4.5" width="14" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  time: <svg viewBox="0 0 20 20" aria-hidden><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10 6v4.3l2.8 1.7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  close: <svg viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
}

type Step = 'pick' | 'details' | 'done'

/** Booking popup that opens from the header button, anchored top right (Guestplan-style). */
export function ReserveWidget() {
  const { open, hide } = useReserveWidget()
  const [visible, setVisible] = useState(open) // stays mounted during the closing animation
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) { setVisible(true); setClosing(false) }
    else if (visible) {
      setClosing(true)
      const id = setTimeout(() => { setVisible(false); setClosing(false) }, 180)
      return () => clearTimeout(id)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null
  return <Panel closing={closing} onClose={hide} />
}

function Panel({ closing, onClose }: { closing: boolean; onClose: () => void }) {
  const { t, lang } = useI18n()
  const R = useRestaurant()
  const openingDate = useOpeningDate()
  const panel = useRef<HTMLDivElement>(null)
  const maxDate = useMemo(() => isoDate(new Date(Date.now() + R.bookingWindowDays * 864e5)), [R.bookingWindowDays])

  const [step, setStep] = useState<Step>('pick')
  const [guests, setGuests] = useState(2)
  const [date, setDate] = useState(() => firstOpenDay(R.hours, R.bookingWindowDays))
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [time, setTime] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // Close on Escape or a click outside; focus the panel and return focus afterwards.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('button, input')?.focus())
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.rwidget .select--open, .rwidget .datepicker--open')) onClose() }
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element
      if (!panel.current?.contains(target) && !target.closest?.('[data-reserve-cta]')) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
      previous?.focus?.()
    }
  }, [onClose])

  // Free times for the chosen day; pre-select the first one, like a host would suggest.
  useEffect(() => {
    let cancelled = false
    setSlots(null)
    api.availability(date, guests)
      .then((r) => { if (!cancelled) setSlots(r.slots) })
      .catch(() => { if (!cancelled) setSlots(localSlots(date, R.hours)) })
    return () => { cancelled = true }
  }, [date, guests, R.hours])

  const free = (slots ?? []).filter((s) => s.available)
  useEffect(() => {
    if (slots && !free.some((s) => s.time === time)) setTime(free[0]?.time ?? '')
  }, [slots]) // eslint-disable-line react-hooks/exhaustive-deps

  const locale = lang === 'nl' ? 'nl-NL' : 'en-GB'
  const dayLabel = (iso: string) => {
    const today = isoDate(new Date())
    const tomorrow = isoDate(new Date(Date.now() + 864e5))
    const long = new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
    return iso === today ? `${t.widget.today}, ${long}` : iso === tomorrow ? `${t.widget.tomorrow}, ${long}`
      : new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })
  }

  function book() {
    setError('')
    // Before opening day there's nothing to fill in: say so straight away.
    if (R.prelaunch) { setError('not_yet_open'); return }
    if (time) setStep('details')
  }

  async function confirm(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await api.reserve({ ...form, notes: form.notes || null, date, time, guests, language: lang })
      setStep('done')
    } catch (err) {
      const key = err instanceof ApiError ? err.message : 'generic'
      setError(key)
      if (key === 'fully_booked') { setStep('pick'); api.availability(date, guests).then((r) => setSlots(r.slots)).catch(() => {}) }
    } finally {
      setSending(false)
    }
  }

  const guestOptions = Array.from({ length: R.maxParty }, (_, i) => ({
    value: i + 1, label: fill(i === 0 ? t.reserve.guestOne : t.reserve.guestMany, { n: i + 1 }),
  }))
  const summary = `${fill(guests === 1 ? t.reserve.guestOne : t.reserve.guestMany, { n: guests })} · ${dayLabel(date)} · ${time}`

  return (
    <div className={`rwidget ${closing ? 'rwidget--closing' : ''}`} role="dialog" aria-modal="false" aria-label={t.widget.cta} ref={panel}>
      <header className="rwidget__head">
        {step === 'details'
          ? <button type="button" className="rwidget__back" onClick={() => { setStep('pick'); setError('') }}>← {t.widget.back}</button>
          : <span />}
        <h2 className="rwidget__title">{t.widget.title}</h2>
        <button type="button" className="rwidget__close" onClick={onClose} aria-label={t.widget.close}>{Icon.close}</button>
      </header>

      {step === 'pick' && (
        <div className="rwidget__body">
          <div className="rwidget__rows">
            <div className="rwidget__row">
              <span className="rwidget__icon">{Icon.guests}</span>
              <Select label={t.widget.guests} value={guests} onChange={setGuests} options={guestOptions} />
            </div>
            <div className="rwidget__row">
              <span className="rwidget__icon">{Icon.date}</span>
              <DatePicker
                label={t.widget.date}
                value={date}
                onChange={setDate}
                min={isoDate(new Date())}
                max={maxDate}
                isDisabled={(iso) => !R.hours[weekday(iso)]}
                locale={locale}
                placeholder={t.reserve.datePh}
                labels={t.reserve.calendar}
              />
            </div>
            <div className="rwidget__row">
              <span className="rwidget__icon">{Icon.time}</span>
              {slots === null ? (
                <span className="rwidget__note">{t.widget.loading}</span>
              ) : free.length === 0 ? (
                <span className="rwidget__note">{t.widget.noTimes}</span>
              ) : (
                <Select label={t.widget.time} value={time} onChange={setTime} options={free.map((s) => ({ value: s.time, label: s.time }))} />
              )}
            </div>
          </div>
          {error && <p className="rwidget__error" role="alert">{bookingError(t, error, openingDate, fill)}</p>}
          <button type="button" className="rwidget__cta" onClick={book} disabled={!R.prelaunch && (!time || slots === null)}>
            {t.widget.book}
          </button>
        </div>
      )}

      {step === 'details' && (
        <form className="rwidget__body rwidget__form" onSubmit={confirm}>
          <p className="rwidget__summary">{summary}</p>
          <label className="rwidget__field"><span>{t.reserve.name}</span>
            <input required minLength={2} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="rwidget__field"><span>{t.reserve.email}</span>
            <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="rwidget__field"><span>{t.reserve.phone}</span>
            <input type="tel" required minLength={6} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="rwidget__field"><span>{t.reserve.notes}</span>
            <input placeholder={t.reserve.notesPh} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          {error && <p className="rwidget__error" role="alert">{bookingError(t, error, openingDate, fill)}</p>}
          <button type="submit" className="rwidget__cta" disabled={sending}>{sending ? t.reserve.sending : t.widget.confirm}</button>
        </form>
      )}

      {step === 'done' && (
        <div className="rwidget__body rwidget__done" role="status">
          <span className="rwidget__check">{Icon.check}</span>
          <h3>{t.reserve.successTitle}</h3>
          <p>{fill(t.reserve.success, {
            guests,
            date: new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
            time,
          })}</p>
          <button type="button" className="rwidget__cta" onClick={onClose}>{t.widget.done}</button>
        </div>
      )}
    </div>
  )
}
