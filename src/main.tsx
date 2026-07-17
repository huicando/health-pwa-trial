import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    // GitHub Pages updates in the background; check again after the initial paint.
    window.setTimeout(() => void registration.update(), 5_000)
    window.setInterval(() => void registration.update(), 60 * 60 * 1_000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
