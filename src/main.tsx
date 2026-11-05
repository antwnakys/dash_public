import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter ships as the fallback for non-Apple devices; Apple devices use SF Pro and never download it.
import '@fontsource-variable/inter/wght.css'
import './index.css'
import App from './App.tsx'
import { routeExternalLinks } from './lib/macApp'

routeExternalLinks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
