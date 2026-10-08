import { formatPrice } from '../../api'
import { fill, useI18n } from '../../i18n'
import { useStore } from '../../store'
import { OrderPanel } from '../OrderPanel'
import { CloseButton, Overlay } from './bits'

/** Floating "View order · 3 items · €45" bar, always within thumb reach. */
export function CartBar({ onOpen, bump }: { onOpen: () => void; bump: number }) {
  const { t } = useI18n()
  const { count, total } = useStore()
  if (!count) return null
  return (
    <div className="cartbar">
      <button type="button" className="cartbar__btn" onClick={onOpen} key={bump}>
        <span className="cartbar__count">{count}</span>
        <span className="cartbar__label">{t.mp.viewOrder}</span>
        <span className="cartbar__total">€ {formatPrice(total)}</span>
      </button>
    </div>
  )
}

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { count } = useStore()
  return (
    <Overlay open={open} onClose={onClose} label={t.mp.yourOrder} variant="drawer">
      <div className="cdrawer">
        <header className="cdrawer__head">
          <div>
            <h2>{t.mp.yourOrder}</h2>
            <p className="muted">{count === 1 ? t.mp.item : fill(t.mp.items, { n: count })}</p>
          </div>
          <CloseButton onClick={onClose} />
        </header>
        <div className="cdrawer__body"><OrderPanel /></div>
      </div>
    </Overlay>
  )
}
