import fallbackMenu from '../../backend/app/data/menu.json'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export type Localized = { en: string; nl: string }
export type Badge = 'popular' | 'signature' | 'new' | 'spicy'
export type MenuItem = {
  id: string; name: Localized; description: Localized; price: number; tags: string[]
  image?: string; featured?: boolean; badge?: Badge
}
export type Category = { id: string; name: Localized; note?: Localized; items: MenuItem[] }
export type Menu = { currency: string; categories: Category[] }
export type Slot = { time: string; available: boolean }

export class ApiError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  if (!isJson) throw new ApiError(0, 'offline')
  const body = await res.json()
  if (!res.ok) throw new ApiError(res.status, typeof body.detail === 'string' ? body.detail : 'generic')
  return body as T
}

export const FALLBACK_MENU = fallbackMenu as Menu

export const api = {
  menu: () => request<Menu>('/api/menu'),
  info: () => request<{
    name: string; address: string; city: string; email: string; phone: string
    hours: ([string, string] | null)[]; ordering_enabled: boolean; max_party_size: number; booking_window_days: number
    prelaunch?: boolean; opening_date?: string | null
  }>('/api/info'),
  availability: (date: string, guests: number) =>
    request<{ slots: Slot[] }>(`/api/availability?date=${date}&guests=${guests}`),
  reserve: (data: Record<string, unknown>) =>
    request('/api/reservations', { method: 'POST', body: JSON.stringify(data) }),
  order: (data: Record<string, unknown>) =>
    request('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
}

export type TagRef = { id: number; name: string; slug: string; color: string | null }
export type PostCard = {
  id: number; slug: string; title: string; excerpt: string; feature_image: string | null; feature_image_alt: string | null
  featured: boolean; published_at: string; updated_at: string; reading_time: number; language: 'en' | 'nl'
  tags: TagRef[]; primary_tag: TagRef | null; author: { id: number; name: string } | null
}
export type PostFull = PostCard & {
  html: string; feature_image_caption: string | null; custom_excerpt: string | null
  meta_title: string | null; meta_description: string | null; canonical_url: string | null
  og_title: string | null; og_description: string | null; og_image: string | null
  related: PostCard[]; preview?: boolean
}
export type BlogTag = TagRef & { description: string | null; meta_title: string | null; meta_description: string | null; count?: number }
export type PostPage = { posts: PostCard[]; pagination: { page: number; limit: number; total: number; pages: number } }

export const blogApi = {
  posts: (page = 1, tag?: string) => request<PostPage>(`/api/blog/posts?page=${page}&limit=12${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`),
  post: (slug: string) => request<PostFull>(`/api/blog/posts/${encodeURIComponent(slug)}`),
  preview: (uuid: string) => request<PostFull>(`/api/blog/preview/${encodeURIComponent(uuid)}`),
  tags: () => request<BlogTag[]>('/api/blog/tags'),
  tag: (slug: string) => request<BlogTag>(`/api/blog/tags/${encodeURIComponent(slug)}`),
}

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2 }).format(cents / 100)

/** Resolve a file in public/images/ against the deploy base path. */
export const img = (path: string) =>
  /^https?:/.test(path) ? path
  : path.startsWith('/') ? `${API_URL}${path}` // uploaded via the admin panel, served by the API
  : `${import.meta.env.BASE_URL}images/${path}`
