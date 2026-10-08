import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, FALLBACK_MENU, type Menu, type MenuItem } from './api'

type Store = {
  menu: Menu
  items: Record<string, MenuItem>
  cart: Record<string, number>
  setQty: (id: string, qty: number) => void
  add: (id: string, qty?: number) => void
  clear: () => void
  count: number
  total: number
}

const Ctx = createContext<Store | null>(null)
const CART_KEY = 'yerevan-cart'

const loadCart = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '{}') } catch { return {} }
}

/** Menu (live from the API, bundled copy as fallback) and the takeaway cart, shared by both pages. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<Menu>(FALLBACK_MENU)
  const [cart, setCart] = useState<Record<string, number>>(loadCart)

  useEffect(() => { api.menu().then(setMenu).catch(() => {}) }, [])
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch { /* ignore */ } }, [cart])

  const items = useMemo(() => {
    const index: Record<string, MenuItem> = {}
    menu.categories.forEach((c) => c.items.forEach((i) => (index[i.id] = i)))
    return index
  }, [menu])

  const setQty = useCallback((id: string, qty: number) => setCart((c) => {
    const next = { ...c, [id]: Math.max(0, Math.min(20, qty)) }
    if (!next[id]) delete next[id]
    return next
  }), [])
  const add = useCallback((id: string, qty = 1) => setCart((c) => ({ ...c, [id]: Math.min(20, (c[id] || 0) + qty) })), [])
  const clear = useCallback(() => setCart({}), [])

  // Only count dishes that are still on the menu.
  const lines = Object.entries(cart).filter(([id]) => items[id])
  const count = lines.reduce((n, [, q]) => n + q, 0)
  const total = lines.reduce((n, [id, q]) => n + items[id].price * q, 0)

  return <Ctx.Provider value={{ menu, items, cart, setQty, add, clear, count, total }}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore outside StoreProvider')
  return ctx
}
