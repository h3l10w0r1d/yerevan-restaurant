import { img } from '../api'
import { useI18n } from '../i18n'

const PHOTOS = ['republic-square', 'evening-street', 'ararat-dusk', 'khor-virap', 'cascade', 'city-lights'] as const

export function Gallery() {
  const { t } = useI18n()
  return (
    <section className="gallery" id="yerevan" aria-labelledby="gallery-title">
      <div className="gallery__pin">
        <header className="container section__head gallery__head" data-reveal>
          <h2 id="gallery-title">{t.gallery.title}</h2>
          <p className="lead">{t.gallery.lead}</p>
        </header>
        <ul className="gallery__track">
          {PHOTOS.map((key, i) => (
            <li key={key} className="gallery__item">
              <figure>
                <div className="gallery__frame">
                  <img src={img(`yerevan/${key}.webp`)} alt={t.gallery.photos[key]} width={900} height={1125} loading="lazy" decoding="async" />
                </div>
                <figcaption>
                  <span className="gallery__num">{String(i + 1).padStart(2, '0')}</span>
                  {t.gallery.photos[key]}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
