import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, ApiError, type Slot } from '../api'
import { fill, useI18n } from '../i18n'
import { useRestaurant, type Hours } from '../restaurant'
import { DatePicker } from './DatePicker'
import { Select } from './Select'

const pad = (n: number) => String(n).padStart(2, '0')
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const weekday = (iso: string) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7 // Monday = 0

// Same rule as the backend: every 30 min, last seating 90 min before closing.
function localSlots(iso: string, allHours: Hours): Slot[] {
  const hours = allHours[weekday(iso)]
  if (!hours) return []
  const toMin = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3)
  const now = new Date()
  const out: Slot[] = []
  for (let m = toMin(hours[0]); m <= toMin(hours[1]) - 90; m += 30) {
    const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
    out.push({ time, available: new Date(`${iso}T${time}:00`) > now })
  }
  return out
}

type Status = 'idle' | 'sending' | 'done' | 'error'

export function Reservation() {
  const { t, lang } = useI18n()
  const R = useRestaurant()
  const today = useMemo(() => new Date(), [])
  const maxDate = useMemo(() => new Date(Date.now() + R.bookingWindowDays * 864e5), [R.bookingWindowDays])

  const [date, setDate] = useState('')
  const [guests, setGuests] = useState(2)
  const [time, setTime] = useState('')
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!date) return
    let cancelled = false
    setSlots(null)
    api
      .availability(date, guests)
      .then((r) => { if (!cancelled) { setSlots(r.slots); setOffline(false) } })
      .catch(() => { if (!cancelled) { setSlots(localSlots(date, R.hours)); setOffline(true) } })
    return () => { cancelled = true }
  }, [date, guests])

  useEffect(() => {
    if (slots && !slots.find((s) => s.time === time && s.available)) setTime('')
  }, [slots, time])

  const prettyDate = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : ''

  const mailto = () => {
    const body = [
      `${t.reserve.date}: ${prettyDate}`, `${t.reserve.time}: ${time}`, `${t.reserve.guests}: ${guests}`,
      `${t.reserve.name}: ${form.name}`, `${t.reserve.phone}: ${form.phone}`, form.notes,
    ].join('\n')
    return `mailto:${R.email}?subject=${encodeURIComponent(t.reserve.title)}&body=${encodeURIComponent(body)}`
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!time) return
    setStatus('sending')
    setError('')
    try {
      await api.reserve({ ...form, notes: form.notes || null, date, time, guests, language: lang })
      setStatus('done')
    } catch (err) {
      const key = err instanceof ApiError ? err.message : 'offline'
      if (key === 'offline' || !(err instanceof ApiError)) setOffline(true)
      setError(key)
      setStatus('error')
      if (key === 'fully_booked') api.availability(date, guests).then((r) => setSlots(r.slots)).catch(() => {})
    }
  }

  const errorText = (t.reserve.errors as Record<string, string>)[error] ?? t.reserve.errors.generic

  return (
    <section className="section reserve" id="reserve">
      <div className="container container--narrow">
        <header className="section__head">
          <h2>{t.reserve.title}</h2>
          <p className="lead">{t.reserve.lead}</p>
        </header>

        {status === 'done' ? (
          <div className="success" role="status">
            <h3>{t.reserve.successTitle}</h3>
            <p>{fill(t.reserve.success, { guests, date: prettyDate, time })}</p>
            <button className="btn btn--amber" onClick={() => { setStatus('idle'); setTime(''); setDate('') }}>
              {t.reserve.another}
            </button>
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <div className="form__row">
              <div className="field">
                <DatePicker
                  label={t.reserve.date}
                  value={date}
                  onChange={setDate}
                  min={isoDate(today)}
                  max={isoDate(maxDate)}
                  isDisabled={(iso) => !R.hours[weekday(iso)]}
                  locale={lang === 'nl' ? 'nl-NL' : 'en-GB'}
                  placeholder={t.reserve.datePh}
                  labels={t.reserve.calendar}
                />
              </div>
              <div className="field">
                <Select
                  label={t.reserve.guests}
                  value={guests}
                  onChange={setGuests}
                  options={Array.from({ length: R.maxParty }, (_, i) => ({
                    value: i + 1,
                    label: fill(i === 0 ? t.reserve.guestOne : t.reserve.guestMany, { n: i + 1 }),
                  }))}
                />
              </div>
            </div>

            <fieldset className="field">
              <legend>{t.reserve.time}</legend>
              {!date ? (
                <p className="hint">{t.reserve.pickDate}</p>
              ) : slots === null ? (
                <div className="slots slots--loading" aria-busy="true">
                  {Array.from({ length: 6 }, (_, i) => <span key={i} className="slot slot--skeleton" />)}
                </div>
              ) : slots.length === 0 ? (
                <p className="hint">{t.reserve.closed}</p>
              ) : !slots.some((s) => s.available) ? (
                <p className="hint">{t.reserve.noSlots}</p>
              ) : (
                <div className="slots">
                  {slots.map((s) => (
                    <label key={s.time} className={`slot ${!s.available ? 'slot--off' : ''}`}>
                      <input
                        type="radio" name="time" value={s.time} disabled={!s.available}
                        checked={time === s.time} onChange={() => setTime(s.time)} required
                      />
                      <span>{s.time}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <label className="field">
              <span>{t.reserve.name}</span>
              <input required minLength={2} autoComplete="name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <div className="form__row">
              <label className="field">
                <span>{t.reserve.email}</span>
                <input type="email" required autoComplete="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="field">
                <span>{t.reserve.phone}</span>
                <input type="tel" required minLength={6} autoComplete="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>{t.reserve.notes}</span>
              <textarea rows={3} maxLength={500} placeholder={t.reserve.notesPh} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>

            {status === 'error' && (
              <div className="alert" role="alert">
                {offline ? (
                  <>
                    <p>{t.reserve.errors.offline}</p>
                    <a className="btn btn--amber" href={mailto()}>{t.reserve.errors.emailCta}</a>
                  </>
                ) : (
                  <p>{errorText}</p>
                )}
              </div>
            )}

            <button className="btn btn--amber btn--block" type="submit" disabled={!time || status === 'sending'}>
              {status === 'sending' ? t.reserve.sending : t.reserve.submit}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
