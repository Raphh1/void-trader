/// <reference types="vite/client" />
import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { getClasses } from '../data/classes'

// Trois fois dans ce projet, une classe a promis au joueur une mécanique qui
// n'existait pas : le Marchand (« bonus sur les négociations », aucun code),
// l'Explorateur (« événements neutres plus fréquents », champ jamais lu) et la
// dette quotidienne (debtDailyAmount écrit, jamais prélevé). À chaque fois le
// champ était bien déclaré sur la classe — c'est la LECTURE qui manquait.
//
// Ce test ferme la famille : tout champ de mécanique posé sur une classe doit
// être lu quelque part hors des données et des types, sinon c'est une promesse
// creuse faite au joueur au moment le plus engageant, le choix de classe.

beforeAll(async () => { await initI18n() })


/** Champs qui ne décrivent pas une mécanique : identité, présentation, stats. */
const NON_MECANIQUES = new Set([
  'name', 'description', 'tier', 'bonusDesc', 'color', 'icon',
  'startCredits', 'startFuel', 'maxFuel', 'startHp', 'startStamina', 'startStation',
])

function sourcesDuMoteur(): { file: string; src: string }[] {
  // Vite fournit le contenu brut de tout le dossier src : pas besoin des types
  // Node, et le test reste aligné sur ce que le bundler voit réellement.
  const mods = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  return Object.entries(mods)
    // On exclut les sites d'ÉCRITURE (déclaration et données) : on ne veut que
    // des lectures. Et les tests eux-mêmes, qui ne sont pas le moteur.
    .filter(([f]) => !f.includes('/types/') && !f.endsWith('data/classes.ts') && !f.includes('__tests__'))
    .map(([file, src]) => ({ file, src }))
}

describe('mécaniques de classe réellement branchées', () => {
  it('lit quelque part chaque mécanique déclarée sur une classe', () => {
    const sources = sourcesDuMoteur()

    // Tous les champs de mécanique effectivement posés sur au moins une classe.
    const declares = new Set<string>()
    for (const c of getClasses()) {
      for (const [k, v] of Object.entries(c)) {
        if (NON_MECANIQUES.has(k)) continue
        if (v === undefined || v === null || v === false) continue
        declares.add(k)
      }
    }

    const morts: string[] = []
    for (const champ of [...declares].sort()) {
      const lu = sources.some(({ src }) => {
        // lecture par accès : gs.class.champ, c.champ, cls.champ…
        const acces = new RegExp('\\.' + champ + '\\b')
        if (!acces.test(src)) return false
        // …mais pas uniquement en position d'affectation (`x.champ = `)
        const affectationSeule = new RegExp('\\.' + champ + '\\s*=[^=]')
        const occurrences = (src.match(new RegExp('\\.' + champ + '\\b', 'g')) ?? []).length
        const affectations = (src.match(affectationSeule) ?? []).length
        return occurrences > affectations
      })
      if (!lu) morts.push(champ)
    }

    if (morts.length > 0) {
      console.log('\n── MÉCANIQUES DE CLASSE JAMAIS LUES ──')
      for (const m of morts) {
        const porteuses = getClasses().filter(c => (c as unknown as Record<string, unknown>)[m]).map(c => c.name)
        console.log('  ' + m.padEnd(24) + '→ ' + porteuses.join(', '))
      }
    }

    expect(morts, 'mécanique(s) promise(s) au joueur mais jamais lue(s) : ' + morts.join(', '))
      .toEqual([])
  })
})
