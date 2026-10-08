import { useEffect, useMemo, useRef, useState } from 'react'
import { useScrollAnimations } from './animations'
import { api, FALLBACK_MENU, type Menu, type MenuItem } from './api'
import { Footer } from './components/Footer'
import { Gallery } from './components/Gallery'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Intro } from './components/Intro'
import { MenuSection } from './components/MenuSection'
import { Order } from './components/Order'
import { Reservation } from './components/Reservation'
import { Visit } from './components/Visit'
import { useRestaurant } from './restaurant'

const useHash = () => {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const [menu, setMenu] = useState<Menu>(FALLBACK_MENU)
  const { orderingEnabled: ordering } = useRestaurant()
  const [cart, setCart] = useState<Record<string, number>>({})
  const mainRef = useRef<HTMLElement>(null)
  useScrollAnimations(mainRef)

  useEffect(() => {
    api.menu().then(setMenu).catch(() => {})
  }, [])

  // In-page links glide to their section. Done in JS rather than CSS scroll-behavior,
  // which conflicts with ScrollTrigger on touch devices.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element).closest?.('a[href^="#"]')
      const id = link?.getAttribute('href')?.slice(1)
      if (!id || id === 'admin') return
      const target = document.getElementById(id)
      if (!target) return
      e.preventDefault()
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
      history.replaceState(null, '', `#${id}`)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Sections render after the browser tried to jump to the URL's #anchor; do it now.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id && id !== 'admin') requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }, [])

  const items = useMemo(() => {
    const index: Record<string, MenuItem> = {}
    menu.categories.forEach((c) => c.items.forEach((i) => (index[i.id] = i)))
    return index
  }, [menu])

  // The old in-page admin moved to its own app.
  if (hash === '#admin') {
    window.location.replace(`${import.meta.env.BASE_URL}admin/`)
    return null
  }

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, Math.min(20, qty)) }
      if (!next[id]) delete next[id]
      return next
    })
  const addOne = (id: string) => setQty(id, (cart[id] || 0) + 1)
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  return (
    <>
      <Header cartCount={cartCount} />
      <main ref={mainRef}>
        <Hero />
        <Intro />
        <MenuSection menu={menu} ordering={ordering} cart={cart} onAdd={addOne} />
        <Gallery />
        <Reservation />
        <Order enabled={ordering} cart={cart} items={items} setQty={setQty} clear={() => setCart({})} />
        <Visit />
      </main>
      <Footer />
    </>
  )
}
