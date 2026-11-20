// Ouvre le jeu dans une fenêtre Chromium VISIBLE et la garde ouverte, pour
// regarder une partie jouée pas à pas via step.mjs. Outil de test local :
// rien ne s'installe au démarrage, aucun accès réseau hors localhost.
//
//   node scripts/playtest/open.mjs [url]      (défaut http://localhost:5173)
//
// Le navigateur expose le protocole de débogage sur 127.0.0.1:9222 pour que
// step.mjs puisse s'y reconnecter à chaque action. Les erreurs de la page
// sont consignées dans scripts/playtest/.errors.log.
import { chromium } from 'playwright'
import { existsSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const url = process.argv[2] ?? 'http://localhost:5173'
const errLog = join(here, '.errors.log')
writeFileSync(errLog, '')

// Réutilise un Chromium Playwright déjà présent si celui attendu par la
// version installée n'a pas été téléchargé.
function findChromium() {
  const expected = chromium.executablePath()
  if (existsSync(expected)) return expected
  const root = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
  const dirs = existsSync(root) ? readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().reverse() : []
  for (const d of dirs) {
    const exe = join(root, d, 'chrome-win64', 'chrome.exe')
    if (existsSync(exe)) return exe
  }
  return undefined
}

const browser = await chromium.launch({
  headless: false,
  executablePath: findChromium(),
  args: ['--remote-debugging-port=9222', '--remote-debugging-address=127.0.0.1', '--window-size=1400,950'],
})
const context = await browser.newContext({ viewport: { width: 1380, height: 860 } })
const page = await context.newPage()
page.on('pageerror', e => appendFileSync(errLog, `[pageerror] ${e.message}\n`))
page.on('console', m => { if (m.type() === 'error') appendFileSync(errLog, `[console] ${m.text()}\n`) })
await page.goto(url)
console.log(`Fenêtre ouverte sur ${url} — Ctrl+C pour fermer.`)
browser.on('disconnected', () => process.exit(0))
await new Promise(() => {})
