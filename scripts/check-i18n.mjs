// Checks every translation in src/i18n/locales against src/i18n/en.ts.  Run: npm run i18n:check
// Reports keys a language is missing (they show in English), keys English doesn't have, and
// translations whose {placeholders} differ from the English text (those would show a raw "{name}").
import { readdirSync, readFileSync } from 'node:fs'

const read = (file) =>
  Object.fromEntries([...readFileSync(file, 'utf8').matchAll(/^\s+"([^"]+)": (".*"),$/gm)].map((m) => [m[1], JSON.parse(m[2])]))
const holes = (s) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join()
const en = read('src/i18n/en.ts')
const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '')
let problems = 0

for (const file of readdirSync('src/i18n/locales').sort()) {
  const lang = read(`src/i18n/locales/${file}`)
  const missing = Object.keys(en).filter((k) => !(k in lang) && !/_(one|zero)$/.test(k))
  const unknown = Object.keys(lang).filter((k) => !(k in en) && !(`${base(k)}_other` in en))
  const wrong = Object.entries(lang).filter(([k, v]) => {
    const ref = en[k] ?? en[`${base(k)}_other`]
    return ref && holes(v) !== holes(ref) && !/_(one|two|zero)$/.test(k)
  })
  if (missing.length || unknown.length || wrong.length) {
    problems++
    console.log(`${file}: ${missing.length} missing, ${unknown.length} unknown, ${wrong.length} with different placeholders`)
    for (const k of missing.slice(0, 10)) console.log(`  missing  ${k}`)
    for (const k of unknown.slice(0, 10)) console.log(`  unknown  ${k}`)
    for (const [k] of wrong.slice(0, 10)) console.log(`  {…}      ${k}`)
  }
}
console.log(problems ? `${problems} language(s) need attention` : `All ${readdirSync('src/i18n/locales').length} languages match English (${Object.keys(en).length} texts).`)
process.exit(problems ? 1 : 0)
