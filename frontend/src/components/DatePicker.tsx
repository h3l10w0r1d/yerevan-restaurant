import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

type Props = {
  label: string
  value: string // YYYY-MM-DD or ''
  onChange: (iso: string) => void
  min: string
  max: string
  isDisabled?: (iso: string) => boolean
  locale: string
  placeholder: string
  labels: { prev: string; next: string; closed: string }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (iso: string) => new Date(`${iso}T12:00:00`)
const addDays = (iso: string, n: number) => {
  const d = fromIso(iso)
  d.setDate(d.getDate() + n)
  return toIso(d)
}
const addMonths = (iso: string, n: number) => {
  const d = fromIso(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toIso(d)
}
const clampIso = (iso: string, min: string, max: string) => (iso < min ? min : iso > max ? max : iso)

// Calendar popover following the WAI-ARIA date picker dialog pattern:
// a grid of days with roving focus, Monday-first weeks.
export function DatePicker({ label, value, onChange, min, max, isDisabled, locale, placeholder, labels }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(value || min)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLTableElement>(null)
  const today = toIso(new Date())

  const unavailable = (iso: string) => iso < min || iso > max || !!isDisabled?.(iso)

  const fmt = useMemo(() => ({
    month: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    long: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    value: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'long' }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    weekdayLong: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
  }), [locale])

  // Monday-first weekday headers (2024-01-01 was a Monday).
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 1 + i)
      return { short: fmt.weekday.format(d).replace('.', '').slice(0, 2), long: fmt.weekdayLong.format(d) }
    }),
    [fmt],
  )

  const view = fromIso(focused)
  const year = view.getFullYear()
  const month = view.getMonth()
  const weeks = useMemo(() => {
    const first = new Date(year, month, 1)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(year, month, 1 - offset)
    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      return { iso: toIso(d), day: d.getDate(), inMonth: d.getMonth() === month }
    })
    const rows = []
    for (let i = 0; i < 42; i += 7) rows.push(days.slice(i, i + 7))
    // Drop a trailing week that is entirely next month.
    return rows.filter((row) => row.some((d) => d.inMonth))
  }, [year, month])

  const firstOfMonth = toIso(new Date(year, month, 1))
  const lastOfMonth = toIso(new Date(year, month + 1, 0))
  const canPrev = firstOfMonth > min
  const canNext = lastOfMonth < max

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Keep DOM focus on the focused day while the dialog is open.
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focused}"]`)?.focus()
  }, [open, focused])

  const openPicker = () => {
    let start = clampIso(value || today, min, max)
    for (let i = 0; i < 14 && unavailable(start) && start < max; i++) start = addDays(start, 1)
    setFocused(start)
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }
  const select = (iso: string) => {
    if (unavailable(iso)) return
    onChange(iso)
    close()
  }
  const move = (iso: string) => setFocused(clampIso(iso, min, max))

  function onGridKey(e: KeyboardEvent) {
    const dow = (fromIso(focused).getDay() + 6) % 7
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(addDays(focused, -1)),
      ArrowRight: () => move(addDays(focused, 1)),
      ArrowUp: () => move(addDays(focused, -7)),
      ArrowDown: () => move(addDays(focused, 7)),
      Home: () => move(addDays(focused, -dow)),
      End: () => move(addDays(focused, 6 - dow)),
      PageUp: () => move(addMonths(focused, e.shiftKey ? -12 : -1)),
      PageDown: () => move(addMonths(focused, e.shiftKey ? 12 : 1)),
      Enter: () => select(focused),
      ' ': () => select(focused),
    }
    if (keys[e.key]) {
      e.preventDefault()
      keys[e.key]()
    }
  }

  return (
    <div
      className={`datepicker ${open ? 'datepicker--open' : ''}`}
      ref={rootRef}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); close() } }}
      onBlur={(e) => { if (open && !rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false) }}
    >
      <span className="field__label" id={`${id}-label`}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={`datepicker__trigger ${value ? '' : 'datepicker__trigger--empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? close() : openPicker())}
      >
        <span id={`${id}-value`}>{value ? fmt.value.format(fromIso(value)) : placeholder}</span>
        <svg className="datepicker__icon" viewBox="0 0 18 18" aria-hidden>
          <rect x="1.5" y="3" width="15" height="13.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <line x1="1.5" y1="7" x2="16.5" y2="7" stroke="currentColor" strokeWidth="1.1" />
          <line x1="5.5" y1="1" x2="5.5" y2="4.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="12.5" y1="1" x2="12.5" y2="4.5" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </button>

      {open && (
        <div className="calendar" role="dialog" aria-modal="false" aria-labelledby={`${id}-month`}>
          <div className="calendar__head">
            <button
              type="button" className="calendar__nav" aria-label={labels.prev} disabled={!canPrev}
              onClick={() => move(addMonths(focused, -1))}
            >
              <svg viewBox="0 0 8 12" aria-hidden><polyline points="6.5,1 1.5,6 6.5,11" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
            </button>
            <h3 className="calendar__month" id={`${id}-month`} aria-live="polite">{fmt.month.format(view)}</h3>
            <button
              type="button" className="calendar__nav" aria-label={labels.next} disabled={!canNext}
              onClick={() => move(addMonths(focused, 1))}
            >
              <svg viewBox="0 0 8 12" aria-hidden><polyline points="1.5,1 6.5,6 1.5,11" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
            </button>
          </div>
          <table className="calendar__grid" role="grid" aria-labelledby={`${id}-month`} ref={gridRef} onKeyDown={onGridKey}>
            <thead>
              <tr>
                {weekdays.map((w) => (
                  <th key={w.long} scope="col" abbr={w.long}>{w.short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((row) => (
                <tr key={row[0].iso}>
                  {row.map((d) => {
                    const off = unavailable(d.iso)
                    const closed = off && d.iso >= min && d.iso <= max
                    const classes = [
                      'calendar__day',
                      !d.inMonth && 'calendar__day--outside',
                      d.iso === value && 'calendar__day--selected',
                      d.iso === today && 'calendar__day--today',
                      off && 'calendar__day--off',
                    ].filter(Boolean).join(' ')
                    return (
                      <td key={d.iso} role="gridcell" aria-selected={d.iso === value}>
                        <button
                          type="button"
                          className={classes}
                          data-iso={d.iso}
                          tabIndex={d.iso === focused ? 0 : -1}
                          aria-disabled={off || undefined}
                          aria-label={`${fmt.long.format(fromIso(d.iso))}${closed ? `, ${labels.closed}` : ''}`}
                          onClick={() => { setFocused(d.iso); select(d.iso) }}
                        >
                          {d.day}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
