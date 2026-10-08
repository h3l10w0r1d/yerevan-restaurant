import { img } from '../../api'
import { useI18n } from '../../i18n'

export function EdIntro() {
  const { t } = useI18n()
  return (
    <section className="ed-section ed-intro">
      <div className="ed-container">
        <p className="ed-kicker" data-reveal>No. 02 — {t.ed.introKicker}</p>
        <div className="ed-intro__grid">
          <blockquote className="ed-pull" data-reveal>{t.ed.pull}</blockquote>
          <div className="ed-intro__body" data-reveal>
            <p className="ed-dropcap">{t.intro.body}</p>
            <p>{t.ed.introBody2}</p>
          </div>
        </div>
      </div>
      <figure className="ed-fig ed-plate" data-ed-clip>
        <div className="ed-fig__frame">
          <picture>
            <source media="(min-width: 700px)" srcSet={img('yerevan/city-lights-2000.webp')} />
            <img src={img('yerevan/city-lights-900.webp')} alt={t.intro.photo} width={900} height={760} loading="lazy" decoding="async" />
          </picture>
        </div>
        <figcaption className="ed-container"><span className="ed-fig__no">Plate I</span>{t.intro.photo}</figcaption>
      </figure>
    </section>
  )
}
