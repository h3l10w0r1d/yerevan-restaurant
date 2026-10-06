import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n'
import { StyleProvider } from './style'
import './styles.css'
import './editorial.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <StyleProvider>
        <App />
      </StyleProvider>
    </I18nProvider>
  </StrictMode>,
)
