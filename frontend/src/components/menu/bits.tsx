import { useEffect, useRef, type ReactNode } from 'react'
import type { Badge, MenuItem } from '../../api'
import { fill, useI18n } from '../../i18n'
import { useRestaurant } from '../../restaurant'

export function BadgeChip({ badge, className = '' }: { badge?: Badge; className?: string }) {
  const { t } = useI18n()
  if (!badge) return null
  return <span className={`chip chip--${badge} ${className}`}>{t.mp.badges[badge]}</span>
}

export function DietTags({ item }: { item: MenuItem }) {
  const { t } = useI18n()
  const label = item.tags.includes('vg') ? t.menu.vegan : item.tags.includes('v') ? t.menu.veg : null
  return label ? <span className="diet">{label}</span> : null
}

/** "Open now · until 22:00" style status from the opening hours in Settings. */
export function useOpenStatus(): { open: boolean; text: string } {
  const { t, lang } = useI18n()
  const { hours } = useRestaurant()
  const now = new Date()
  const today = (now.getDay() + 6) % 7
  const mins = now.getHours() * 60 + now.getMinutes()
  const toMin = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3)
  const h = hours[today]
  if (h && mins >= toMin(h[0]) && mins < toMin(h[1])) return { open: true, text: fill(t.mp.openNow, { time: h[1] }) }
  if (h && mins < toMin(h[0])) return { open: false, text: fill(t.mp.opensToday, { time: h[0] }) }
  for (let i = 1; i <= 7; i++) {
    const d = (today + i) % 7
    const next = hours[d]
    if (next) return { open: false, text: fill(t.mp.closedNow, { day: lang === 'nl' ? t.days[d].toLowerCase() : t.days[d], time: next[0] }) }
  }
  return { open: false, text: '' }
}

/**
 * Modal surface: a bottom sheet on phones, a centred dialog (or right drawer) on larger screens.
 * Escape closes, focus moves in and returns, and the page behind doesn't scroll.
 */
export function Overlay({ open, onClose, label, variant = 'dialog', children }: {
  open: boolean
  onClose: () => void
  label: string
  variant?: 'dialog' | 'drawer'
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbar}px`
    requestAnimationFrame(() => panel.current?.focus())
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className={`overlay overlay--${variant}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="overlay__panel" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panel}>
        {children}
      </div>
    </div>
  )
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={t.mp.close}>
      <svg viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    </button>
  )
}

export function PlusIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
}
