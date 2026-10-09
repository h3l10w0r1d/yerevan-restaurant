import { fill, useI18n } from '../i18n'
import { useRestaurant } from '../restaurant'
import { Logo } from './Logo'

/** "14 November" / "14 november" from YYYY-MM-DD. */
export function useOpeningDate(): string {
  const { lang } = useI18n()
  const { openingDate } = useRestaurant()
  if (!openingDate) return ''
  return new Date(`${openingDate}T12:00:00`).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'long' })
}

/** Short "Opening soon" / "Opening 14 November" label. */
export function useOpeningLabel(): string {
  const { t } = useI18n()
  const date = useOpeningDate()
  return date ? fill(t.soon.badgeDate, { date }) : t.soon.badge
}

export function MenuComingSoon() {
  const { t } = useI18n()
  const date = useOpeningDate()
  return (
    <div className="coming">
      <Logo variant="mountain" className="coming__mark" title="" />
      <p className="coming__kicker">{date ? fill(t.soon.badgeDate, { date }) : t.soon.badge}</p>
      <h3 className="coming__title">{t.soon.menuTitle}</h3>
      <p className="coming__body">{t.soon.menuBody}</p>
      {date && <p className="coming__date">{fill(t.soon.menuDate, { date })}</p>}
    </div>
  )
}
