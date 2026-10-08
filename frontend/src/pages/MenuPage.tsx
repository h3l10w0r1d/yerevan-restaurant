import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { img, type MenuItem } from '../api'
import { CartBar, CartDrawer } from '../components/menu/Cart'
import { DishRow, PickCard } from '../components/menu/DishCards'
import { DishSheet } from '../components/menu/DishSheet'
import { useOpenStatus } from '../components/menu/bits'
import { fill, useI18n } from '../i18n'
import { useRestaurant } from '../restaurant'
import { Link } from '../router'
import { useStore } from '../store'

type Diet = 'all' | 'v' | 'vg'

const matches = (item: MenuItem, q: string) =>
  !q || `${item.name.en} ${item.name.nl} ${item.description.en} ${item.description.nl}`.toLowerCase().includes(q)

const fitsDiet = (item: MenuItem, diet: Diet) =>
  diet === 'all' || (diet === 'vg' ? item.tags.includes('vg') : item.tags.includes('v') || item.tags.includes('vg'))

export function MenuPage() {
  const { t, lang } = useI18n()
  const R = useRestaurant()
  const status = useOpenStatus()
  const { menu, items, cart, add } = useStore()
  const [query, setQuery] = useState('')
  const [diet, setDiet] = useState<Diet>('all')
  const [active, setActive] = useState(menu.categories[0]?.id ?? '')
  const [dish, setDish] = useState<string | null>(() => new URLSearchParams(window.location.search).get('dish'))
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [bump, setBump] = useState(0)
  const chipsRef = useRef<HTMLDivElement>(null)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => menu.categories
    .map((c) => ({ ...c, items: c.items.filter((i) => matches(i, q) && fitsDiet(i, diet)) }))
    .filter((c) => c.items.length), [menu, q, diet])
  const picks = useMemo(() => menu.categories.flatMap((c) => c.items).filter((i) => i.featured && i.image)
    .sort((x, y) => Number(y.badge === 'signature') - Number(x.badge === 'signature')), [menu])
  const total = menu.categories.reduce((n, c) => n + c.items.length, 0)
  const browsing = !q && diet === 'all'

  // Keep ?dish=… in the URL so a dish can be shared or reopened.
  const openDish = useCallback((id: string | null) => {
    setDish(id)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('dish', id)
    else url.searchParams.delete('dish')
    history.replaceState(null, '', url)
  }, [])

  const flash = (name: string) => {
    setToast(`${name} · ${t.mp.added}`)
    setBump((b) => b + 1)
  }
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(id)
  }, [toast])

  // Scroll-spy: highlight the category you're reading, and keep its chip in view.
  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>('.msec')]
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActive(visible[0].target.id.replace(/^c-/, ''))
    }, { rootMargin: '-35% 0px -55% 0px' })
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [filtered])

  useEffect(() => {
    const chip = chipsRef.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`)
    const bar = chipsRef.current
    if (chip && bar) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [active])

  const goTo = (id: string) => {
    const el = document.getElementById(`c-${id}`)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
    setActive(id)
  }

  return (
    <div className="mpage">
      {/* Store header, the way delivery apps open a restaurant */}
      <header className="store">
        <div className="store__cover" aria-hidden>
          <img src={img('yerevan/hero-opera-1600.webp')} alt="" width={1600} height={1000} />
        </div>
        <div className="container store__inner">
          <Link to="/" className="store__back">← {t.mp.back}</Link>
          <h1 className="store__name">Yerevan</h1>
          <p className="store__meta">{t.mp.kitchen} · {R.address}, {R.city}</p>
          <div className="store__facts">
            {status.text && <span className={`status ${status.open ? 'status--open' : ''}`}><span className="status__dot" />{status.text}</span>}
            <span className="fact">{fill(t.mp.dishes, { n: total })}</span>
          </div>
        </div>
      </header>

      {/* Search and diet filter, then the sticky category chips */}
      <div className="mtools">
        <div className="container">
          <div className="mbar__row">
            <label className="search">
              <svg viewBox="0 0 16 16" aria-hidden><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              <input type="search" placeholder={t.mp.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.mp.search} />
              {query && <button type="button" onClick={() => setQuery('')} aria-label={t.mp.clear}>×</button>}
            </label>
            <div className="diet-filter" role="group">
              {([['all', t.mp.all], ['v', t.menu.veg], ['vg', t.menu.vegan]] as [Diet, string][]).map(([v, label]) => (
                <button key={v} type="button" aria-pressed={diet === v} onClick={() => setDiet(v)}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mbar">
        <div className="container">
          <div className="mbar__cats" ref={chipsRef}>
            {filtered.map((c) => (
              <button key={c.id} type="button" data-cat={c.id} aria-current={active === c.id ? 'true' : undefined} onClick={() => goTo(c.id)}>
                {c.name[lang]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mpage__body">
        {!R.orderingEnabled && (
          <div className="mnotice">
            <p>{t.mp.soonNote}</p>
            <Link to="/#reserve" className="btn btn--burgundy">{t.mp.reserveCta}</Link>
          </div>
        )}

        {browsing && picks.length > 0 && (
          <section className="mpicks" aria-labelledby="picks-title">
            <div className="mpicks__head">
              <h2 id="picks-title">★ {t.mp.picks}</h2>
              <p className="muted">{t.mp.picksLead}</p>
            </div>
            <div className="mpicks__track">
              {picks.map((i) => <PickCard key={i.id} item={i} onOpen={() => openDish(i.id)} />)}
            </div>
          </section>
        )}

        {filtered.length === 0 && <p className="mempty">{t.mp.nothing}</p>}

        {filtered.map((c) => (
          <section key={c.id} id={`c-${c.id}`} className="msec">
            <header className="msec__head">
              <h2>{c.name[lang]}</h2>
              {c.note && <p className="muted">{c.note[lang]}</p>}
            </header>
            <div className="msec__grid">
              {c.items.map((i) => (
                <DishRow
                  key={i.id}
                  item={i}
                  qty={cart[i.id] || 0}
                  canAdd={R.orderingEnabled}
                  onOpen={() => openDish(i.id)}
                  onAdd={() => { add(i.id); flash(i.name[lang]) }}
                />
              ))}
            </div>
          </section>
        ))}

        <p className="mpage__allergens muted">{t.menu.allergens}</p>
      </div>

      {R.orderingEnabled && <CartBar onOpen={() => setCartOpen(true)} bump={bump} />}
      <div className={`toast ${toast ? 'toast--show' : ''}`} role="status" aria-live="polite">{toast}</div>

      <DishSheet
        item={dish ? items[dish] ?? null : null}
        onClose={() => openDish(null)}
        onSelect={(id) => openDish(id)}
        onAdded={flash}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
