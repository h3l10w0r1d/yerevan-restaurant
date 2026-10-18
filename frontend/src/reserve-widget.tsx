import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Ctx = { open: boolean; show: () => void; hide: () => void }
const ReserveCtx = createContext<Ctx>({ open: false, show: () => {}, hide: () => {} })

/** Lets any "Reserve a table" button open the header booking popup. */
export function ReserveProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => setOpen(false), [])
  return <ReserveCtx.Provider value={{ open, show, hide }}>{children}</ReserveCtx.Provider>
}

export const useReserveWidget = () => useContext(ReserveCtx)
