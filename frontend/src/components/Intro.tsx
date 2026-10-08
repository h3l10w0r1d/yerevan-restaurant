import { img } from '../api'
import { useI18n } from '../i18n'
import { Logo } from './Logo'

export function Intro() {
  const { t } = useI18n()
  return (
    <>
      <section className="section intro">
        <div className="container container--narrow" data-reveal>
          <Logo variant="mountain" className="intro__mark" title="" />
          <h2>{t.intro.title}</h2>
          <p className="lead">{t.intro.body}</p>
        </div>
      </section>
      <figure className="band">
        <div className="band__frame">
          <picture>
            <source media="(min-width: 700px)" srcSet={img('yerevan/tuff-roof-2000.webp')} />
            <img data-parallax src={img('yerevan/tuff-roof-900.webp')} alt={t.intro.photo} width={900} height={760} loading="lazy" decoding="async" />
          </picture>
        </div>
        <figcaption>{t.intro.photo}</figcaption>
      </figure>
    </>
  )
}
