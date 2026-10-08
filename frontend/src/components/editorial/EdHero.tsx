import { img } from '../../api'
import { useI18n } from '../../i18n'
import { useRestaurant } from '../../restaurant'
import { Logo } from '../Logo'

export function EdHero() {
  const { t, lang } = useI18n()
  const R = useRestaurant()
  const now = new Date()
  const hours = R.hours[(now.getDay() + 6) % 7]
  const date = now.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section className="ed-hero" id="top">
      <div className="ed-container">
        <div className="ed-meta">
          <span>{t.ed.issue}</span>
          <span className="ed-meta__mid">{t.ed.kicker}</span>
          <span>{date}</span>
        </div>
        <hr className="ed-rule" />
        <Logo variant="wordmark" className="ed-masthead" />
        <hr className="ed-rule ed-rule--double" />

        <div className="ed-hero__grid">
          <h1 className="ed-headline">
            <span className="sr-only">Yerevan restaurant. </span>
            {t.ed.headline.map((line) => (
              <span className="ed-line" key={line}><span>{line}</span></span>
            ))}
          </h1>
          <figure className="ed-fig ed-hero__fig" data-ed-clip>
            <div className="ed-fig__frame">
              <img src={img('yerevan/square-day.webp')} alt={t.ed.heroFig} width={900} height={1125} />
            </div>
            <figcaption><span className="ed-fig__no">Fig. 1</span>{t.ed.heroFig}</figcaption>
          </figure>
        </div>

        <hr className="ed-rule" />
        <dl className="ed-hero__facts">
          <div>
            <dt>{t.ed.find}</dt>
            <dd>{R.address}, {R.city}</dd>
          </div>
          <div>
            <dt>{t.ed.tonight}</dt>
            <dd>{hours ? `${hours[0]} – ${hours[1]}` : t.ed.closedToday}</dd>
          </div>
          <div>
            <dt>{t.ed.book}</dt>
            <dd><a className="ed-arrow" href="#reserve">{t.hero.reserve} <span aria-hidden>→</span></a></dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
