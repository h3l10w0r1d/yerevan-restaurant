import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'

export type Hours = ([string, string] | null)[] // weekday 0 = Monday

// Shipped defaults, replaced by /api/info (edited in the admin panel) once it loads.
const DEFAULTS = {
  name: 'Yerevan',
  address: 'Kampstraat 22',
  city: 'Hilversum',
  email: 'info@yerevanrestaurant.nl',
  phone: '',
  hours: [
    null,
    ['17:00', '22:00'],
    ['17:00', '22:00'],
    ['17:00', '22:00'],
    ['17:00', '23:00'],
    ['16:00', '23:00'],
    ['16:00', '22:00'],
  ] as Hours,
  maxParty: 12,
  bookingWindowDays: 90,
  orderingEnabled: false,
}

export type Restaurant = typeof DEFAULTS & { mapsUrl: string }

const withMaps = (r: typeof DEFAULTS): Restaurant => ({
  ...r,
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.address} ${r.city}`)}`,
})

const Ctx = createContext<Restaurant>(withMaps(DEFAULTS))

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState(() => withMaps(DEFAULTS))
  useEffect(() => {
    api.info()
      .then((i) => setInfo(withMaps({
        name: i.name || DEFAULTS.name,
        address: i.address || DEFAULTS.address,
        city: i.city || DEFAULTS.city,
        email: i.email || DEFAULTS.email,
        phone: i.phone || '',
        hours: i.hours ?? DEFAULTS.hours,
        maxParty: i.max_party_size ?? DEFAULTS.maxParty,
        bookingWindowDays: i.booking_window_days ?? DEFAULTS.bookingWindowDays,
        orderingEnabled: !!i.ordering_enabled,
      })))
      .catch(() => {})
  }, [])
  return <Ctx.Provider value={info}>{children}</Ctx.Provider>
}

export const useRestaurant = () => useContext(Ctx)
