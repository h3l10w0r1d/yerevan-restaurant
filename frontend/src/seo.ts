import { useEffect } from 'react'
import type { Lang } from './i18n'
import type { Restaurant } from './restaurant'

const SITE = (import.meta.env.VITE_SITE_URL as string).replace(/\/$/, '')
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const COPY = {
  home: {
    en: {
      title: 'Yerevan · Armenian restaurant in Hilversum',
      description: 'Yerevan is an Armenian restaurant in Hilversum, in the heart of ’t Gooi: lavash from the oven, khorovats over open fire, tolma and dishes to share. Kampstraat 22.',
    },
    nl: {
      title: 'Yerevan · Armeens restaurant in Hilversum',
      description: 'Yerevan is een Armeens restaurant in Hilversum, in het hart van ’t Gooi: lavash uit de oven, khorovats van het open vuur, tolma en gerechten om te delen. Kampstraat 22.',
    },
  },
  menu: {
    en: {
      title: 'Menu · Yerevan Armenian restaurant, Hilversum',
      description: 'The menu of Yerevan in Hilversum: Armenian starters to share, khorovats from the grill, tolma, ghapama, gata and more.',
    },
    nl: {
      title: 'Menu · Yerevan Armeens restaurant, Hilversum',
      description: 'Het menu van Yerevan in Hilversum: Armeense voorgerechten om te delen, khorovats van de grill, tolma, ghapama, gata en meer.',
    },
  },
} as const

function setMeta(selector: string, attr: string, value: string) {
  const el = document.head.querySelector<HTMLElement>(selector)
  if (el) el.setAttribute(attr, value)
}

/** Keeps title, description, canonical, hreflang, share tags and structured data in step with the page. */
export function useSeo(page: 'home' | 'menu', lang: Lang, r: Restaurant) {
  useEffect(() => {
    const path = page === 'menu' ? '/menu' : '/'
    const url = (l: Lang) => `${SITE}${path}${l === 'nl' ? '?lang=nl' : ''}`
    const { title, description } = COPY[page][lang]

    document.title = title
    setMeta('meta[name="description"]', 'content', description)
    setMeta('link[rel="canonical"]', 'href', url(lang))
    setMeta('link[hreflang="en"]', 'href', url('en'))
    setMeta('link[hreflang="nl"]', 'href', url('nl'))
    setMeta('link[hreflang="x-default"]', 'href', url('en'))
    setMeta('meta[property="og:title"]', 'content', title)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:url"]', 'content', url(lang))
    setMeta('meta[property="og:locale"]', 'content', lang === 'nl' ? 'nl_NL' : 'en_GB')
    setMeta('meta[property="og:locale:alternate"]', 'content', lang === 'nl' ? 'en_GB' : 'nl_NL')
  }, [page, lang])

  // Structured data follows the admin settings. Opening hours are left out before opening day,
  // so search results never say "open now" while the doors are still closed.
  useEffect(() => {
    const script = document.getElementById('ld-restaurant')
    if (!script) return
    let data: Record<string, unknown>
    try { data = JSON.parse(script.textContent || '{}') } catch { return }
    data.address = { ...(data.address as object), streetAddress: r.address, addressLocality: r.city }
    if (r.email) data.email = r.email
    if (r.phone) data.telephone = r.phone
    else delete data.telephone
    if (r.prelaunch) {
      delete data.openingHoursSpecification
      data.acceptsReservations = false
    } else {
      data.acceptsReservations = true
      data.openingHoursSpecification = r.hours.flatMap((h, i) => h ? [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${DAYS[i]}`,
        opens: h[0],
        closes: h[1],
      }] : [])
    }
    script.textContent = JSON.stringify(data)
  }, [r])
}
