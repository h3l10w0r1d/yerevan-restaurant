import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type SiteStyle = 'classic' | 'editorial'
const STYLES: SiteStyle[] = ['classic', 'editorial']

function initialStyle(): SiteStyle {
  const fromUrl = new URLSearchParams(window.location.search).get('style')
  if (STYLES.includes(fromUrl as SiteStyle)) return fromUrl as SiteStyle
  try {
    const saved = localStorage.getItem('style')
    if (STYLES.includes(saved as SiteStyle)) return saved as SiteStyle
  } catch { /* storage unavailable */ }
  return 'classic'
}

const Ctx = createContext<{ style: SiteStyle; setStyle: (s: SiteStyle) => void }>({
  style: 'classic', setStyle: () => {},
})

export function StyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyle] = useState<SiteStyle>(initialStyle)
  useEffect(() => {
    document.documentElement.dataset.style = style
    try { localStorage.setItem('style', style) } catch { /* ignore */ }
  }, [style])
  return <Ctx.Provider value={{ style, setStyle }}>{children}</Ctx.Provider>
}

export const useSiteStyle = () => useContext(Ctx)
