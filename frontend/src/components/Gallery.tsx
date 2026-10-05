import { img } from '../api'
import { useI18n } from '../i18n'

const PHOTOS = ['republic-square', 'tonir', 'ararat-city', 'feast', 'tuff'] as const

export function Gallery() {
  const { t } = useI18n()
  return (
    <section className="section gallery" aria-labelledby="gallery-title">
      <div className="container">
        <header className="section__head">
          <h2 id="gallery-title">{t.gallery.title}</h2>
          <p className="lead">{t.gallery.lead}</p>
        </header>
      </div>
      <ul className="gallery__track">
        {PHOTOS.map((key) => (
          <li key={key} className="gallery__item">
            <figure>
              <img src={img(`yerevan/${key}.webp`)} alt={t.gallery.photos[key]} width={800} height={1000} loading="lazy" decoding="async" />
              <figcaption>{t.gallery.photos[key]}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  )
}
