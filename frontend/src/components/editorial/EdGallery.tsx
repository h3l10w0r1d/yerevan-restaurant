import { img } from '../../api'
import { useI18n } from '../../i18n'

const PHOTOS = [
  { key: 'republic-square', speed: 0.1 },
  { key: 'evening-street', speed: -0.12 },
  { key: 'fountains', speed: 0.06 },
  { key: 'cascade', speed: -0.08 },
  { key: 'tuff-night', speed: 0.12 },
] as const

export function EdGallery() {
  const { t } = useI18n()
  return (
    <section className="ed-section ed-gallery" id="yerevan">
      <div className="ed-container">
        <p className="ed-kicker" data-reveal>No. 04 — {t.ed.galleryKicker}</p>
        <h2 className="ed-title" data-reveal>{t.gallery.title}</h2>
        <p className="ed-lede" data-reveal>{t.gallery.lead}</p>
        <div className="ed-gallery__grid">
          {PHOTOS.map((p, i) => (
            <figure key={p.key} className={`ed-fig ed-gallery__item ed-gallery__item--${i + 1}`} data-speed={p.speed}>
              <div className="ed-fig__frame" data-ed-clip>
                <img src={img(`yerevan/${p.key}.webp`)} alt={t.gallery.photos[p.key]} width={900} height={1125} loading="lazy" decoding="async" />
              </div>
              <figcaption><span className="ed-fig__no">Fig. {i + 2}</span>{t.gallery.photos[p.key]}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
