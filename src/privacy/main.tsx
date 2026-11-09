import '@fontsource-variable/inter/wght.css'
import '../index.css'
import { loadLanguage } from '../i18n'

loadLanguage().then(() => import('./boot'))
