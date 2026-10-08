import { useState, type FormEvent } from 'react'
import { api, ApiError, formatPrice } from '../api'
import { useI18n } from '../i18n'
import { useStore } from '../store'

/** Cart lines + pickup form. Used in the homepage Order section and the menu page's cart drawer. */
export function OrderPanel({ onDone }: { onDone?: () => void }) {
  const { t, lang } = useI18n()
  const { cart, items, setQty, clear, total } = useStore()
  const [form, setForm] = useState({ name: '', email: '', phone: '', pickup_at: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const lines = Object.entries(cart).filter(([id, q]) => q > 0 && items[id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      await api.order({
        ...form, notes: null, language: lang,
        items: lines.map(([item_id, quantity]) => ({ item_id, quantity })),
      })
      clear()
      setState('done')
      onDone?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'generic')
      setState('error')
    }
  }

  if (state === 'done') return <div className="success" role="status"><p>{t.order.success}</p></div>

  return (
    <div className="order-panel">
      {lines.length === 0 ? (
        <p className="muted">{t.order.empty}</p>
      ) : (
        <ul className="cart">
          {lines.map(([id, q]) => (
            <li key={id} className="cart__line">
              <span className="cart__name">{items[id].name[lang]}</span>
              <span className="qty">
                <button type="button" aria-label="−" onClick={() => setQty(id, q - 1)}>−</button>
                <span>{q}</span>
                <button type="button" aria-label="+" onClick={() => setQty(id, q + 1)}>+</button>
              </span>
              <span className="cart__price">{formatPrice(items[id].price * q)}</span>
            </li>
          ))}
          <li className="cart__total">
            <span>{t.order.total}</span><span>€ {formatPrice(total)}</span>
          </li>
        </ul>
      )}
      {lines.length > 0 && (
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>{t.order.pickup}</span>
            <input type="datetime-local" required value={form.pickup_at}
              onChange={(e) => setForm({ ...form, pickup_at: e.target.value })} />
          </label>
          <label className="field"><span>{t.reserve.name}</span>
            <input required minLength={2} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="form__row">
            <label className="field"><span>{t.reserve.email}</span>
              <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="field"><span>{t.reserve.phone}</span>
              <input type="tel" required minLength={6} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          </div>
          {state === 'error' && <div className="alert" role="alert"><p>{error === 'generic' ? t.reserve.errors.generic : error}</p></div>}
          <p className="muted">{t.order.pay}</p>
          <button className="btn btn--burgundy btn--block" disabled={state === 'sending'}>
            {t.order.submit} · € {formatPrice(total)}
          </button>
        </form>
      )}
    </div>
  )
}
