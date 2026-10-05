import { useEffect, useMemo, useState } from 'react'
import { api, FALLBACK_MENU, type Menu, type MenuItem } from './api'
import { Admin } from './components/Admin'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Intro } from './components/Intro'
import { MenuSection } from './components/MenuSection'
import { Order } from './components/Order'
import { Reservation } from './components/Reservation'
import { Visit } from './components/Visit'

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
  const [ordering, setOrdering] = useState(false)
  const [cart, setCart] = useState<Record<string, number>>({})

  useEffect(() => {
    api.menu().then(setMenu).catch(() => {})
    api.info().then((i) => setOrdering(i.ordering_enabled)).catch(() => {})
  }, [])

  const items = useMemo(() => {
    const index: Record<string, MenuItem> = {}
    menu.categories.forEach((c) => c.items.forEach((i) => (index[i.id] = i)))
    return index
  }, [menu])

  if (hash === '#admin') return <Admin />

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, Math.min(20, qty)) }
      if (!next[id]) delete next[id]
      return next
    })
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  return (
    <>
      <Header cartCount={cartCount} />
      <main>
        <Hero />
        <Intro />
        <MenuSection menu={menu} ordering={ordering} cart={cart} onAdd={(id) => setQty(id, (cart[id] || 0) + 1)} />
        <Reservation />
        <Order enabled={ordering} cart={cart} items={items} setQty={setQty} clear={() => setCart({})} />
        <Visit />
      </main>
      <Footer />
    </>
  )
}
