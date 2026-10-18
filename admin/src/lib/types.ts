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

export type ReservationInput = Omit<Reservation, 'id' | 'created_at'> & { notify_guest: boolean }

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
  featured: boolean
  badge: 'popular' | 'signature' | 'new' | 'spicy' | null
}

export type Hours = ([string, string] | null)[]

export type Settings = {
  restaurant: { name: string; address: string; city: string; email: string; phone: string }
  hours: Hours
  seats: number
  dining_minutes: number
  slot_minutes: number
  last_seating_minutes: number
  max_party_size: number
  booking_window_days: number
  ordering_enabled: boolean
  notifications: { guest_emails: boolean; staff_emails: boolean; staff_email: string }
  prelaunch: boolean
  opening_date: string
}

export type Stats = {
  today: { reservations: number; covers: number }
  week: { reservations: number; covers: number }
  pending: number
  open_orders: number
  series: { date: string; reservations: number; covers: number }[]
  upcoming_today: Reservation[]
}

export type EmailLogEntry = {
  id: number
  to: string
  subject: string
  template: string
  related: string | null
  status: 'sent' | 'failed' | 'skipped'
  provider_id: string | null
  error: string | null
  created_at: string
}

export type EmailStatus = {
  enabled: boolean
  from: string
  reply_to: string
  site_url: string
  log: EmailLogEntry[]
}

// --- Blog -------------------------------------------------------------------

export type TagRef = { id: number; name: string; slug: string; color: string | null }

export type BlogTag = TagRef & {
  description: string | null
  meta_title: string | null
  meta_description: string | null
  count: number
}

export type PostListItem = {
  id: number
  title: string
  slug: string
  status: 'draft' | 'published'
  scheduled: boolean
  featured: boolean
  published_at: string | null
  updated_at: string
  created_at: string
  feature_image: string | null
  tags: TagRef[]
  author: { id: number; name: string } | null
}

export type PostFields = {
  title: string
  slug: string
  html: string
  content_json: object | null
  custom_excerpt: string | null
  feature_image: string | null
  feature_image_alt: string | null
  feature_image_caption: string | null
  featured: boolean
  status: 'draft' | 'published'
  published_at: string | null
  language: 'en' | 'nl'
  author_id: number | null
  tag_ids: number[]
  meta_title: string | null
  meta_description: string | null
  canonical_url: string | null
  og_title: string | null
  og_description: string | null
  og_image: string | null
  twitter_title: string | null
  twitter_description: string | null
  twitter_image: string | null
  focus_keyword: string | null
}

export type Post = PostFields & {
  id: number
  uuid: string
  tags: TagRef[]
  excerpt: string
  reading_time: number
  word_count: number
  created_at: string
  updated_at: string
}
