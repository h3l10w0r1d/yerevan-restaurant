import { useEffect, useState } from 'react'
import { useI18n, type Lang } from '../i18n'
import { Link } from '../router'
import { useStore } from '../store'

export function Header({ page }: { page: 'home' | 'menu' }) {
  const { t, lang, setLang } = useI18n()
  const { count: cartCount } = useStore()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links: [string, string][] = [
    ['/menu', t.nav.menu],
    ['/#reserve', t.nav.reserve],
    ['/#order', t.nav.order],
    ['/#visit', t.nav.visit],
  ]

  return (
    <header className={`header ${scrolled || open || page === 'menu' ? 'header--solid' : ''}`}>
      <div className="header__inner">
        <Link to="/" className="header__brand" aria-label="Yerevan" onClick={() => setOpen(false)}>
          <span className="wordmark">Yerevan</span>
        </Link>
        <nav className={`nav ${open ? 'nav--open' : ''}`} aria-label="Main">
          {links.map(([href, label]) => (
            <Link key={href} to={href} onClick={() => setOpen(false)} aria-current={href === '/menu' && page === 'menu' ? 'page' : undefined}>
              {label}
              {href === '/#order' && cartCount > 0 && <span className="badge">{cartCount}</span>}
            </Link>
          ))}
        </nav>
        <div className="header__actions">
          <div className="lang" role="group" aria-label="Language">
            {(['en', 'nl'] as Lang[]).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className="burger"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span /><span />
          </button>
        </div>
      </div>
    </header>
  )
}
