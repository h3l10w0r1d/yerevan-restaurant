import { useI18n } from '../i18n'
import { RESTAURANT } from '../restaurant'
import { Logo } from './Logo'

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="footer">
      <div className="pattern" aria-hidden />
      <div className="container footer__inner">
        <Logo className="footer__logo" />
        <p>{RESTAURANT.address}, {RESTAURANT.city}</p>
        <p className="muted">© {new Date().getFullYear()} Yerevan · {t.footer.rights}</p>
      </div>
    </footer>
  )
}
