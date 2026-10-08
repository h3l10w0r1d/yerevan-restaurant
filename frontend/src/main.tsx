import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n'
import { RestaurantProvider } from './restaurant'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <RestaurantProvider>
        <App />
      </RestaurantProvider>
    </I18nProvider>
  </StrictMode>,
)
