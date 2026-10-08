import { img } from '../api'
import { useI18n } from '../i18n'
import { Logo } from './Logo'

export function Hero() {
  const { t } = useI18n()
  return (
    <section className="hero" id="top">
      {/* The Opera from above; a burgundy tint keeps the logo on a calm field, per the brandbook. */}
      <div className="hero__bg" aria-hidden>
        <picture>
          <source media="(min-width: 700px)" srcSet={img('yerevan/hero-opera-1600.webp')} />
          <img src={img('yerevan/hero-opera-900.webp')} alt="" width={900} height={1600} fetchPriority="high" decoding="async" />
        </picture>
      </div>
      <div className="hero__shade" aria-hidden />
      <div className="hero__inner">
        <h1 className="sr-only">Yerevan restaurant</h1>
        <Logo className="hero__logo" />
        <p className="hero__tagline">{t.hero.tagline}</p>
        <div className="hero__cta">
          <a className="btn btn--light" href="#reserve">{t.hero.reserve}</a>
          <a className="btn btn--ghost" href="#menu">{t.hero.menu}</a>
        </div>
        <p className="hero__address">Kampstraat 22 · Hilversum</p>
      </div>
    </section>
  )
}
