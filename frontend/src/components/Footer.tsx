import { useI18n } from '../i18n'
import { useRestaurant } from '../restaurant'
import { Credits } from './Credits'
import { Logo } from './Logo'

export function Footer() {
  const { t } = useI18n()
  const R = useRestaurant()
  return (
    <footer className="footer">
      <div className="pattern" aria-hidden />
      <div className="container footer__inner">
        <Logo className="footer__logo" />
        <p>{R.address}, {R.city}</p>
        <p className="muted">© {new Date().getFullYear()} Yerevan · {t.footer.rights}</p>
        <Credits />
      </div>
    </footer>
  )
}
