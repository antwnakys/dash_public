// Renders the app icons and favicons from assets/*.svg.  Run: npm run icons
// iPhone: app-icon-light.svg is the Default home screen icon, app-icon.svg the Dark one (iOS 18+ picks by appearance).
import { copyFileSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

const render = (svg, size, file, background) =>
  sharp(svg, { density: 300 }).resize(size, size).flatten({ background }).png().toFile(file)

const dark = ['assets/app-icon.svg', '#0b0d12']
const light = ['assets/app-icon-light.svg', '#ffffff']
const iosIcons = 'ios/App/App/Assets.xcassets/AppIcon.appiconset'

mkdirSync('public', { recursive: true })
await render(dark[0], 1024, 'assets/app-icon-1024.png', dark[1])
await render(light[0], 1024, 'assets/app-icon-light-1024.png', light[1])
await render(dark[0], 512, 'public/icon-512.png', dark[1])
await render(dark[0], 192, 'public/icon-192.png', dark[1])
await render(dark[0], 180, 'public/apple-touch-icon.png', dark[1])
copyFileSync('assets/app-icon-light-1024.png', `${iosIcons}/AppIcon-Light.png`)
copyFileSync('assets/app-icon-1024.png', `${iosIcons}/AppIcon-Dark.png`)
copyFileSync('assets/logo-mark.svg', 'public/favicon.svg')
console.log('icons written')
