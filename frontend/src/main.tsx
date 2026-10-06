import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n'
import { RestaurantProvider } from './restaurant'
import { StyleProvider } from './style'
import './styles.css'
import './editorial.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <StyleProvider>
        <RestaurantProvider>
          <App />
        </RestaurantProvider>
      </StyleProvider>
    </I18nProvider>
  </StrictMode>,
)
