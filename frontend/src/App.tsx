import { useEffect } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Home } from './pages/Home'
import { MenuPage } from './pages/MenuPage'
import { useI18n } from './i18n'
import { useRestaurant } from './restaurant'
import { useRouter } from './router'
import { useSeo } from './seo'

export default function App() {
  const { path } = useRouter()
  const { lang } = useI18n()
  const restaurant = useRestaurant()
  const page = path === '/menu' ? 'menu' : 'home'
  useSeo(page, lang, restaurant)

  // The old in-page admin moved to its own app.
  const legacyAdmin = window.location.hash === '#admin'
  useEffect(() => {
    if (legacyAdmin) window.location.replace(`${import.meta.env.BASE_URL}admin/`)
  }, [legacyAdmin])

  // Sections render after the browser tried to jump to the URL's #anchor; do it now.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id && id !== 'admin') requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }, [])

  if (legacyAdmin) return null

  return (
    <>
      <Header page={page} />
      {page === 'menu' ? <main><MenuPage /></main> : <Home />}
      <Footer />
    </>
  )
}
