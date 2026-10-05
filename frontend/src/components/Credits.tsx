import credits from '../credits.json'
import { useI18n } from '../i18n'

export function Credits() {
  const { t } = useI18n()
  return (
    <details className="credits">
      <summary>{t.footer.credits}</summary>
      <p>{t.footer.creditsNote}</p>
      <ul>
        {credits.map((c) => (
          <li key={c.image}>
            <a href={c.source} target="_blank" rel="noreferrer">{c.title.replace(/\.\w+$/, '')}</a>
            {' · '}{c.author}{' · '}
            <a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a>
          </li>
        ))}
      </ul>
    </details>
  )
}
