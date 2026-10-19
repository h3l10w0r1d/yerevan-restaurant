import { img } from '../api'
import { useI18n } from '../i18n'
import { useRestaurant } from '../restaurant'
import { useReserveWidget } from '../reserve-widget'
import { Link } from '../router'
import { useOpeningLabel } from './ComingSoon'
import { Logo } from './Logo'

export function Hero() {
  const { t } = useI18n()
  const { prelaunch } = useRestaurant()
  const reserve = useReserveWidget()
  const opening = useOpeningLabel()
  return (
    <section className="hero" id="top">
      {/* The Cascade's fountains from above (turned on its side for wide screens); a burgundy tint keeps the logo on a calm field, per the brandbook. */}
      <div className="hero__bg" aria-hidden>
        <picture>
          <source media="(min-width: 700px)" srcSet={img('yerevan/hero-cascade-1600.webp')} />
          <img src={img('yerevan/hero-cascade-900.webp')} alt="" width={878} height={1560} fetchPriority="high" decoding="async" />
        </picture>
      </div>
      <div className="hero__shade" aria-hidden />
      <div className="hero__inner">
        <h1 className="sr-only">{t.seo.h1}</h1>
        <Logo className="hero__logo" />
        <p className="hero__tagline">{t.hero.tagline}</p>
        <div className="hero__cta">
          <button type="button" className="btn btn--light" data-reserve-cta onClick={reserve.show}>{t.hero.reserve}</button>
          <Link className="btn btn--ghost" to="/menu">{t.hero.menu}</Link>
        </div>
        {prelaunch && <p className="hero__opening">{opening}</p>}
        <p className="hero__address">Kampstraat 22 · Hilversum</p>
      </div>
    </section>
  )
}
