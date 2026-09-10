import { describe, it, expect, beforeAll } from 'vitest'
import { initI18n } from '../i18n/config'
import { getStations, getAccessibleStations, getFuelCost, findPath } from '../data/stations'

// Les liaisons sont saisies sur la station d'ARRIVÉE (`fuelCostFrom`), et les
// retours n'ont pour la plupart pas été écrits. Résultat : la poche
// Les Cendres / Station Quarantaine / L'Épave Vivante n'avait qu'une seule
// sortie, L'Arc Perdu — verrouillé tant que les quatre indices ne sont pas
// réunis. Un joueur qui y entrait avant ne pouvait plus jamais en ressortir :
// aucune arête ne remontait, et le scavenge anti-panne sèche n'y changeait rien
// puisque le problème n'était pas le carburant.

beforeAll(async () => { await initI18n() })

const DEPART = 'La Carcasse'
const VERROUILLEE = "L'Arc Perdu"

/** Stations atteignables depuis `depuis`, en ignorant celles de `bloquees`. */
function atteignables(depuis: string, bloquees: Set<string>): Set<string> {
  const vus = new Set([depuis])
  const file = [depuis]
  while (file.length > 0) {
    const courant = file.pop()!
    for (const s of getAccessibleStations(courant)) {
      if (bloquees.has(s.name) || vus.has(s.name)) continue
      vus.add(s.name)
      file.push(s.name)
    }
  }
  return vus
}

describe('réseau de stations', () => {

  it('laisse toujours repartir, même avec L\'Arc Perdu verrouillé', () => {
    // C'est le cas qui piégeait : l'Arc Perdu est fermé au joueur tant qu'il
    // n'a pas réuni ses indices, donc il ne peut pas servir de sortie.
    const bloquees = new Set([VERROUILLEE])
    const pieges: string[] = []

    for (const s of getStations()) {
      if (s.name === VERROUILLEE) continue
      if (!atteignables(s.name, bloquees).has(DEPART)) pieges.push(s.name)
    }

    expect(pieges, 'station(s) sans retour possible : ' + pieges.join(', ')).toEqual([])
  })

  it('garde toutes les stations joignables et quittables', () => {
    for (const s of getStations()) {
      const sorties = getAccessibleStations(s.name)
      expect(sorties.length, `${s.name} : aucune sortie`).toBeGreaterThan(0)
    }
  })

  it('donne un coût de trajet identique dans les deux sens', () => {
    // La carte dessine un trait unique par paire, sans flèche : le joueur
    // s'attend à revenir par le même chemin, au même prix.
    for (const s of getStations()) {
      for (const voisine of getAccessibleStations(s.name)) {
        const aller = getFuelCost(s.name, voisine.name)
        const retour = getFuelCost(voisine.name, s.name)
        expect(retour, `${s.name} → ${voisine.name} coûte ${aller}, le retour ${retour}`)
          .toBe(aller)
        expect(aller, `${s.name} → ${voisine.name} : liaison sans coût`).toBeLessThan(99)
      }
    }
  })
})

describe('itinéraire entre deux stations quelconques', () => {
  it('relie n’importe quel couple de stations, pas seulement depuis la position', () => {
    // La carte ne savait tracer un trajet que depuis la station courante, alors
    // que findPath accepte déjà une origine libre. On vérifie que planifier
    // entre deux stations distantes fonctionne réellement.
    const noms = getStations().map(s => s.name).filter(n => n !== "L'Arc Perdu")
    let echecs = 0
    for (let i = 0; i < noms.length; i += 7) {
      for (let j = 3; j < noms.length; j += 11) {
        const a = noms[i]
        const b = noms[j]
        if (a === b) continue
        const chemin = findPath(a, b)
        if (chemin.length === 0) { echecs++; continue }
        expect(chemin[0], a + ' → ' + b + ' : mauvais départ').toBe(a)
        expect(chemin[chemin.length - 1], a + ' → ' + b + ' : mauvaise arrivée').toBe(b)
        // Chaque saut du trajet doit être une liaison réelle et chiffrable.
        for (let k = 1; k < chemin.length; k++) {
          const cout = getFuelCost(chemin[k - 1], chemin[k])
          expect(cout, chemin[k - 1] + ' → ' + chemin[k] + ' : saut sans coût').toBeLessThan(99)
        }
      }
    }
    expect(echecs, 'des couples de stations restent sans itinéraire').toBe(0)
  })
})
