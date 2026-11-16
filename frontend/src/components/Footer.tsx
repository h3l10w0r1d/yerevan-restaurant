import { useI18n } from '../i18n'
import { useRestaurant } from '../restaurant'
import { Credits } from './Credits'
import { Logo } from './Logo'

// Add a Facebook page here once it exists: { name: 'Facebook', url: '…', icon: <FacebookIcon /> }.
const SOCIAL = [
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/restaurantyerevan/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
]

export function Footer() {
  const { t } = useI18n()
  const R = useRestaurant()
  return (
    <footer className="footer">
      <div className="pattern" aria-hidden />
      <div className="container footer__inner">
        <Logo className="footer__logo" />
        <ul className="footer__social">
          {SOCIAL.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Yerevan on ${s.name}`} title={s.name}>
                {s.icon}
              </a>
            </li>
          ))}
        </ul>
        <p>{R.address}, {R.city}</p>
        <p className="muted">© {new Date().getFullYear()} Yerevan · {t.footer.rights}</p>
        <Credits />
      </div>
    </footer>
  )
}
