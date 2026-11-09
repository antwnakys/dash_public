/**
 * Translations. English (`en.ts`) is the source and is always bundled; every other language is a file in
 * `locales/` holding the same keys, loaded once before the app renders (see main.tsx). A key missing from a
 * language falls back to English, so a half-finished translation never shows a blank.
 *
 * The language is chosen once per page load (saved choice, else the device's languages, else English);
 * switching in Settings saves it and reloads. That keeps `t()` a plain function usable anywhere (lib code,
 * reminders, toasts) and lets the date formatters be built once with the right locale.
 */
import { en, type Key } from './en'

export type { Key }
export type Dict = Partial<Record<Key, string>>

/** Native names, shown in the language picker. `rtl`: written right to left. */
export const languages = [
  { code: 'en', name: 'English' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'ur', name: 'اردو', rtl: true },
] as const

export type LangCode = (typeof languages)[number]['code']

const KEY = 'unidash.lang.v1'
const codes = languages.map((l) => l.code) as readonly string[]

function saved(): LangCode | undefined {
  try {
    const v = localStorage.getItem(KEY)
    return v && codes.includes(v) ? (v as LangCode) : undefined
  } catch {
    return undefined
  }
}

/** The device's preferred languages, in order. */
const deviceLangs = (): readonly string[] => (typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language])

function fromDevice(): LangCode {
  for (const tag of deviceLangs()) {
    const base = tag.toLowerCase().split('-')[0]
    if (codes.includes(base)) return base as LangCode
  }
  return 'en'
}

/** Whether the language was picked by hand (otherwise it follows the device). */
export const langIsChosen = () => saved() !== undefined

/** The language of this page load. */
export const lang: LangCode = saved() ?? fromDevice()

/**
 * Locale for dates, times and numbers: the device's full tag when it is in the same language ("en-GB" keeps
 * 24-hour time and day-month order), otherwise the bare language.
 */
export const locale: string = deviceLangs().find((t) => t.toLowerCase().split('-')[0] === lang) ?? lang

export const isRtl = languages.some((l) => l.code === lang && 'rtl' in l && l.rtl)

let dict: Dict = {}

const loaders = import.meta.glob<{ default: Dict }>('./locales/*.ts')

/** Loads this page's language and sets the page's lang and text direction. Call once before rendering. */
export async function loadLanguage(): Promise<void> {
  document.documentElement.lang = lang
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
  if (lang === 'en') return
  try {
    dict = (await loaders[`./locales/${lang}.ts`]?.())?.default ?? {}
  } catch {
    // Offline before the file was cached: English it is, this time.
    dict = {}
  }
}

/** Saves a language choice (undefined = follow the device) and reloads so everything picks it up. */
export function setLanguage(code: LangCode | undefined) {
  try {
    if (code) localStorage.setItem(KEY, code)
    else localStorage.removeItem(KEY)
  } catch {
    // Storage is off: the reload falls back to the device's language.
  }
  location.reload()
}

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s

/** The text for `key` in this page's language, with `{name}` placeholders filled from `vars`. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  return fill(dict[key] ?? en[key], vars)
}

const plural = new Intl.PluralRules(locale)

/**
 * Counted text: picks `key_one`, `key_few`, `key_many`… by the language's own plural rules, falling back to
 * `key_other`. `{n}` is the count, formatted for the locale.
 */
export function tn(key: string, n: number, vars?: Record<string, string | number>): string {
  const rule = plural.select(n)
  const all = { ...vars, n: n.toLocaleString(locale) }
  const pick = (d: Record<string, string | undefined>) => d[`${key}_${rule}`] ?? d[`${key}_other`]
  return fill(pick(dict as Record<string, string>) ?? pick(en as Record<string, string>) ?? key, all)
}

/** List words joined the language's way: "A, B and C". */
export const joinList = (items: string[]) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(items)
