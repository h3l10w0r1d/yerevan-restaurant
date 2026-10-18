import { useEffect } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { ReserveWidget } from './components/ReserveWidget'
import { Home } from './pages/Home'
import { BlogIndex, BlogPost } from './pages/Blog'
import { MenuPage } from './pages/MenuPage'
import { useI18n } from './i18n'
import { useRestaurant } from './restaurant'
import { useRouter } from './router'
import { useSeo } from './seo'

export default function App() {
  const { path } = useRouter()
  const { lang } = useI18n()
  const restaurant = useRestaurant()
  const blog = path === '/blog' || path.startsWith('/blog/')
  const page = path === '/menu' ? 'menu' : blog ? 'blog' : 'home'
  useSeo(page, lang, restaurant)
  const [, b1, b2] = path.split('/').slice(1) // ['blog', ...]

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
      <ReserveWidget />
      {page === 'menu' ? <main><MenuPage /></main>
        : page === 'blog' ? (
          !b1 ? <BlogIndex />
            : b1 === 'tag' && b2 ? <BlogIndex key={b2} tag={b2} />
            : b1 === 'p' && b2 ? <BlogPost key={b2} preview={b2} />
            : <BlogPost key={b1} slug={b1} />
        )
        : <Home />}
      <Footer />
    </>
  )
}
