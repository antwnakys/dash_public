// Inter ships as the fallback for non-Apple devices; Apple devices use SF Pro and never download it.
import '@fontsource-variable/inter/wght.css'
import './index.css'
import { loadLanguage } from './i18n'

// The language loads first, then the app: every module (even top-level labels) sees its translations.
loadLanguage().then(() => import('./boot'))
