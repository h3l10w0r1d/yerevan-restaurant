import fallbackMenu from '../../backend/app/data/menu.json'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export type Localized = { en: string; nl: string }
export type MenuItem = { id: string; name: Localized; description: Localized; price: number; tags: string[] }
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
  info: () => request<{ ordering_enabled: boolean }>('/api/info'),
  availability: (date: string, guests: number) =>
    request<{ slots: Slot[] }>(`/api/availability?date=${date}&guests=${guests}`),
  reserve: (data: Record<string, unknown>) =>
    request('/api/reservations', { method: 'POST', body: JSON.stringify(data) }),
  order: (data: Record<string, unknown>) =>
    request('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  admin: <T,>(path: string, token: string, init?: RequestInit) =>
    request<T>(`/api/admin${path}`, { ...init, headers: { 'X-Admin-Token': token } }),
}

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2 }).format(cents / 100)
