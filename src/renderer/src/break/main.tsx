import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/base.css'
import '../styles/break.css'
import { BreakApp } from './BreakApp'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BreakApp />
  </StrictMode>
)
