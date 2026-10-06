import { format, parseISO } from 'date-fns'

export const euro = (cents: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100)

export const iso = (d: Date) => format(d, 'yyyy-MM-dd')
export const prettyDate = (s: string) => format(parseISO(s), 'EEE d MMM yyyy')
export const shortDate = (s: string) => format(parseISO(s), 'd MMM')
export const dateTime = (s: string) => format(parseISO(s), 'd MMM, HH:mm')

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
