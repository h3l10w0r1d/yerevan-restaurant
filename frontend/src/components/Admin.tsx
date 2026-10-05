import { useCallback, useEffect, useState } from 'react'
import { api, formatPrice } from '../api'
import { Logo } from './Logo'

type Reservation = { id: number; name: string; email: string; phone: string; date: string; time: string; guests: number; notes?: string; status: string }
type Order = { id: number; name: string; phone: string; pickup_at: string; total_cents: number; status: string; items: { name: string; quantity: number }[] }

const KEY = 'yerevan-admin-token'

export function Admin() {
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } })
  const [input, setInput] = useState('')
  const [date, setDate] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    try {
      setReservations(await api.admin<Reservation[]>(`/reservations${date ? `?date=${date}` : ''}`, token))
      setOrders(await api.admin<Order[]>('/orders', token))
      setError('')
    } catch (e) {
      setError((e as Error).message)
      if ((e as Error).message === 'Invalid admin token') { setToken(''); try { sessionStorage.removeItem(KEY) } catch { /* ignore */ } }
    }
  }, [token, date])

  useEffect(() => { load() }, [load])

  const setStatus = async (kind: 'reservations' | 'orders', id: number, status: string) => {
    await api.admin(`/${kind}/${id}`, token, { method: 'PATCH', body: JSON.stringify({ status }) })
    load()
  }

  if (!token) {
    return (
      <main className="admin admin--login">
        <Logo className="admin__logo" />
        <form onSubmit={(e) => { e.preventDefault(); setToken(input); try { sessionStorage.setItem(KEY, input) } catch { /* ignore */ } }}>
          <label className="field"><span>Admin token</span>
            <input type="password" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
          </label>
          {error && <p className="alert">{error}</p>}
          <button className="btn btn--burgundy btn--block">Sign in</button>
        </form>
      </main>
    )
  }

  return (
    <main className="admin">
      <header className="admin__head">
        <Logo variant="wordmark" className="admin__wordmark" />
        <a href="#" className="link">← Website</a>
      </header>
      <section>
        <div className="admin__bar">
          <h2>Reservations</h2>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn--small" onClick={load}>Refresh</button>
        </div>
        {error && <p className="alert">{error}</p>}
        {reservations.length === 0 ? <p className="muted">No reservations.</p> : (
          <ul className="admin__list">
            {reservations.map((r) => (
              <li key={r.id} className={`admin__item status--${r.status}`}>
                <div><strong>{r.date} · {r.time}</strong> — {r.guests} guests</div>
                <div>{r.name} · <a href={`tel:${r.phone}`}>{r.phone}</a> · <a href={`mailto:${r.email}`}>{r.email}</a></div>
                {r.notes && <div className="muted">“{r.notes}”</div>}
                <div className="admin__actions">
                  <span className="pill">{r.status}</span>
                  {r.status !== 'confirmed' && <button onClick={() => setStatus('reservations', r.id, 'confirmed')}>Confirm</button>}
                  {r.status !== 'cancelled' && <button onClick={() => setStatus('reservations', r.id, 'cancelled')}>Cancel</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Orders</h2>
        {orders.length === 0 ? <p className="muted">No orders.</p> : (
          <ul className="admin__list">
            {orders.map((o) => (
              <li key={o.id} className={`admin__item status--${o.status}`}>
                <div><strong>{o.pickup_at.replace('T', ' ').slice(0, 16)}</strong> — € {formatPrice(o.total_cents)}</div>
                <div>{o.name} · <a href={`tel:${o.phone}`}>{o.phone}</a></div>
                <div className="muted">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</div>
                <div className="admin__actions">
                  <span className="pill">{o.status}</span>
                  {['confirmed', 'ready', 'completed', 'cancelled'].filter((s) => s !== o.status).map((s) => (
                    <button key={s} onClick={() => setStatus('orders', o.id, s)}>{s}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
