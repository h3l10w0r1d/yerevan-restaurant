import { createContext, useCallback, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'

/** Tiny client router: two pages (/ and /menu) plus #section anchors on the homepage. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') // '' or '/yerevan-restaurant'

const currentPath = () => {
  const p = window.location.pathname.slice(BASE.length) || '/'
  return p.replace(/\/+$/, '') || '/'
}

type Router = { path: string; navigate: (to: string) => void }
const Ctx = createContext<Router>({ path: '/', navigate: () => {} })

const scrollToHash = (hash: string) => {
  const id = hash.replace(/^#/, '')
  if (!id) return false
  const el = document.getElementById(id)
  if (!el) return false
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  return true
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const onPop = () => setPath(currentPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string) => {
    const url = new URL(to, window.location.origin + BASE + '/')
    const target = url.pathname.replace(/\/+$/, '') || '/'
    const samePage = target === path
    // Same-page anchor: just glide there.
    if (samePage && url.hash && scrollToHash(url.hash)) {
      history.replaceState(null, '', `${BASE}${target === '/' ? '/' : target}${url.search}${url.hash}`)
      return
    }
    history.pushState(null, '', `${BASE}${target === '/' ? '/' : target}${url.search}${url.hash}`)
    setPath(target)
    // After the new page renders, go to its anchor or the top.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!url.hash || !scrollToHash(url.hash)) window.scrollTo({ top: 0 })
    }))
  }, [path])

  return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>
}

export const useRouter = () => useContext(Ctx)

/** <a> that routes inside the app. `to` is '/menu', '/#reserve', '#visit' or '/menu?dish=tolma'. */
export function Link({ to, onClick, children, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useRouter()
  const href = to.startsWith('#') ? to : `${BASE}${to}`
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate(to.startsWith('#') ? `/${to}` : to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
