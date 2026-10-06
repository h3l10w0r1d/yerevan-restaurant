import { useState } from 'react'
import { formatPrice, img, type Menu } from '../../api'
import { useI18n } from '../../i18n'

type Props = { menu: Menu; ordering: boolean; onAdd: (id: string) => void; cart: Record<string, number> }

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

export function EdMenu({ menu, ordering, onAdd, cart }: Props) {
  const { t, lang } = useI18n()
  const all = menu.categories.flatMap((c) => c.items)
  const [activeId, setActiveId] = useState(all[0]?.id)
  const active = all.find((i) => i.id === activeId) ?? all[0]
  let n = 0

  return (
    <section className="ed-section ed-menu" id="menu">
      <div className="ed-container">
        <p className="ed-kicker" data-reveal>No. 03 — {t.ed.menuKicker}</p>
        <h2 className="ed-title" data-reveal>{t.ed.menuTitle}</h2>
        <p className="ed-lede" data-reveal>{t.menu.lead}</p>

        <div className="ed-menu__grid">
          <div className="ed-menu__chapters">
            {menu.categories.map((cat, ci) => (
              <div className="ed-chapter" key={cat.id}>
                <header className="ed-chapter__head">
                  <span className="ed-chapter__no">{ROMAN[ci]}.</span>
                  <h3>{cat.name[lang]}</h3>
                  {cat.note && <p>{cat.note[lang]}</p>}
                </header>
                <hr className="ed-rule" />
                <ol className="ed-dishes">
                  {cat.items.map((item) => {
                    n += 1
                    const tag = item.tags.includes('vg') ? t.menu.vegan : item.tags.includes('v') ? t.menu.veg : ''
                    return (
                      <li
                        key={item.id}
                        className={`ed-dish ${item.id === active?.id ? 'ed-dish--active' : ''}`}
                        onMouseEnter={() => setActiveId(item.id)}
                        onFocus={() => setActiveId(item.id)}
                        tabIndex={-1}
                      >
                        <span className="ed-dish__no">{String(n).padStart(2, '0')}</span>
                        <div className="ed-dish__text">
                          <div className="ed-dish__row">
                            <h4>{item.name[lang]}</h4>
                            <span className="ed-dish__dots" aria-hidden />
                            <span className="ed-dish__price">{formatPrice(item.price)}</span>
                          </div>
                          <p>
                            {item.description[lang]}
                            {tag && <em className="ed-dish__tag"> · {tag}</em>}
                          </p>
                          {ordering && (
                            <button className="ed-dish__add" onClick={() => onAdd(item.id)}>
                              + {t.menu.add}{cart[item.id] ? ` (${cart[item.id]})` : ''}
                            </button>
                          )}
                        </div>
                        {item.image && (
                          <img className="ed-dish__thumb" src={img(item.image)} alt="" width={800} height={600} loading="lazy" decoding="async" />
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
            <p className="ed-note">{t.menu.allergens}</p>
          </div>

          <aside className="ed-menu__preview" aria-hidden>
            <figure className="ed-fig">
              <div className="ed-fig__frame ed-fig__frame--tall">
                {active?.image && <img key={active.id} className="ed-preview__img" src={img(active.image)} alt="" width={800} height={600} />}
              </div>
              <figcaption>
                <span className="ed-fig__no">{t.ed.fig}</span>
                {active?.name[lang]} — <em>{active?.description[lang]}</em>
              </figcaption>
            </figure>
          </aside>
        </div>
      </div>
    </section>
  )
}
