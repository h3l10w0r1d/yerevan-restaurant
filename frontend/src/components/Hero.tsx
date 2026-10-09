import { img } from '../api'
import { useI18n } from '../i18n'
import { useRestaurant } from '../restaurant'
import { Link } from '../router'
import { useOpeningLabel } from './ComingSoon'
import { Logo } from './Logo'

export function Hero() {
  const { t } = useI18n()
  const { prelaunch } = useRestaurant()
  const opening = useOpeningLabel()
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
          <Link className="btn btn--light" to="/#reserve">{t.hero.reserve}</Link>
          <Link className="btn btn--ghost" to="/menu">{t.hero.menu}</Link>
        </div>
        {prelaunch && <p className="hero__opening">{opening}</p>}
        <p className="hero__address">Kampstraat 22 · Hilversum</p>
      </div>
    </section>
  )
}
