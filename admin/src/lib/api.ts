const TOKEN_KEY = 'yerevan-admin-session'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const session = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } },
}

// Readable messages for the API's error codes.
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match.',
  account_disabled: 'This account has been disabled.',
  session_expired: 'Your session has expired. Please sign in again.',
  not_authenticated: 'Please sign in.',
  forbidden: 'You don’t have access to that.',
  email_taken: 'That email is already in use.',
  wrong_password: 'Your current password is incorrect.',
  last_owner: 'There must always be at least one active owner.',
  cannot_disable_self: 'You can’t disable your own account.',
  cannot_remove_self: 'You can’t remove your own account.',
  category_not_empty: 'Move or delete the dishes in this category first.',
  unsupported_type: 'Use a JPG, PNG, WebP or AVIF image.',
  too_large: 'That image is too large.',
  link_expired: 'This link has expired or was already used. Ask for a new one.',
}

export const describe = (e: unknown) =>
  e instanceof ApiError ? MESSAGES[e.message] ?? e.message : 'Something went wrong. Check your connection.'

async function request<T>(method: string, path: string, body?: unknown, raw?: Blob): Promise<T> {
  const headers: Record<string, string> = {}
  const token = session.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (raw) headers['Content-Type'] = raw.type
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail
      : Array.isArray(data.detail) ? data.detail.map((d: { msg: string }) => d.msg).join(', ')
      : res.statusText
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('admin:unauthorized'))
    throw new ApiError(res.status, detail)
  }
  return data as T
}

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T,>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T,>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: (path: string) => request<void>('DELETE', path),
  upload: (blob: Blob) => request<{ id: string; url: string }>('POST', '/admin/images', undefined, blob),
}

/** Seeded dish photos live in the public site; uploads are served by the API. */
export const imageUrl = (path: string | null | undefined) =>
  !path ? '' : /^https?:|^\//.test(path) ? path : `/images/${path}`
