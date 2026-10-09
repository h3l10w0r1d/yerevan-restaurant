import { formatPrice, img } from '../api'
import { fill, useI18n } from '../i18n'
import { Link } from '../router'
import { useRestaurant } from '../restaurant'
import { useStore } from '../store'
import { MenuComingSoon } from './ComingSoon'
import { BadgeChip } from './menu/bits'

/** Homepage taste of the menu: a chef's-picks spread, category shortcuts, one clear way to the full menu. */
export function MenuPreview() {
  const { t, lang } = useI18n()
  const { menu } = useStore()
  const { prelaunch } = useRestaurant()
  const all = menu.categories.flatMap((c) => c.items)
  // Lead with a Signature pick: the large tile should be the dish we're proudest of.
  const featured = all.filter((i) => i.featured && i.image)
    .sort((a, b) => Number(b.badge === 'signature') - Number(a.badge === 'signature'))
  // Always show five tiles: chef's picks first, then other dishes with photos.
  const tiles = [...featured, ...all.filter((i) => !i.featured && i.image)].slice(0, 5)

  if (prelaunch) {
    return (
      <section className="section mprev" id="menu">
        <div className="container container--narrow" data-reveal>
          <MenuComingSoon />
        </div>
      </section>
    )
  }

  return (
    <section className="section mprev" id="menu">
      <div className="container">
        <header className="mprev__head" data-reveal>
          <div>
            <h2>{t.menu.title}</h2>
            <p className="lead">{t.mp.previewLead}</p>
          </div>
          <Link to="/menu" className="mprev__all">{t.mp.seeFull} →</Link>
        </header>

        <div className="bento" data-reveal>
          {tiles.map((item, i) => (
            <Link key={item.id} to={`/menu?dish=${item.id}`} className={`bento__tile ${i === 0 ? 'bento__tile--hero' : ''}`}>
              <img src={img(item.image!)} alt="" width={800} height={600} loading="lazy" decoding="async" />
              <span className="bento__shade" aria-hidden />
              <span className="bento__chips">
                {item.featured && <span className="chip chip--pick">★ {t.mp.pick}</span>}
                <BadgeChip badge={item.badge} />
              </span>
              <span className="bento__text">
                <span className="bento__name">{item.name[lang]}</span>
                {i === 0 && <span className="bento__desc">{item.description[lang]}</span>}
                <span className="bento__price">€ {formatPrice(item.price)}</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mprev__explore" data-reveal>
          <h3>{t.mp.explore}</h3>
          <div className="mprev__cats">
            {menu.categories.map((c) => (
              <Link key={c.id} to={`/menu#c-${c.id}`} className="mprev__cat">
                <span>{c.name[lang]}</span>
                <span className="mprev__count">{c.items.length}</span>
              </Link>
            ))}
          </div>
          <Link to="/menu" className="btn btn--burgundy mprev__cta">
            {t.mp.seeFull} · {fill(t.mp.dishes, { n: all.length })}
          </Link>
        </div>
      </div>
    </section>
  )
}
