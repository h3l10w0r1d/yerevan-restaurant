import { useState } from 'react'
import { formatPrice, img, type Menu } from '../api'
import { useI18n } from '../i18n'
import { Logo } from './Logo'

type Props = { menu: Menu; ordering: boolean; onAdd: (id: string) => void; cart: Record<string, number> }

export function MenuSection({ menu, ordering, onAdd, cart }: Props) {
  const { t, lang } = useI18n()
  const [active, setActive] = useState(menu.categories[0]?.id)
  const category = menu.categories.find((c) => c.id === active) ?? menu.categories[0]

  return (
    <section className="section menu" id="menu">
      <div className="container">
        <header className="section__head">
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

        <div className="menu__panel" role="tabpanel" key={category.id}>
          <div className="menu__cat">
            <h3>{category.name[lang]}</h3>
            {category.note && <p className="muted">{category.note[lang]}</p>}
          </div>
          <ul className="dishes">
            {category.items.map((item) => (
              <li key={item.id} className="dish">
                {item.image ? (
                  <img className="dish__img" src={img(item.image)} alt="" width={96} height={96} loading="lazy" decoding="async" />
                ) : (
                  <span className="dish__img dish__img--empty" aria-hidden><Logo variant="mountain" title="" /></span>
                )}
                <div className="dish__body">
                <div className="dish__row">
                  <h4 className="dish__name">
                    {item.name[lang]}
                    {item.tags.includes('vg') ? (
                      <abbr className="tag" title={t.menu.vegan}>vg</abbr>
                    ) : item.tags.includes('v') ? (
                      <abbr className="tag" title={t.menu.veg}>v</abbr>
                    ) : null}
                  </h4>
                  <span className="dots" aria-hidden />
                  <span className="dish__price">{formatPrice(item.price)}</span>
                </div>
                <p className="dish__desc">{item.description[lang]}</p>
                {ordering && (
                  <button className="add" onClick={() => onAdd(item.id)}>
                    + {t.menu.add}
                    {cart[item.id] ? <span className="add__count">{cart[item.id]}</span> : null}
                  </button>
                )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="menu__note muted">{t.menu.allergens}</p>
      </div>
    </section>
  )
}
