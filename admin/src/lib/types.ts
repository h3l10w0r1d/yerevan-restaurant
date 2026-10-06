export type Role = 'owner' | 'manager' | 'staff'

export type User = {
  id: number
  email: string
  name: string
  role: Role
  active: boolean
  created_at: string
  last_login_at: string | null
}

export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'

export type Reservation = {
  id: number
  name: string
  email: string | null
  phone: string
  date: string
  time: string
  guests: number
  notes: string | null
  internal_note: string | null
  language: string
  source: 'web' | 'phone' | 'walk_in' | 'admin'
  status: ReservationStatus
  created_at: string
}

export type ReservationInput = Omit<Reservation, 'id' | 'created_at' | 'language'>

export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled'

export type Order = {
  id: number
  name: string
  email: string
  phone: string
  pickup_at: string
  items: { item_id: string; name: string; quantity: number; price: number }[]
  total_cents: number
  notes: string | null
  status: OrderStatus
  created_at: string
}

export type Category = {
  id: string
  name_en: string
  name_nl: string
  note_en: string | null
  note_nl: string | null
  position: number
}

export type MenuItem = {
  id: string
  category_id: string
  name_en: string
  name_nl: string
  description_en: string
  description_nl: string
  price: number
  tags: string[]
  image: string | null
  available: boolean
  position: number
}

export type Hours = ([string, string] | null)[]

export type Settings = {
  restaurant: { name: string; address: string; city: string; email: string; phone: string }
  hours: Hours
  slot_capacity: number
  slot_minutes: number
  last_seating_minutes: number
  max_party_size: number
  booking_window_days: number
  ordering_enabled: boolean
}

export type Stats = {
  today: { reservations: number; covers: number }
  week: { reservations: number; covers: number }
  pending: number
  open_orders: number
  series: { date: string; reservations: number; covers: number }[]
  upcoming_today: Reservation[]
}
