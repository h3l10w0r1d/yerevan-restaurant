import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState } from 'react'
import { formatPrice, img, type Menu } from '../api'
import { useI18n } from '../i18n'
import { Logo } from './Logo'

type Props = { menu: Menu; ordering: boolean; onAdd: (id: string) => void; cart: Record<string, number> }

export function MenuSection({ menu, ordering, onAdd, cart }: Props) {
  const { t, lang } = useI18n()
  const [active, setActive] = useState(menu.categories[0]?.id)
  const category = menu.categories.find((c) => c.id === active) ?? menu.categories[0]
  const gridRef = useRef<HTMLUListElement>(null)

  // Cards rise in when the grid scrolls into view, and again on every category switch.
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.card', {
          y: 48,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: gridRef.current, start: 'top 85%', once: true },
        })
      })
    },
    { scope: gridRef, dependencies: [category.id], revertOnUpdate: true },
  )

  return (
    <section className="section menu" id="menu">
      <div className="container">
        <header className="section__head" data-reveal>
          <h2>{t.menu.title}</h2>
          <p className="lead">{t.menu.lead}</p>
        </header>

        <div className="tabs" role="tablist" aria-label={t.menu.title}>
          {menu.categories.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === category.id}
              className="tab"
              onClick={() => setActive(c.id)}
            >
              {c.name[lang]}
            </button>
          ))}
        </div>

        <div className="menu__cat">
          <h3>{category.name[lang]}</h3>
          {category.note && <p className="muted">{category.note[lang]}</p>}
        </div>

        <ul className="cards" role="tabpanel" ref={gridRef}>
          {category.items.map((item) => {
            const tag = item.tags.includes('vg') ? ['vg', t.menu.vegan] : item.tags.includes('v') ? ['v', t.menu.veg] : null
            return (
              <li key={item.id} className="card">
                <div className="card__media">
                  {item.image ? (
                    <img src={img(item.image)} alt={item.name[lang]} width={800} height={600} loading="lazy" decoding="async" />
                  ) : (
                    <span className="card__placeholder" aria-hidden><Logo variant="mountain" title="" /></span>
                  )}
                  {tag && <span className="card__tag" title={tag[1]}>{tag[1]}</span>}
                </div>
                <div className="card__body">
                  <div className="card__row">
                    <h4 className="card__name">{item.name[lang]}</h4>
                    <span className="card__price">€ {formatPrice(item.price)}</span>
                  </div>
                  <p className="card__desc">{item.description[lang]}</p>
                  {ordering && (
                    <button className="card__add" onClick={() => onAdd(item.id)}>
                      {cart[item.id] ? (
                        <>{t.menu.inOrder} <span className="add__count">{cart[item.id]}</span></>
                      ) : (
                        <>+ {t.menu.add}</>
                      )}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="menu__note muted">{t.menu.allergens}</p>
      </div>
    </section>
  )
}
