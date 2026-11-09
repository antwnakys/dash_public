import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { t } from '@/i18n'
import { PrivacyPage } from './PrivacyPage'

document.title = `unidash · ${t('pp.title')}`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivacyPage />
  </StrictMode>,
)
