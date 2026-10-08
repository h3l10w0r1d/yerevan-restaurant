import { useI18n } from '../i18n'
import { useRestaurant } from '../restaurant'
import { Logo } from './Logo'
import { OrderPanel } from './OrderPanel'

export function Order() {
  const { t } = useI18n()
  const { orderingEnabled } = useRestaurant()

  return (
    <section className="section order" id="order">
      <div className="container container--narrow">
        <header className="section__head">
          <h2>{t.order.title}</h2>
        </header>
        {!orderingEnabled ? (
          <div className="soon">
            <Logo variant="mountain" className="soon__mark" title="" />
            <h3>{t.order.soonTitle}</h3>
            <p>{t.order.soon}</p>
          </div>
        ) : (
          <>
            <h3 className="order__title">{t.order.cart}</h3>
            <OrderPanel />
          </>
        )}
      </div>
    </section>
  )
}
