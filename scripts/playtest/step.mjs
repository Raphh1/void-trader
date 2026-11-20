// Une action dans la partie ouverte par open.mjs, puis l'état de l'écran.
//
//   node scripts/playtest/step.mjs look              état seul
//   node scripts/playtest/step.mjs click 3           clique le bouton n°3 de la liste
//   node scripts/playtest/step.mjs text "Marché"     clique le 1er bouton contenant ce texte
//   node scripts/playtest/step.mjs key Escape        appuie sur une touche
//   node scripts/playtest/step.mjs wait 1500         attend (animations)
//   node scripts/playtest/step.mjs shot nom          capture dans scripts/playtest/shots/
//   node scripts/playtest/step.mjs eval "expr"       évalue une expression dans la page
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const [action = 'look', arg] = process.argv.slice(2)

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
const page = browser.contexts()[0].pages()[0]

// Surligne brièvement l'élément cliqué : on voit ce que le joueur « choisit ».
async function flashAndClick(loc) {
  await loc.scrollIntoViewIfNeeded()
  await loc.evaluate(el => { el.style.outline = '3px solid #ff00ff'; el.style.outlineOffset = '2px' })
  await page.waitForTimeout(450)
  await loc.click({ timeout: 3000 })
}

const buttons = () => page.locator('button:visible')

try {
  if (action === 'click') {
    const all = await enabledButtons()
    const target = all[Number(arg)]
    if (!target) throw new Error(`pas de bouton n°${arg}`)
    await flashAndClick(target.loc)
  } else if (action === 'text') {
    await flashAndClick(buttons().filter({ hasText: arg }).first())
  } else if (action === 'key') {
    await page.keyboard.press(arg)
  } else if (action === 'wait') {
    await page.waitForTimeout(Number(arg ?? 1000))
  } else if (action === 'shot') {
    const dir = join(here, 'shots')
    if (!existsSync(dir)) mkdirSync(dir)
    const file = join(dir, `${arg ?? Date.now()}.png`)
    await page.screenshot({ path: file })
    console.log(`capture : ${file}`)
  } else if (action === 'eval') {
    console.log(JSON.stringify(await page.evaluate(arg), null, 2))
  }
  if (action !== 'wait' && action !== 'shot' && action !== 'eval') await page.waitForTimeout(700)
} catch (e) {
  console.log(`!! action échouée : ${e.message.split('\n')[0]}`)
}

async function enabledButtons() {
  const out = []
  const n = await buttons().count()
  for (let i = 0; i < n; i++) {
    const loc = buttons().nth(i)
    if (await loc.isEnabled()) out.push({ loc, text: (await loc.innerText()).replace(/\s+/g, ' ').trim() })
  }
  return out
}

// ── État de l'écran ─────────────────────────────────────────────────────────
const text = (await page.locator('body').innerText()).replace(/\n{2,}/g, '\n').trim()
console.log('=== ÉCRAN ===')
console.log(text.length > 3500 ? text.slice(0, 3500) + '\n[…tronqué]' : text)
console.log('=== BOUTONS ACTIFS ===')
const list = await enabledButtons()
list.forEach((b, i) => console.log(`${i}: ${b.text.slice(0, 110)}`))

const errLog = join(here, '.errors.log')
if (existsSync(errLog)) {
  const errs = readFileSync(errLog, 'utf8').trim()
  if (errs) { console.log('=== ERREURS PAGE ===\n' + errs); writeFileSync(errLog, '') }
}
// Surtout pas browser.close() : via CDP, ça fermerait la fenêtre du joueur.
process.exit(0)
