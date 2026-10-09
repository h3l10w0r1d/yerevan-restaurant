import { useI18n } from '../i18n'
import { useRestaurant } from '../restaurant'

export function Visit() {
  const { t } = useI18n()
  const R = useRestaurant()
  const todayIdx = (new Date().getDay() + 6) % 7
  return (
    <section className="section visit" id="visit">
      <div className="container">
        <header className="section__head"><h2>{t.visit.title}</h2></header>
        <div className="visit__grid">
          <div>
            <h3>{t.visit.address}</h3>
            <p>{R.address}<br />{R.city}</p>
            <a className="link" href={R.mapsUrl} target="_blank" rel="noreferrer">{t.visit.route} →</a>
          </div>
          <div>
            <h3>{t.visit.hours}</h3>
            {R.prelaunch && <p className="visit__note">{t.soon.hoursNote}</p>}
            <dl className="hours">
              {t.days.map((day, i) => {
                const h = R.hours[i]
                return (
                  <div key={day} className={i === todayIdx ? 'hours__today' : ''}>
                    <dt>{day}</dt>
                    <dd>{h ? `${h[0]} – ${h[1]}` : t.visit.closed}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
          <div>
            <h3>{t.visit.contact}</h3>
            <p><a className="link" href={`mailto:${R.email}`}>{R.email}</a></p>
            {R.phone && <p><a className="link" href={`tel:${R.phone.replace(/\s/g, '')}`}>{R.phone}</a></p>}
          </div>
        </div>
      </div>
    </section>
  )
}
