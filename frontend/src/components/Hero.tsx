import { useI18n } from '../i18n'
import { Logo } from './Logo'

export function Hero() {
  const { t } = useI18n()
  return (
    <section className="hero" id="top">
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
