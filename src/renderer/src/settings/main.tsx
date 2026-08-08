import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/base.css'
import '../styles/settings.css'
import { SettingsApp } from './SettingsApp'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>
)
