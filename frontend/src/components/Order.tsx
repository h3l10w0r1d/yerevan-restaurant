import { useState, type FormEvent } from 'react'
import { api, ApiError, formatPrice, type MenuItem } from '../api'
import { useI18n } from '../i18n'
import { Logo } from './Logo'

type Props = {
  enabled: boolean
  cart: Record<string, number>
  items: Record<string, MenuItem>
  setQty: (id: string, qty: number) => void
  clear: () => void
}

export function Order({ enabled, cart, items, setQty, clear }: Props) {
  const { t, lang } = useI18n()
  const [form, setForm] = useState({ name: '', email: '', phone: '', pickup_at: '', notes: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const lines = Object.entries(cart).filter(([id, q]) => q > 0 && items[id])
  const total = lines.reduce((sum, [id, q]) => sum + items[id].price * q, 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      await api.order({
        ...form, notes: form.notes || null, language: lang,
        items: lines.map(([item_id, quantity]) => ({ item_id, quantity })),
      })
      clear()
      setState('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'generic')
      setState('error')
    }
  }

  return (
    <section className="section order" id="order">
      <div className="container container--narrow">
        <header className="section__head">
          <h2>{t.order.title}</h2>
        </header>

        {!enabled ? (
          <div className="soon">
            <Logo variant="mountain" className="soon__mark" title="" />
            <h3>{t.order.soonTitle}</h3>
            <p>{t.order.soon}</p>
          </div>
        ) : state === 'done' ? (
          <div className="success" role="status"><p>{t.order.success}</p></div>
        ) : (
          <>
            <h3 className="order__title">{t.order.cart}</h3>
            {lines.length === 0 ? (
              <p className="muted">{t.order.empty}</p>
            ) : (
              <ul className="cart">
                {lines.map(([id, q]) => (
                  <li key={id} className="cart__line">
                    <span className="cart__name">{items[id].name[lang]}</span>
                    <span className="qty">
                      <button aria-label="−" onClick={() => setQty(id, q - 1)}>−</button>
                      <span>{q}</span>
                      <button aria-label="+" onClick={() => setQty(id, q + 1)}>+</button>
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
                  <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <div className="form__row">
                  <label className="field"><span>{t.reserve.email}</span>
                    <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </label>
                  <label className="field"><span>{t.reserve.phone}</span>
                    <input type="tel" required minLength={6} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                </div>
                {state === 'error' && <div className="alert" role="alert"><p>{error === 'generic' ? t.reserve.errors.generic : error}</p></div>}
                <p className="muted">{t.order.pay}</p>
                <button className="btn btn--burgundy btn--block" disabled={state === 'sending'}>{t.order.submit}</button>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  )
}
