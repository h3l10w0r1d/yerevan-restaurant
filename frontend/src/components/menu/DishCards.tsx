import { formatPrice, img, type MenuItem } from '../../api'
import { useI18n } from '../../i18n'
import { BadgeChip, DietTags, PlusIcon } from './bits'

/** Delivery-app style row: words on the left, square photo on the right, quick add on the photo. */
export function DishRow({ item, qty, canAdd, onOpen, onAdd }: {
  item: MenuItem
  qty: number
  canAdd: boolean
  onOpen: () => void
  onAdd: () => void
}) {
  const { t, lang } = useI18n()
  return (
    <article className={`drow ${qty ? 'drow--in' : ''}`}>
      <button type="button" className="drow__main" onClick={onOpen}>
        <span className="drow__text">
          <span className="drow__title">
            <span className="drow__name">{item.name[lang]}</span>
            {item.featured && <span className="chip chip--pick" title={t.mp.pick}>★</span>}
            <BadgeChip badge={item.badge} />
          </span>
          <span className="drow__desc">{item.description[lang]}</span>
          <span className="drow__meta">
            <span className="drow__price">€ {formatPrice(item.price)}</span>
            <DietTags item={item} />
          </span>
        </span>
        <span className="drow__media">
          {item.image ? <img src={img(item.image)} alt="" width={240} height={240} loading="lazy" decoding="async" /> : <span className="drow__noimg" />}
        </span>
      </button>
      {canAdd && (
        <button type="button" className={`drow__add ${qty ? 'drow__add--count' : ''}`} onClick={onAdd}
          aria-label={`${t.mp.add}: ${item.name[lang]}${qty ? ` (${qty})` : ''}`}>
          {qty ? qty : <PlusIcon />}
        </button>
      )}
    </article>
  )
}

/** Larger photo card for the Chef's picks carousel. */
export function PickCard({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const { lang } = useI18n()
  return (
    <button type="button" className="pick" onClick={onOpen}>
      <span className="pick__media">
        {item.image && <img src={img(item.image)} alt="" width={800} height={600} loading="lazy" decoding="async" />}
        <BadgeChip badge={item.badge} className="pick__badge" />
      </span>
      <span className="pick__name">{item.name[lang]}</span>
      <span className="pick__desc">{item.description[lang]}</span>
      <span className="pick__price">€ {formatPrice(item.price)}</span>
    </button>
  )
}
