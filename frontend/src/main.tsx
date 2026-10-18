import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n'
import { RestaurantProvider } from './restaurant'
import { ReserveProvider } from './reserve-widget'
import { RouterProvider } from './router'
import { StoreProvider } from './store'
import './styles.css'
import './menu.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <RestaurantProvider>
        <RouterProvider>
          <StoreProvider>
            <ReserveProvider>
              <App />
            </ReserveProvider>
          </StoreProvider>
        </RouterProvider>
      </RestaurantProvider>
    </I18nProvider>
  </StrictMode>,
)
