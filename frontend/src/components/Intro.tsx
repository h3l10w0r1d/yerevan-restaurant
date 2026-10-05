import { useI18n } from '../i18n'
import { Logo } from './Logo'

export function Intro() {
  const { t } = useI18n()
  return (
    <section className="section intro">
      <div className="container container--narrow">
        <Logo variant="mountain" className="intro__mark" title="" />
        <h2>{t.intro.title}</h2>
        <p className="lead">{t.intro.body}</p>
      </div>
    </section>
  )
}
