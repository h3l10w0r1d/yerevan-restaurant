import { useEffect, useState } from 'react'
import { useI18n, type Lang } from '../i18n'

export function Header({ cartCount }: { cartCount: number }) {
  const { t, lang, setLang } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links: [string, string][] = [
    ['#menu', t.nav.menu],
    ['#reserve', t.nav.reserve],
    ['#order', t.nav.order],
    ['#visit', t.nav.visit],
  ]

  return (
    <header className={`header ${scrolled || open ? 'header--solid' : ''}`}>
      <div className="header__inner">
        <a href="#top" className="header__brand" aria-label="Yerevan" onClick={() => setOpen(false)}>
          <span className="wordmark">Yerevan</span>
        </a>
        <nav className={`nav ${open ? 'nav--open' : ''}`} aria-label="Main">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
              {href === '#order' && cartCount > 0 && <span className="badge">{cartCount}</span>}
            </a>
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
