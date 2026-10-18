import type { Slot } from './api'
import type { Hours } from './restaurant'

export const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const weekday = (iso: string) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7 // Monday = 0

/** Same rule as the backend: every 30 min, last seating 90 min before closing. Used when the API is unreachable. */
export function localSlots(iso: string, allHours: Hours): Slot[] {
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

/** First day from today (within the booking window) on which the restaurant opens. */
export function firstOpenDay(hours: Hours, windowDays: number): string {
  const d = new Date()
  for (let i = 0; i <= windowDays; i++) {
    const iso = isoDate(d)
    if (localSlots(iso, hours).some((s) => s.available)) return iso
    d.setDate(d.getDate() + 1)
  }
  return isoDate(new Date())
}

type ErrorCopy = { reserve: { errors: Record<string, string> }; soon: { reserve: string; reserveDate: string } }

/** Human message for an error code from POST /api/reservations. */
export function bookingError(t: ErrorCopy, key: string, openingDate: string, fill: (s: string, v: Record<string, string>) => string) {
  if (key === 'not_yet_open') return openingDate ? fill(t.soon.reserveDate, { date: openingDate }) : t.soon.reserve
  return t.reserve.errors[key] ?? t.reserve.errors.generic
}
