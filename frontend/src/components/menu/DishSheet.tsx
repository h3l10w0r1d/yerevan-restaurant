import { useEffect, useMemo, useState } from 'react'
import { formatPrice, img, type MenuItem } from '../../api'
import { fill, useI18n } from '../../i18n'
import { useRestaurant } from '../../restaurant'
import { Link } from '../../router'
import { useStore } from '../../store'
import { BadgeChip, CloseButton, DietTags, Overlay } from './bits'

// Suggest something from these categories ("goes well with") for dishes outside them.
const PAIR_CATEGORIES = ['drinks', 'sweet']

export function DishSheet({ item, onClose, onSelect, onAdded }: {
  item: MenuItem | null
  onClose: () => void
  onSelect: (id: string) => void
  onAdded: (name: string) => void
}) {
  const { t, lang } = useI18n()
  const { orderingEnabled } = useRestaurant()
  const { menu, cart, add } = useStore()
  const [qty, setQty] = useState(1)
  useEffect(() => setQty(1), [item?.id])

  const pairs = useMemo(() => {
    if (!item) return []
    const own = menu.categories.find((c) => c.items.some((i) => i.id === item.id))?.id
    const pool = PAIR_CATEGORIES.includes(own ?? '') ? ['to-begin'] : PAIR_CATEGORIES
    return menu.categories.filter((c) => pool.includes(c.id)).flatMap((c) => c.items).filter((i) => i.image).slice(0, 3)
  }, [item, menu])

  if (!item) return <Overlay open={false} onClose={onClose} label="">{null}</Overlay>
  const inOrder = cart[item.id] || 0

  return (
    <Overlay open={!!item} onClose={onClose} label={item.name[lang]}>
      <div className="dsheet">
        <div className="dsheet__media">
          {item.image ? <img src={img(item.image)} alt="" width={800} height={600} /> : <div className="dsheet__placeholder" />}
          <div className="dsheet__close"><CloseButton onClick={onClose} /></div>
        </div>
        <div className="dsheet__body">
          <div className="dsheet__chips">
            {item.featured && <span className="chip chip--pick">★ {t.mp.pick}</span>}
            <BadgeChip badge={item.badge} />
            <DietTags item={item} />
          </div>
          <h2 className="dsheet__name">{item.name[lang]}</h2>
          <p className="dsheet__desc">{item.description[lang]}</p>
          <p className="dsheet__price">€ {formatPrice(item.price)}</p>
          {inOrder > 0 && <p className="dsheet__inorder">{fill(t.mp.inOrder, { n: inOrder })}</p>}

          {pairs.length > 0 && (
            <div className="dsheet__pairs">
              <h3>{t.mp.pairs}</h3>
              <ul>
                {pairs.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => onSelect(p.id)}>
                      <img src={img(p.image!)} alt="" width={160} height={120} loading="lazy" />
                      <span className="dsheet__pair-name">{p.name[lang]}</span>
                      <span className="dsheet__pair-price">€ {formatPrice(p.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="dsheet__footer">
          {orderingEnabled ? (
            <>
              <span className="stepper">
                <button type="button" aria-label="−" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>−</button>
                <span aria-live="polite">{qty}</span>
                <button type="button" aria-label="+" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
              </span>
              <button
                type="button"
                className="btn btn--burgundy dsheet__cta"
                onClick={() => { add(item.id, qty); onAdded(item.name[lang]); onClose() }}
              >
                {fill(t.mp.addFor, { price: `€ ${formatPrice(item.price * qty)}` })}
              </button>
            </>
          ) : (
            <>
              <p className="dsheet__soon">{t.mp.soonNote}</p>
              <Link to="/#reserve" className="btn btn--burgundy dsheet__cta" onClick={onClose}>{t.mp.reserveCta}</Link>
            </>
          )}
        </div>
      </div>
    </Overlay>
  )
}
